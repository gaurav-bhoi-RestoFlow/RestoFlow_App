import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  root,
  getEnvironment,
  nativeValues,
  validateBuildEnvironment,
} from './environment-utils.mjs';
import {
  baselinePath,
  nativeFingerprint,
  parseArguments,
} from './native-baseline.mjs';

export function publishingPlan(args, native, baseline, fingerprint) {
  const allowed = [
    'env',
    'platform',
    'notes',
    'app-version',
    'confirm-production',
    'dev-verified',
    'dry-run',
    'sourcemap',
  ];
  if (Object.keys(args).some(key => !allowed.includes(key)))
    throw new Error('Unsupported publish argument');
  const mapping = getEnvironment(args.env);
  if (!['android', 'ios'].includes(args.platform))
    throw new Error('Platform must be android or ios');
  if (
    typeof args.notes !== 'string' ||
    args.notes.trim().length < 12 ||
    /^(update|changes|fix|test)$/i.test(args.notes.trim())
  ) {
    throw new Error('Provide meaningful release notes with --notes');
  }
  if (
    typeof args['app-version'] !== 'string' ||
    !/^\d+\.\d+(?:\.\d+)?$/.test(args['app-version'])
  ) {
    throw new Error('Provide a precise native --app-version');
  }
  const segments = native.uploadPath.split('/');
  if (
    segments.length !== 3 ||
    segments.some(value => !/^[A-Za-z0-9_-]+$/.test(value)) ||
    segments[1] !== mapping.stallionProject ||
    segments[2] !== mapping.stallionBucket
  ) {
    throw new Error(
      'Configure a real upload path targeting the selected Stallion project and bucket',
    );
  }
  if (native.ciToken && native.ciToken === native.appToken)
    throw new Error('A Stallion App Token cannot be used as a CI token');
  if (
    !baseline ||
    baseline.environment !== args.env ||
    baseline.platform !== args.platform ||
    baseline.appVersion !== args['app-version'] ||
    baseline.fingerprint !== fingerprint
  ) {
    throw new Error(
      'Native compatibility baseline is absent or changed. Test a new native release binary and run native:record',
    );
  }
  if (args.env === 'production') {
    if (
      args['confirm-production'] !== 'restoflow' ||
      args['dev-verified'] !== true
    ) {
      throw new Error(
        'Production requires --confirm-production=restoflow and --dev-verified after Android AND iOS DEV OTA testing',
      );
    }
    if (!native.privateKeyPath || !native.publicKeyPath)
      throw new Error(
        'Production OTA publishing requires matching bundle signing keys',
      );
  }
  return {
    ...mapping,
    environment: args.env,
    platform: args.platform,
    notes: args.notes.trim(),
    appVersion: args['app-version'],
    uploadPath: native.uploadPath,
  };
}

function verifySigningKeys(native) {
  if (!native.privateKeyPath) return;
  if (!native.publicKeyPath)
    throw new Error(
      'A signed OTA requires a public key embedded in the native binary',
    );
  const privateKey = createPrivateKey(
    readFileSync(resolve(root, native.privateKeyPath)),
  );
  const embedded = createPublicKey(
    readFileSync(resolve(root, native.publicKeyPath)),
  );
  const signingPublic = createPublicKey(privateKey);
  const format = { type: 'spki', format: 'der' };
  if (!signingPublic.export(format).equals(embedded.export(format)))
    throw new Error('Signing key does not match this environment public key');
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = parseArguments(process.argv.slice(2));
    getEnvironment(args.env);
    const native = nativeValues(args.env);
    let baseline;
    try {
      baseline = JSON.parse(
        readFileSync(baselinePath(args.env, args.platform), 'utf8'),
      );
    } catch {
      /* Missing baselines fail below. */
    }
    const plan = publishingPlan(
      args,
      native,
      baseline,
      nativeFingerprint(args.env, args.platform),
    );
    validateBuildEnvironment(args.env, { release: true });
    verifySigningKeys(native);
    console.log(
      `Preparing ${plan.environment} ${plan.platform} bundle for ${plan.stallionProject} (${plan.stallionProjectId}), native version ${plan.appVersion}.`,
    );
    if (args['dry-run']) {
      console.log('Dry run validated. No bundle was uploaded or promoted.');
    } else {
      const command = [
        'node_modules/stallion-cli/index.js',
        'publish-bundle',
        '--upload-path',
        plan.uploadPath,
        '--platform',
        plan.platform,
        '--release-note',
        plan.notes,
        '--entry-file',
        'index.js',
      ];
      if (native.ciToken) command.push('--ci-token', native.ciToken);
      if (native.privateKeyPath)
        command.push('--private-key', resolve(root, native.privateKeyPath));
      if (args.sourcemap)
        command.push('--sourcemap=true', '--keep-artifacts=true');
      // Hermes is enabled by default in CLI 2.5.1, matching both native targets.
      // Capture CLI output; redact credentials before forwarding even on failures.
      const result = spawnSync(process.execPath, command, {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ENVFILE: getEnvironment(args.env).envFile },
        maxBuffer: 20 * 1024 * 1024,
      });
      const redact = text =>
        [native.appToken, native.ciToken]
          .filter(Boolean)
          .reduce(
            (output, secret) => output.split(secret).join('[REDACTED]'),
            text ?? '',
          );
      process.stdout.write(redact(result.stdout));
      process.stderr.write(redact(result.stderr));
      if (result.error) throw new Error('Stallion CLI could not be started');
      if (result.status !== 0) throw new Error('Stallion CLI upload failed');
      console.log(
        `Upload finished. In the selected project console, promote only to native version ${plan.appVersion}. Normal updates are non-mandatory; use a controlled production rollout.`,
      );
    }
  } catch (error) {
    console.error(`OTA publishing blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
