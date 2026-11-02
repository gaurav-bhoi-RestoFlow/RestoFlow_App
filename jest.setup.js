/* eslint-env jest */
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map();
  return {
    getItem: jest.fn(async key => values.get(key) ?? null),
    setItem: jest.fn(async (key, value) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async key => values.delete(key)),
    clear: jest.fn(async () => values.clear()),
  };
});
jest.mock('react-native-config', () => ({
  APP_ENV: 'development',
  API_BASE_URL: 'https://restoflow-backend-dev.gauravbhoiofficial.workers.dev',
  ENABLE_API_LOGS: 'false',
}));
jest.mock('react-native-mmkv', () => {
  const values = new Map();
  return {
    createMMKV: jest.fn(() => ({
      getString: key =>
        typeof values.get(key) === 'string' ? values.get(key) : undefined,
      getBoolean: key =>
        typeof values.get(key) === 'boolean' ? values.get(key) : undefined,
      getNumber: key =>
        typeof values.get(key) === 'number' ? values.get(key) : undefined,
      set: (key, value) => values.set(key, value),
      contains: key => values.has(key),
      remove: key => values.delete(key),
      clearAll: () => values.clear(),
    })),
  };
});
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(async () => undefined),
  isVisible: jest.fn(async () => false),
}));
jest.mock('react-native-stallion', () => ({
  withStallion: component => component,
}));

beforeEach(async () => {
  await require('./src/services/auth/credentials').clearCredentials();
  require('./src/services/storage/storage').storage.clear();
  const { store } = require('./src/store');
  const { signedOut } = require('./src/store/slices/sessionSlice');
  store.dispatch(signedOut());
});
jest.mock('react-native-print', () => ({
  print: jest.fn(async () => undefined),
}));
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
  launchCamera: jest.fn(async () => ({ didCancel: true })),
}));

require('react-native').NativeModules.ProfilePhoto = {
  prepare: jest.fn(async () => ({
    uri: 'file:///cache/profile-photos/prepared.jpg',
    type: 'image/jpeg',
    name: 'profile.jpg',
    width: 256,
    height: 256,
    fileSize: 12000,
  })),
  remove: jest.fn(async () => undefined),
};

jest.mock('react-native-keychain', () => {
  const values = new Map();
  return {
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
    getGenericPassword: jest.fn(async ({ service }) => values.get(service) ?? false),
    setGenericPassword: jest.fn(async (username, password, { service }) => { values.set(service, { username, password }); return { service }; }),
    resetGenericPassword: jest.fn(async ({ service }) => { values.delete(service); return true; }),
  };
});
