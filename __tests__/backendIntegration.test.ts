import { apiClient } from '../src/api/client';
import {
  authApi,
  fetchRestaurant,
  listPages,
  profileSession,
  restaurantApi,
} from '../src/api/restoflow';
import {
  account,
  bill,
  dishId,
  restaurantId,
  subscription,
  tableId,
} from './support/apiFixtures';
import type { InternalAxiosRequestConfig } from 'axios';
import { saveTokens } from '../src/services/auth/credentials';
import { fixtureBill } from './support/billingFixtures';
const originalAdapter = apiClient.defaults.adapter;
const originalFormData = FormData;
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  Object.defineProperty(globalThis, 'FormData', {
    value: originalFormData,
    configurable: true,
    writable: true,
  });
});
function transport(
  handler: (request: InternalAxiosRequestConfig) => unknown,
  client = apiClient,
) {
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => ({
    data: { success: true, data: handler(config) },
    status: 200,
    statusText: '',
    headers: { 'x-restoflow-environment': 'development' },
    config,
  }));
  client.defaults.adapter = adapter;
  return adapter;
}
test('pagination continues past 100 records and keeps the route restaurant-scoped', async () => {
  const adapter = transport(config =>
    config.params.offset === 0
      ? Array.from({ length: 100 }, (_, id) => ({ id }))
      : [{ id: 100 }],
  );
  expect(
    await listPages(`/api/v1/restaurants/${restaurantId}/tables`),
  ).toHaveLength(101);
  expect(adapter.mock.calls.map(([config]) => config.params.offset)).toEqual([
    0, 100,
  ]);
  expect(
    adapter.mock.calls.every(
      ([config]) => config.url === `/api/v1/restaurants/${restaurantId}/tables`,
    ),
  ).toBe(true);
});
test('expired subscriptions are read without calling blocked operational routes', async () => {
  const adapter = transport(() => ({
    ...subscription,
    isActive: false,
    state: 'FREE_TRIAL_EXPIRED',
  }));
  const restaurant = await fetchRestaurant(profileSession(account));
  expect(restaurant.subscription.isActive).toBe(false);
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(adapter.mock.calls[0][0].url).toBe(
    `/api/v1/restaurants/${restaurantId}/subscription`,
  );
  expect(restaurant.menu).toEqual([]);
});
test('waiter restaurant refresh does not call the owner-only staff API', async () => {
  const adapter = transport(config => {
    if (config.url?.endsWith('/subscription')) return subscription;
    if (config.url?.endsWith(restaurantId))
      return { name: 'Server Restaurant', owner: account.user };
    if (config.url?.endsWith('/dashboard'))
      return {
        totalTables: 1,
        occupiedTables: 1,
        guestCount: 1,
        openOrderTotal: '300.00',
        availableTables: 0,
        currency: 'INR',
      };
    if (config.url?.endsWith('/tables'))
      return [
        { id: tableId, tableNumber: 7, occupied: true, openOrderCount: 1 },
      ];
    if (config.url?.endsWith('/menu/dishes'))
      return [
        {
          id: dishId,
          name: 'Server Dish',
          description: null,
          category: 'Seasonal',
          foodType: 'NON_VEG',
          available: true,
          price: '250.50',
          imageUrl: null,
        },
      ];
    if (config.url?.endsWith('/orders'))
      return [
        {
          id: bill.orderId,
          tableId,
          customerName: 'Customer',
          itemCount: 2,
          total: '300.00',
          createdAt: '2026-10-14',
        },
      ];
    throw new Error('Unexpected request');
  });
  const session = profileSession({
    ...account,
    restaurants: [{ ...account.restaurants[0], role: 'WAITER' }],
  });
  const restaurant = await fetchRestaurant(session);
  expect(restaurant.tables[0]).toMatchObject({
    id: tableId,
    number: 7,
    occupied: true,
    customers: [{ name: 'Customer', total: '300.00' }],
  });
  expect(restaurant.menu[0]).toMatchObject({
    id: dishId,
    category: 'Seasonal',
    price: 250.5,
    foodType: 'NON_VEG',
  });
  expect(
    adapter.mock.calls.some(([config]) => config.url?.endsWith('/waiters')),
  ).toBe(false);
});
test('phone lookup and password login never attach an existing access token', async () => {
  await saveTokens(account);
  const adapter = transport(config =>
    config.url?.endsWith('/phone/check') ? { registered: true } : account,
  );
  expect(await authApi.checkPhone('+919876543210')).toEqual({
    registered: true,
  });
  expect(await authApi.login('+919876543210', ' password123 ')).toEqual(
    account,
  );
  expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
    '/api/v1/auth/phone/check',
    '/api/v1/auth/login',
  ]);
  expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({
    phoneNumber: '+919876543210',
    password: ' password123 ',
  });
  expect(
    adapter.mock.calls.every(
      ([config]) => !config.headers.has('Authorization'),
    ),
  ).toBe(true);
});
test('visit completion waits for a backend close response and returns the final snapshot bill', async () => {
  const completedBill = {
    ...fixtureBill,
    orderId: bill.orderId,
    table: bill.table,
    billId: 'saved-bill-id',
    billNumber: 'RF-1042',
    savedAt: '2026-10-08T08:00:00.000Z',
    closedAt: '2026-10-08T08:01:00.000Z',
    isDraft: false,
  };
  const adapter = transport(() => completedBill);
  expect(await restaurantApi.closeOrder(restaurantId, bill.orderId)).toEqual(
    completedBill,
  );
  expect(adapter.mock.calls[0][0].method).toBe('post');
  expect(adapter.mock.calls[0][0].url).toBe(
    `/api/v1/restaurants/${restaurantId}/orders/${bill.orderId}/close`,
  );
});

test('restaurant registration, profile restoration, and logout use backend tokens and APIs', async () => {
  Object.defineProperty(globalThis, 'FormData', {
    value: jest.requireActual('react-native/Libraries/Network/FormData')
      .default,
    configurable: true,
    writable: true,
  });
  await jest.isolateModulesAsync(async () => {
    const { authApi: nativeAuthApi } = require('../src/api/restoflow');
    const { apiClient: nativeClient } = require('../src/api/client');
    const {
      saveTokens: saveNativeTokens,
    } = require('../src/services/auth/credentials');
    await saveNativeTokens(account);
    const adapter = transport(() => account, nativeClient);
    const result = await nativeAuthApi.register(
      {
        phoneNumber: '+919876543210',
        password: ' password123 ',
        confirmPassword: ' password123 ',
        fullName: 'Owner',
        restaurantName: 'Saved Restaurant',
      },
      { uri: 'file:///profile.jpg', type: 'image/jpeg', name: 'profile.jpg' },
    );
    expect(result).toEqual(account);
    const completion = adapter.mock.calls[0][0];
    expect(completion.url).toBe('/api/v1/onboarding/owner/complete');
    expect(completion.headers.has('Authorization')).toBe(false);
    expect(completion.headers.get('Content-Type')).toBe('multipart/form-data');
    const parts = completion.data.getParts();
    const fields = Object.fromEntries(
      parts.map((part: { fieldName: string; string?: string }) => [
        part.fieldName,
        part.string,
      ]),
    );
    expect(fields).toMatchObject({
      phoneNumber: '+919876543210',
      password: ' password123 ',
      confirmPassword: ' password123 ',
      fullName: 'Owner',
      restaurantName: 'Saved Restaurant',
    });
    expect(
      parts.find((part: { fieldName: string }) => part.fieldName === 'image'),
    ).toMatchObject({
      uri: 'file:///profile.jpg',
      name: 'profile.jpg',
      headers: { 'content-type': 'image/jpeg' },
    });
    await saveNativeTokens(result);
    await nativeAuthApi.me();
    await nativeAuthApi.logout();
    expect(
      adapter.mock.calls
        .slice(1)
        .map(([config]) => [config.url, config.headers.get('Authorization')]),
    ).toEqual([
      ['/api/v1/auth/me', 'Bearer access-token'],
      ['/api/v1/auth/logout', 'Bearer access-token'],
    ]);
  });
});

test('a failed restaurant save propagates the backend failure', async () => {
  const adapter = transport(() => {
    throw new Error('Restaurant could not be saved.');
  });
  await expect(
    authApi.register({
      phoneNumber: '+919876543210',
      password: 'password123',
      confirmPassword: 'password123',
      fullName: 'Owner',
      restaurantName: 'Restaurant',
    }),
  ).rejects.toMatchObject({ message: 'Restaurant could not be saved.' });
  expect(adapter).toHaveBeenCalledTimes(1);
});

test('billing settlement sends the saved version tokens and returns the completed bill', async () => {
  const { billingApi } = require('../src/api/billing');
  const completed = {
    ...fixtureBill,
    revision: 1,
    closedAt: '2026-10-08T08:01:00.000Z',
  };
  const adapter = transport(() => ({ finished: true, bill: completed }));
  const tokens = {
    expectedRevision: 1,
    expectedOrderUpdatedAt: fixtureBill.sourceOrderUpdatedAt,
  };
  expect(await billingApi.settle(restaurantId, bill.orderId, tokens)).toEqual(
    completed,
  );
  const request = adapter.mock.calls[0][0];
  expect(request.method).toBe('post');
  expect(request.url).toBe(
    `/api/v1/restaurants/${restaurantId}/orders/${bill.orderId}/bill/settle`,
  );
  expect(JSON.parse(request.data)).toEqual(tokens);
});

test('billing settlement rejects an incomplete server completion response', async () => {
  const { billingApi } = require('../src/api/billing');
  transport(() => ({ finished: false, bill: fixtureBill }));
  await expect(
    billingApi.settle(restaurantId, bill.orderId, {
      expectedRevision: 1,
      expectedOrderUpdatedAt: fixtureBill.sourceOrderUpdatedAt,
    }),
  ).rejects.toThrow('The visit could not be completed.');
});
