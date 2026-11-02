import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import '../src/localization/i18n';
import { apiClient } from '../src/api/client';
import { profileSession } from '../src/api/restoflow';
import type { ApiWaiter } from '../src/api/types';
import { saveTokens } from '../src/services/auth/credentials';
import {
  RestaurantProvider,
  useRestaurant,
} from '../src/features/restaurant/RestaurantProvider';
import { WaitersScreen } from '../src/features/employees/WaitersScreen';
import { AddWaiterScreen } from '../src/features/employees/AddWaiterScreen';
import { AppInput } from '../src/components/AppInput';
import { AppButton } from '../src/components/AppButton';
import { AppText } from '../src/components/AppText';
import { Avatar } from '../src/components/Avatar';
import { Screen } from '../src/components/Screen';
import type { RootStackParams } from '../src/app/navigationTypes';
import type { Waiter } from '../src/features/restaurant/types';
import {
  account,
  restaurantId,
  subscription,
  DEV_ORIGIN,
} from './support/apiFixtures';
import { deferred } from './support/menuServer';

const mockSession = profileSession(account);
jest.mock('../src/features/auth/SessionProvider', () => ({
  useSession: () => ({ session: mockSession, signOut: jest.fn() }),
}));
const Stack = createNativeStackNavigator<RootStackParams>();
const navigation = createNavigationContainerRef<RootStackParams>();
const base = `/api/v1/restaurants/${restaurantId}`;
const originalAdapter = apiClient.defaults.adapter;
const originalFormData = FormData;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
let cachedWaiters: Waiter[];
let refreshRestaurant: () => Promise<void>;
function ReadCache() {
  const state = useRestaurant();
  cachedWaiters = state.restaurant.waiters;
  refreshRestaurant = state.refresh;
  return null;
}
function waiter(index: number): ApiWaiter {
  return {
    id: `waiter-${index}`,
    userId: `user-${index}`,
    fullName: `Waiter ${index}`,
    phoneNumber: `+919${String(index).padStart(9, '0')}`,
    profileImageUrl: null,
    status: 'ACTIVE',
  };
}
function waiterServer(initial: ApiWaiter[] = []) {
  const records = initial.slice();
  const controls: {
    failList: boolean;
    failCreate: boolean;
    holdList: ReturnType<typeof deferred<void>> | null;
    holdCreate: ReturnType<typeof deferred<void>> | null;
  } = { failList: false, failCreate: false, holdList: null, holdCreate: null };
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    let data: unknown;
    const isWaiter = config.url === `${base}/waiters`;
    if (
      isWaiter &&
      ((config.method === 'get' && controls.failList) ||
        (config.method === 'post' && controls.failCreate))
    ) {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        {
          config,
          status: config.method === 'post' ? 409 : 503,
          statusText: 'Failed',
          headers: { 'x-restoflow-environment': 'development' },
          data: {
            success: false,
            error: {
              code: 'WAITER_REQUEST_FAILED',
              message:
                config.method === 'post'
                  ? 'This phone number is already registered.'
                  : 'Could not refresh waiters.',
            },
          },
        },
      );
    }
    if (isWaiter && config.method === 'post') {
      if (controls.holdCreate) await controls.holdCreate.promise;
      const input =
        typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const created = { ...waiter(records.length + 1000), ...input };
      records.push(created);
      data = created;
    } else if (isWaiter) {
      data = records
        .filter(
          row => !config.params.status || row.status === config.params.status,
        )
        .slice(
          config.params.offset,
          config.params.offset + config.params.limit,
        );
      if (controls.holdList) {
        const hold = controls.holdList;
        controls.holdList = null;
        await hold.promise;
      }
    } else if (config.url === `${base}/subscription`) data = subscription;
    else if (config.url === base)
      data = { name: 'Restaurant', owner: account.user };
    else if (config.url === `${base}/dashboard`)
      data = {
        totalTables: 0,
        occupiedTables: 0,
        availableTables: 0,
        guestCount: 0,
        openOrderTotal: '0.00',
        currency: 'INR',
      };
    else if (
      ['/tables', '/menu/dishes', '/orders'].some(
        path => config.url === `${base}${path}`,
      )
    )
      data = [];
    else throw new Error(`Unexpected request ${config.method} ${config.url}`);
    return {
      data: { success: true, data },
      status: config.method === 'post' ? 201 : 200,
      statusText: 'OK',
      headers: { 'x-restoflow-environment': 'development' },
      config,
    };
  });
  return { adapter, records, controls };
}
async function render(server: ReturnType<typeof waiterServer>) {
  apiClient.defaults.adapter = server.adapter;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider>
        <RestaurantProvider>
          <ReadCache />
          <NavigationContainer ref={navigation}>
            <Stack.Navigator
              screenOptions={{ headerShown: false, animation: 'none' }}
            >
              <Stack.Screen name="Waiters" component={WaitersScreen} />
              <Stack.Screen name="AddWaiter" component={AddWaiterScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </RestaurantProvider>
      </SafeAreaProvider>,
    );
  });
}
async function button(label: string) {
  const target = renderer!.root
    .findAllByType(AppButton)
    .filter(node => node.props.children === label)
    .pop();
  expect(target).toBeDefined();
  await act(async () => target!.props.onPress());
}
async function field(label: string, value: string) {
  await act(async () =>
    renderer!.root
      .findAllByType(AppInput)
      .find(node => node.props.label === label)!
      .props.onChangeText(value),
  );
}
function content() {
  return renderer!.root
    .findAllByType(AppText)
    .map(node => node.props.children)
    .join('\n');
}
function listCalls(server: ReturnType<typeof waiterServer>) {
  return server.adapter.mock.calls
    .map(([config]) => config)
    .filter(
      config => config.url === `${base}/waiters` && config.method === 'get',
    );
}
function createCalls(server: ReturnType<typeof waiterServer>) {
  return server.adapter.mock.calls
    .map(([config]) => config)
    .filter(
      config => config.url === `${base}/waiters` && config.method === 'post',
    );
}
beforeEach(async () => {
  await saveTokens(account);
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'setImmediate'] });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  apiClient.defaults.adapter = originalAdapter;
  Object.defineProperty(globalThis, 'FormData', {
    value: originalFormData,
    configurable: true,
    writable: true,
  });
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('creation has no password field, omits password in JSON, returns to the list and calls GET', async () => {
  const server = waiterServer();
  await render(server);
  expect(content()).toContain('Build your floor team');
  await button('Add waiter');
  expect(
    renderer!.root.findAllByType(AppInput).map(node => node.props.label),
  ).toEqual(['Waiter name', 'Mobile number']);
  expect(content()).toContain('including +91');
  await field('Waiter name', ' Vandana Bhoi ');
  await field('Mobile number', '9876543210');
  const before = listCalls(server).length;
  await button('Add waiter');
  expect(navigation.getCurrentRoute()?.name).toBe('Waiters');
  expect(createCalls(server)).toHaveLength(1);
  expect(JSON.parse(createCalls(server)[0].data)).toEqual({
    fullName: 'Vandana Bhoi',
    phoneNumber: '+919876543210',
  });
  expect(listCalls(server).length).toBeGreaterThan(before);
  expect(content()).toContain('Vandana Bhoi');
  expect(content()).toContain('+919876543210');
  expect(cachedWaiters).toMatchObject([
    { name: 'Vandana Bhoi', phone: '+919876543210' },
  ]);
});

test('list reads every page and displays names, phones and saved photos', async () => {
  const records = Array.from({ length: 101 }, (_, i) => waiter(i));
  records[100].profileImageUrl = '/api/v1/media/users/waiter.jpg';
  const server = waiterServer(records);
  await render(server);
  expect(cachedWaiters).toHaveLength(101);
  expect(content()).toContain('Waiter 100');
  expect(renderer!.root.findAllByType(Avatar)).toHaveLength(101);
  expect(renderer!.root.findAllByType(Avatar)[100].props.photo).toBe(
    `${DEV_ORIGIN}/api/v1/media/users/waiter.jpg`,
  );
  expect(listCalls(server).map(config => config.params.offset)).toEqual([
    0, 100, 0, 100,
  ]);
  expect(
    listCalls(server).every(
      config =>
        config.params.status === 'ACTIVE' && config.params.limit === 100,
    ),
  ).toBe(true);
});

test('invalid name and phone keep the form open without submitting an account', async () => {
  const server = waiterServer();
  await render(server);
  await button('Add waiter');
  await button('Add waiter');
  expect(content()).toContain('Enter the waiter’s full name');
  await field('Waiter name', 'New Waiter');
  await field('Mobile number', '123');
  await button('Add waiter');
  expect(content()).toContain('Enter a valid 10-digit Indian mobile number.');
  expect(createCalls(server)).toHaveLength(0);
  expect(navigation.getCurrentRoute()?.name).toBe('AddWaiter');
});

test('duplicate phone keeps entered values and allows retry after a failed save', async () => {
  const server = waiterServer();
  await render(server);
  await button('Add waiter');
  await field('Waiter name', 'New Waiter');
  await field('Mobile number', '9876543210');
  server.controls.failCreate = true;
  await button('Add waiter');
  expect(navigation.getCurrentRoute()?.name).toBe('AddWaiter');
  expect(content()).toContain('This phone number is already registered.');
  expect(renderer!.root.findAllByType(AppInput)[0].props.value).toBe(
    'New Waiter',
  );
  server.controls.failCreate = false;
  await button('Add waiter');
  expect(navigation.getCurrentRoute()?.name).toBe('Waiters');
  expect(server.records).toHaveLength(1);
});

test('a failed GET after creation preserves the saved waiter and retries without another POST', async () => {
  const server = waiterServer();
  await render(server);
  await button('Add waiter');
  await field('Waiter name', 'Saved Waiter');
  await field('Mobile number', '9876543210');
  server.controls.failList = true;
  await button('Add waiter');
  expect(navigation.getCurrentRoute()?.name).toBe('Waiters');
  expect(content()).toContain('Saved Waiter');
  expect(content()).toContain(
    'The server is unavailable. Please try again later.',
  );
  server.controls.failList = false;
  const before = server.adapter.mock.calls.length;
  await button('Retry');
  expect(content()).not.toContain(
    'The server is unavailable. Please try again later.',
  );
  expect(createCalls(server)).toHaveLength(1);
  expect(
    server.adapter.mock.calls
      .slice(before)
      .every(
        ([config]) =>
          config.url === `${base}/waiters` && config.method === 'get',
      ),
  ).toBe(true);
});

test('pull to refresh loads server changes and empty-list failures show Retry', async () => {
  const server = waiterServer();
  await render(server);
  server.controls.failList = true;
  await act(async () => renderer!.root.findByType(Screen).props.onRefresh());
  expect(content()).toContain('Could not load your waiter team');
  expect(content()).not.toContain('Build your floor team');
  server.controls.failList = false;
  server.records.push(waiter(5));
  await button('Retry');
  expect(content()).toContain('Waiter 5');
});

test('an older dashboard refresh cannot erase a waiter created while it was loading', async () => {
  const server = waiterServer();
  await render(server);
  await button('Add waiter');
  const hold = deferred();
  server.controls.holdList = hold;
  let refresh!: Promise<void>;
  await act(async () => {
    refresh = refreshRestaurant();
  });
  await field('Waiter name', 'Saved Waiter');
  await field('Mobile number', '9876543210');
  await button('Add waiter');
  await act(async () => {
    hold.resolve();
    await refresh;
  });
  expect(cachedWaiters).toMatchObject([{ name: 'Saved Waiter' }]);
  expect(content()).toContain('Saved Waiter');
});

test('an older list request is cancelled when a newer refresh starts', async () => {
  const server = waiterServer();
  await render(server);
  const hold = deferred();
  server.controls.holdList = hold;
  let first!: Promise<void>;
  await act(async () => {
    first = renderer!.root.findByType(Screen).props.onRefresh();
  });
  const stale = listCalls(server).at(-1)!;
  server.records.push(waiter(8));
  await act(async () => renderer!.root.findByType(Screen).props.onRefresh());
  expect(stale.signal?.aborted).toBe(true);
  await act(async () => {
    hold.resolve();
    await first;
  });
  expect(cachedWaiters).toMatchObject([{ name: 'Waiter 8' }]);
});

test('photo creation sends multipart name, phone and image without a password', async () => {
  Object.defineProperty(globalThis, 'FormData', {
    value: jest.requireActual('react-native/Libraries/Network/FormData')
      .default,
    configurable: true,
    writable: true,
  });
  await jest.isolateModulesAsync(async () => {
    const {
      restaurantApi: nativeRestaurantApi,
    } = require('../src/api/restoflow');
    const { apiClient: nativeClient } = require('../src/api/client');
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => ({
      config,
      status: 201,
      statusText: 'Created',
      headers: { 'x-restoflow-environment': 'development' },
      data: { success: true, data: waiter(1) },
    }));
    nativeClient.defaults.adapter = adapter;
    const photo = {
      uri: 'file:///waiter.jpg',
      name: 'waiter.jpg',
      type: 'image/jpeg' as const,
    };
    await nativeRestaurantApi.createWaiter(
      restaurantId,
      'Waiter One',
      '+919876543210',
      photo,
    );
    const body = adapter.mock.calls[0][0].data;
    expect(body).toBeInstanceOf(FormData);
    const parts = body.getParts();
    expect(parts.map((part: { fieldName: string }) => part.fieldName)).toEqual([
      'fullName',
      'phoneNumber',
      'image',
    ]);
    expect(parts[2]).toMatchObject({
      uri: photo.uri,
      name: photo.name,
      headers: { 'content-type': photo.type },
    });
    expect(adapter.mock.calls[0][0].headers.get('Content-Type')).toBe(
      'multipart/form-data',
    );
  });
});

test('repeated submission while saving creates only one waiter', async () => {
  const server = waiterServer();
  await render(server);
  await button('Add waiter');
  await field('Waiter name', 'Saved Waiter');
  await field('Mobile number', '9876543210');
  const hold = deferred();
  server.controls.holdCreate = hold;
  const submit = renderer!.root
    .findAllByType(AppButton)
    .filter(node => node.props.children === 'Add waiter')
    .pop()!.props.onPress;
  let first!: Promise<void>;
  await act(async () => {
    first = submit();
    await submit();
  });
  expect(createCalls(server)).toHaveLength(1);
  await act(async () => {
    hold.resolve();
    await first;
  });
  expect(server.records).toHaveLength(1);
  expect(navigation.getCurrentRoute()?.name).toBe('Waiters');
});

test('leaving the waiter list cancels an in-flight GET', async () => {
  const server = waiterServer();
  await render(server);
  const hold = deferred();
  server.controls.holdList = hold;
  let pending!: Promise<void>;
  await act(async () => {
    pending = renderer!.root.findByType(Screen).props.onRefresh();
  });
  expect(renderer!.root.findByType(Screen).props.refreshing).toBe(true);
  const request = listCalls(server).at(-1)!;
  await button('Add waiter');
  expect(request.signal?.aborted).toBe(true);
  await act(async () => {
    hold.resolve();
    await pending;
  });
  expect(navigation.getCurrentRoute()?.name).toBe('AddWaiter');
});
