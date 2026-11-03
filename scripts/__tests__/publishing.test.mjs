import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { publishingPlan } from '../stallion-publish.mjs';
import {
  root,
  getEnvironment,
  parseValues,
  validateBuildEnvironment,
} from '../environment-utils.mjs';
import { parseArguments } from '../native-baseline.mjs';

const args = {
  env: 'development',
  platform: 'android',
  notes: 'Fix billing quantity validation',
  'app-version': '1.0',
};
const native = {
  uploadPath: 'test-org/restoflow/dev',
  appToken: '',
  ciToken: '',
};
const baseline = {
  environment: 'development',
  platform: 'android',
  appVersion: '1.0',
  fingerprint: 'native-hash',
};
test('DEV publish cannot target a PROD upload path', () => {
  assert.throws(
    () =>
      publishingPlan(
        args,
        { ...native, uploadPath: 'test-org/restoflow/prod' },
        baseline,
        'native-hash',
      ),
    /selected Stallion project and bucket/,
  );
  assert.equal(
    publishingPlan(args, native, baseline, 'native-hash').stallionProjectId,
    '6aca880b9f76d8bbbc714eef',
  );
});
test('publishing rejects another project and an unconfigured bucket', () => {
  for (const uploadPath of [
    'test-org/restoflow-dev/dev',
    'test-org/restoflow/main',
  ]) {
    assert.throws(
      () =>
        publishingPlan(
          args,
          { ...native, uploadPath },
          baseline,
          'native-hash',
        ),
      /selected Stallion project and bucket/,
    );
  }
});
test('shared-project release accepts a shared App Token and rejects invalid tokens', () => {
  assert.equal(
    getEnvironment('development').stallionProjectId,
    getEnvironment('production').stallionProjectId,
  );
  const overrides = {
    ENVFILE: '.env.development',
    STALLION_DEV_APP_TOKEN: `spb_${'a'.repeat(42)}`,
    STALLION_PROD_APP_TOKEN: `spb_${'a'.repeat(42)}`,
    STALLION_DEV_PUBLIC_KEY_PATH: '',
    STALLION_PROD_PUBLIC_KEY_PATH: '',
  };
  const previous = Object.fromEntries(
    Object.keys(overrides).map(key => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, overrides);
    assert.equal(
      validateBuildEnvironment('development', { release: true }).APP_ENV,
      'development',
    );
    process.env.STALLION_DEV_APP_TOKEN = 'invalid';
    assert.throws(
      () => validateBuildEnvironment('development', { release: true }),
      /valid App Token/,
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test('native dependency/configuration drift blocks OTA', () => {
  assert.throws(
    () => publishingPlan(args, native, baseline, 'changed-native-hash'),
    /Native compatibility/,
  );
  assert.throws(
    () =>
      publishingPlan(
        { ...args, 'app-version': '2.0' },
        native,
        baseline,
        'native-hash',
      ),
    /Native compatibility/,
  );
});
test('production requires explicit confirmation, DEV verification, and signing', () => {
  const prod = { ...args, env: 'production' };
  const prodNative = { ...native, uploadPath: 'test-org/restoflow/prod' };
  const prodBaseline = { ...baseline, environment: 'production' };
  assert.throws(
    () => publishingPlan(prod, prodNative, prodBaseline, 'native-hash'),
    /Production requires/,
  );
  assert.throws(
    () =>
      publishingPlan(
        { ...prod, 'confirm-production': 'restoflow', 'dev-verified': true },
        prodNative,
        prodBaseline,
        'native-hash',
      ),
    /signing keys/,
  );
});
test('App Token cannot authenticate CLI publishing', () => {
  assert.throws(
    () =>
      publishingPlan(
        args,
        { ...native, appToken: 'runtime', ciToken: 'runtime' },
        baseline,
        'native-hash',
      ),
    /App Token cannot/,
  );
});
test('missing/invalid env, platform, notes, and duplicate selectors fail', () => {
  assert.throws(() => getEnvironment('staging'));
  assert.throws(() =>
    publishingPlan(
      { ...args, env: undefined },
      native,
      baseline,
      'native-hash',
    ),
  );
  assert.throws(() =>
    publishingPlan(
      { ...args, platform: 'web' },
      native,
      baseline,
      'native-hash',
    ),
  );
  assert.throws(() =>
    publishingPlan(
      { ...args, notes: 'update' },
      native,
      baseline,
      'native-hash',
    ),
  );
  assert.throws(() =>
    parseArguments(['--env=development', '--env=production']),
  );
  assert.throws(() => parseValues('APP_ENV=development\nAPP_ENV=production'));
});
test('Worker origins are pinned and releases still require OTA credentials', () => {
  for (const environment of ['development', 'production']) {
    const result = spawnSync(
      process.execPath,
      ['scripts/validate-environment.mjs', environment],
      { cwd: root, env: process.env, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const values = parseValues(
      readFileSync(resolve(root, getEnvironment(environment).envFile), 'utf8'),
    );
    assert.equal(values.API_BASE_URL, getEnvironment(environment).apiOrigin);
    assert.equal(Object.keys(values).length, 3);
  }
  const previous = process.env.ENVFILE;
  try {
    process.env.ENVFILE = '.env.production';
    assert.throws(
      () => validateBuildEnvironment('development'),
      /ENVFILE conflicts/,
    );
  } finally {
    if (previous === undefined) delete process.env.ENVFILE;
    else process.env.ENVFILE = previous;
  }
});
test('all iOS configurations and schemes map to their own native environment', () => {
  const project = readFileSync(
    resolve(root, 'ios/RestoFlow.xcodeproj/project.pbxproj'),
    'utf8',
  );
  for (const environment of ['development', 'production']) {
    const mapping = getEnvironment(environment);
    const suffix = environment === 'development' ? 'Development' : 'Production';
    const scheme = readFileSync(
      resolve(
        root,
        `ios/RestoFlow.xcodeproj/xcshareddata/xcschemes/${mapping.iosScheme}.xcscheme`,
      ),
      'utf8',
    );
    assert.ok(scheme.includes(`buildConfiguration = "Release-${suffix}"`));
    for (const mode of ['Debug', 'Release']) {
      const name = `${mode}-${suffix}`;
      assert.ok(project.includes(name));
      const config = readFileSync(
        resolve(root, `ios/Config/${name}.xcconfig`),
        'utf8',
      );
      assert.ok(config.includes(mapping.stallionProjectId));
      assert.ok(config.includes(`APP_ENVIRONMENT = ${environment}`));
      assert.ok(config.includes(mapping.envFile));
    }
  }
});
