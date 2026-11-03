import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createPublicKey } from 'node:crypto';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const environments = JSON.parse(
  readFileSync(resolve(root, 'config/environments.json'), 'utf8'),
);

export function parseValues(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || Object.hasOwn(values, match[1])) {
      throw new Error('Invalid or duplicate environment entry');
    }
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

export function getEnvironment(environment) {
  if (!Object.hasOwn(environments, environment)) {
    throw new Error(
      'An explicit development or production environment is required',
    );
  }
  return environments[environment];
}

// SDK 2.4.2 supports both legacy tokens and region-prefixed AP/US tokens.
export function isAppToken(value) {
  return /^spb_(?:[A-Za-z0-9_-]{42}|(?:ap|us)_[A-Za-z0-9_-]{42})$/.test(value);
}

export function publicSigningKey(path) {
  const pem = readFileSync(resolve(root, path), 'utf8');
  if (pem.includes('PRIVATE KEY'))
    throw new Error('Only a public key may be embedded in the application');
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'rsa')
    throw new Error('Stallion signing requires an RSA public key');
  return key.export({ type: 'spki', format: 'der' });
}

export function nativeValues(environment) {
  getEnvironment(environment);
  const path = resolve(root, '.env.stallion.local');
  const local = existsSync(path) ? parseValues(readFileSync(path, 'utf8')) : {};
  const prefix =
    environment === 'development' ? 'STALLION_DEV' : 'STALLION_PROD';
  const value = key =>
    process.env[`${prefix}_${key}`] ?? local[`${prefix}_${key}`] ?? '';
  return {
    appToken: value('APP_TOKEN'),
    publicKeyPath: value('PUBLIC_KEY_PATH'),
    uploadPath: value('UPLOAD_PATH'),
    ciToken: value('CI_TOKEN'),
    privateKeyPath: value('PRIVATE_KEY'),
  };
}

export function validateBuildEnvironment(
  environment,
  { release = false } = {},
) {
  const mapping = getEnvironment(environment);
  const file = resolve(root, mapping.envFile);
  if (process.env.ENVFILE && resolve(root, process.env.ENVFILE) !== file) {
    throw new Error('ENVFILE conflicts with the native build environment');
  }
  const values = parseValues(readFileSync(file, 'utf8'));
  const allowed = ['APP_ENV', 'API_BASE_URL', 'ENABLE_API_LOGS'];
  if (Object.keys(values).some(key => !allowed.includes(key))) {
    throw new Error(
      'Mobile env files may contain only approved public configuration',
    );
  }
  if (values.APP_ENV !== environment)
    throw new Error('Native and APP_ENV mismatch');
  if (!values.API_BASE_URL) throw new Error('API_BASE_URL is missing');
  if (!['true', 'false'].includes(values.ENABLE_API_LOGS))
    throw new Error('Invalid ENABLE_API_LOGS');
  if (environment === 'production' && values.ENABLE_API_LOGS !== 'false') {
    throw new Error('Production API logs must be disabled');
  }
  const url = new URL(values.API_BASE_URL);
  if (
    url.origin !== mapping.apiOrigin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(
      'API_BASE_URL must match the configured Worker origin for this environment',
    );
  }
  if (release) {
    const native = nativeValues(environment);
    if (!isAppToken(native.appToken))
      throw new Error(
        `Set ${
          environment === 'development' ? 'STALLION_DEV' : 'STALLION_PROD'
        }_APP_TOKEN in .env.stallion.local (or the build environment) to a valid App Token for the ${
          mapping.stallionProject
        } Stallion project.`,
      );
    const otherEnvironment =
      environment === 'development' ? 'production' : 'development';
    const other = nativeValues(otherEnvironment);
    // App Tokens identify a project; buckets within that project share it.
    if (
      mapping.stallionProjectId !==
        getEnvironment(otherEnvironment).stallionProjectId &&
      native.appToken === other.appToken
    )
      throw new Error(
        'Separate Stallion projects must use different App Tokens',
      );
    if (environment === 'production' && !native.publicKeyPath)
      throw new Error('Production requires a Stallion public signing key');
    if (native.publicKeyPath) {
      const publicKey = publicSigningKey(native.publicKeyPath);
      if (
        other.publicKeyPath &&
        publicKey.equals(publicSigningKey(other.publicKeyPath))
      ) {
        throw new Error('DEV and PROD must use separate bundle signing keys');
      }
    }
  }
  return values;
}
