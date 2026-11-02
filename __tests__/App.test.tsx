import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getCredentials, saveTokens } from '../src/services/auth/credentials';
import App from '../App';
import { apiClient } from '../src/api/client';
import { AppInput } from '../src/components/AppInput';
import { AppText } from '../src/components/AppText';
import { AppButton } from '../src/components/AppButton';
import { DashboardScreen } from '../src/features/tables/DashboardScreen';
import { RegistrationScreen } from '../src/features/auth/RegistrationScreen';
import { FloatingTabBar } from '../src/app/FloatingTabBar';
import { SettingsRow } from '../src/features/settings/SettingsRow';
import { TableTile } from '../src/features/tables/TableTile';
import { CustomersScreen } from '../src/features/orders/CustomersScreen';
import { CustomerCard } from '../src/features/orders/CustomerCard';
import { OrderScreen } from '../src/features/orders/OrderScreen';
import { OrderDishRow } from '../src/features/orders/OrderDishRow';
import { AppHeader } from '../src/components/AppHeader';
import { EmptyState } from '../src/components/EmptyState';
import {
  account,
  subscription,
  tableId,
  dishId,
  orderId,
} from './support/apiFixtures';
import { sourceVersion } from '../src/localization/catalogMetadata';
import type { ApiDish, ApiOrder, ApiWaiter } from '../src/api/types';
const originalAdapter = apiClient.defaults.adapter;
let role: 'OWNER' | 'WAITER';
let serverTables: {
  id: string;
  tableNumber: number;
  name: string;
  occupied: boolean;
  openOrderCount: number;
}[];
let adapter: jest.Mock;
let serverWaiters: ApiWaiter[];
let serverMenu: ApiDish[];
let serverOrders: ApiOrder[];
let registrationFails: boolean;
let phoneCheckFails: boolean;
let phoneCheckInvalid: boolean;
beforeEach(() => {
  role = 'OWNER';
  registrationFails = false;
  phoneCheckFails = false;
  phoneCheckInvalid = false;
  serverTables = [];
  serverWaiters = [];
  serverMenu = [];
  serverOrders = [];
  adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    const path = config.url!;
    const login = {
      ...account,
      restaurants: [{ ...account.restaurants[0], role }],
    };
    let data: unknown;
    let status = 200;
    if (path === '/api/v1/i18n/languages')
      data = { sourceLanguage: 'en', sourceVersion, languages: [] };
    else if (path === '/api/v1/auth/phone/check') {
      if (phoneCheckFails)
        throw new AxiosError('network', 'ERR_NETWORK', config);
      data = phoneCheckInvalid
        ? {}
        : {
            registered: JSON.parse(config.data).phoneNumber !== '+919876543212',
          };
    } else if (path === '/api/v1/auth/login') {
      if (JSON.parse(config.data).password !== ' password123 ')
        throw new AxiosError(
          'invalid credentials',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          {
            config,
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'x-restoflow-environment': 'development' },
            data: {
              success: false,
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Phone number or password is incorrect.',
              },
            },
          },
        );
      data = login;
    } else if (
      path.endsWith('/auth/me') ||
      path.endsWith('/onboarding/owner/complete')
    ) {
      if (path.endsWith('/onboarding/owner/complete') && registrationFails)
        throw new AxiosError(
          'save failed',
          'ERR_BAD_RESPONSE',
          config,
          undefined,
          {
            config,
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'x-restoflow-environment': 'development' },
            data: {
              success: false,
              error: { code: 'DATABASE_ERROR', message: 'Save failed.' },
            },
          },
        );
      data = login;
    } else if (path.endsWith('/subscription')) data = subscription;
    else if (path.endsWith('/dashboard'))
      data = {
        totalTables: serverTables.length,
        occupiedTables: 0,
        guestCount: 0,
        availableTables: serverTables.length,
        openOrderTotal: '0.00',
        currency: 'INR',
      };
    else if (path.endsWith('/tables') && config.method === 'post') {
      const table = {
        id: tableId,
        tableNumber: 1,
        name: 'Table 1',
        occupied: false,
        openOrderCount: 0,
      };
      serverTables.push(table);
      data = table;
      status = 201;
    } else if (path.endsWith('/tables')) data = serverTables;
    else if (path.endsWith('/waiters') && config.method === 'post') {
      const input = JSON.parse(config.data);
      data = {
        id: 'waiter-id',
        userId: 'waiter-user-id',
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        profileImageUrl: null,
        status: 'ACTIVE',
      };
      serverWaiters.push(data as ApiWaiter);
      status = 201;
    } else if (path.endsWith('/waiters')) data = serverWaiters;
    else if (path.endsWith('/customers')) {
      const orders = serverOrders.filter(order =>
        path.includes(`/tables/${order.tableId}/`),
      );
      data = {
        table: { id: tableId, name: 'Table 1' },
        guestCount: orders.length,
        customers: orders.map(order => ({
          orderId: order.id,
          name: order.customerName,
          createdAt: order.createdAt,
          items: order.items,
          orderItems: order.items,
          itemCount: order.itemCount,
          orderItemCount: order.itemCount,
          total: order.total,
          orderTotal: order.total,
          orderChanged: false,
        })),
        pagination: { hasMore: false, total: orders.length },
      };
    } else if (path.endsWith('/orders') && config.method === 'post') {
      const input = JSON.parse(config.data);
      const items = input.items.map(
        (item: { dishId: string; quantity: number }) => {
          const dish = serverMenu.find(value => value.id === item.dishId)!;
          return {
            id: 'order-line',
            dishId: dish.id,
            name: dish.name,
            quantity: item.quantity,
            unitPrice: dish.price,
            lineTotal: (Number(dish.price) * item.quantity).toFixed(2),
            note: null,
          };
        },
      );
      const total = items
        .reduce(
          (sum: number, item: { lineTotal: string }) =>
            sum + Number(item.lineTotal),
          0,
        )
        .toFixed(2);
      const order: ApiOrder = {
        id: orderId,
        tableId: input.tableId,
        customerName: input.customerName,
        table: { id: input.tableId, name: 'Table 1' },
        items,
        createdAt: '2026-10-29T10:00:00.000000Z',
        orderUpdatedAt: '2026-10-29T10:00:00.000000Z',
        closedAt: null,
        itemCount: input.items.reduce(
          (sum: number, item: { quantity: number }) => sum + item.quantity,
          0,
        ),
        subtotal: total,
        total,
        currency: 'INR',
      };
      serverOrders.push(order);
      data = order;
      status = 201;
    } else if (path.endsWith('/menu/dishes')) data = serverMenu;
    else if (path.endsWith('/orders')) data = serverOrders;
    else if (path.endsWith(account.restaurants[0].id))
      data = { name: account.restaurants[0].name, owner: account.user };
    else throw new Error(`Unexpected test request ${path}`);
    return {
      status,
      statusText: 'OK',
      data: { success: true, data },
      headers: { 'x-restoflow-environment': 'development' },
      config,
    };
  });
  apiClient.defaults.adapter = adapter;
});
afterEach(() => {
  expect(
    adapter.mock.calls.some(
      ([config]) =>
        config.url?.includes('/otp/') ||
        config.url?.includes('/development/session'),
    ),
  ).toBe(false);
  apiClient.defaults.adapter = originalAdapter;
});
async function render() {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  return renderer!;
}
async function press(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findAllByType(AppButton)
      .filter(button => button.props.children === label)
      .at(-1)!
      .props.onPress();
  });
}
test('welcome starts with an empty phone and does not seed restaurant data', async () => {
  const renderer = await render();
  expect(renderer.root.findByType(AppInput).props.value).toBe('');
  expect(renderer.root.findByType(AppInput).props.label).toBe(
    'Your mobile number',
  );
  expect(renderer.root.findByType(AppButton).props.children).toBe('Continue');
  expect(
    adapter.mock.calls.some(([config]) => config.url?.includes('/restaurants')),
  ).toBe(false);
  await ReactTestRenderer.act(async () => renderer.unmount());
});
test.each(['OWNER', 'WAITER'] as const)(
  'restored %s membership loads role-specific settings',
  async value => {
    role = value;
    await saveTokens(account);
    const renderer = await render();
    expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(1);
    await ReactTestRenderer.act(async () =>
      renderer.root
        .findByType(FloatingTabBar)
        .props.navigation.navigate('Settings'),
    );
    const titles = renderer.root
      .findAllByType(SettingsRow)
      .map(row => row.props.title);
    expect(titles.includes('Waiter team')).toBe(value === 'OWNER');
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);

async function fill(
  renderer: ReactTestRenderer.ReactTestRenderer,
  fields: Record<string, string>,
) {
  await ReactTestRenderer.act(async () => {
    for (const [label, value] of Object.entries(fields)) {
      renderer.root
        .findAllByType(AppInput)
        .find(input => input.props.label === label)!
        .props.onChangeText(value);
    }
  });
}

test.each(['OWNER', 'WAITER'] as const)(
  '%s adds a customer from an empty table and can add another after confirming the order',
  async value => {
    role = value;
    serverTables = [
      {
        id: tableId,
        tableNumber: 1,
        name: 'Table 1',
        occupied: false,
        openOrderCount: 0,
      },
    ];
    serverMenu = [
      {
        id: dishId,
        name: 'Dal Tadka',
        description: null,
        category: 'Mains',
        foodType: 'VEG',
        available: true,
        price: '180.00',
        imageUrl: null,
      },
    ];
    await saveTokens(account);
    const renderer = await render();
    await ReactTestRenderer.act(async () =>
      renderer.root.findByType(TableTile).props.onPress(),
    );
    expect(renderer.root.findAllByType(CustomersScreen)).toHaveLength(1);
    expect(renderer.root.findByType(EmptyState).props.description).toBe(
      'Start an order. Each customer has a bill.',
    );
    await press(renderer, 'Add customer');
    expect(renderer.root.findAllByType(OrderScreen)).toHaveLength(1);
    expect(
      renderer.root.findByType(OrderScreen).findByType(AppHeader).props
        .subtitle,
    ).toBe(`Table 1 · ${value === 'OWNER' ? 'Owner' : 'Waiter'}`);
    await fill(renderer, { 'Customer name': 'Priya' });
    await ReactTestRenderer.act(async () =>
      renderer.root.findByType(OrderDishRow).props.onChange(1),
    );
    await press(renderer, 'Confirm order');
    const request = adapter.mock.calls
      .map(([config]) => config)
      .find(
        config => config.url.endsWith('/orders') && config.method === 'post',
      );
    expect(request).toBeDefined();
    expect(JSON.parse(request.data)).toEqual({
      tableId,
      customerName: 'Priya',
      items: [{ dishId, quantity: 1 }],
    });
    expect(renderer.root.findAllByType(OrderScreen)).toHaveLength(0);
    expect(renderer.root.findByType(CustomerCard).props.order).toMatchObject({
      name: 'Priya',
      itemCount: 1,
      total: '180.00',
    });
    await press(renderer, 'Add customer');
    expect(renderer.root.findByType(OrderScreen).props.route.params).toEqual({
      tableId,
    });
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);
const authRequests = () =>
  adapter.mock.calls
    .map(([config]) => config)
    .filter(config => !config.url.startsWith('/api/v1/i18n/'));
async function openRegistration() {
  const renderer = await render();
  await fill(renderer, { 'Your mobile number': '9876543212' });
  await press(renderer, 'Continue');
  return renderer;
}
const registrationFields = {
  'Restaurant name': '  Test Restaurant  ',
  'Your name': '  Test Owner  ',
  Password: ' password123 ',
  'Confirm password': ' password123 ',
};

test('an unregistered phone opens restaurant registration with password fields and saves everything together', async () => {
  const renderer = await openRegistration();
  expect(authRequests().map(config => config.url)).toEqual([
    '/api/v1/auth/phone/check',
  ]);
  const registration = renderer.root.findByType(RegistrationScreen);
  expect(registration.props.route.params.phone).toBe('9876543212');
  const fields = registration.findAllByType(AppInput);
  expect(fields.map(input => input.props.label)).toEqual([
    'Restaurant name',
    'Your name',
    'Mobile number',
    'Password',
    'Confirm password',
  ]);
  expect(fields[2].props.value).toBe('9876543212');
  for (const field of fields.slice(-2)) {
    expect(field.props.secureTextEntry).toBe(true);
    expect(field.props.autoComplete).toBe('new-password');
    expect(field.props.autoCorrect).toBe(false);
  }
  await press(renderer, 'Create account');
  expect(authRequests()).toHaveLength(1);
  await fill(renderer, registrationFields);
  await press(renderer, 'Create account');
  const completion = authRequests()[1];
  expect(completion.url).toBe('/api/v1/onboarding/owner/complete');
  expect(completion.headers.has('Authorization')).toBe(false);
  expect(completion.data.get('phoneNumber')).toBe('+919876543212');
  expect(completion.data.get('password')).toBe(' password123 ');
  expect(completion.data.get('confirmPassword')).toBe(' password123 ');
  expect(completion.data.get('fullName')).toBe('Test Owner');
  expect(completion.data.get('restaurantName')).toBe('Test Restaurant');
  expect(completion.headers.get('Content-Type')).toBe('multipart/form-data');
  expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(1);
  expect(await getCredentials()).toMatchObject({
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
  });
  expect(JSON.stringify(await getCredentials())).not.toContain('password123');
  expect(renderer.root.findAllByType(TableTile)).toHaveLength(0);
  await press(renderer, 'Add first table');
  expect(renderer.root.findByType(TableTile).props.table.id).toBe(tableId);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test.each([
  [
    'short password',
    { Password: 'short', 'Confirm password': 'short' },
    'Password must be between 8 and 128 characters.',
  ],
  [
    'long password',
    { Password: 'a'.repeat(129), 'Confirm password': 'a'.repeat(129) },
    'Password must be between 8 and 128 characters.',
  ],
  [
    'missing confirmation',
    { 'Confirm password': '' },
    'Passwords do not match.',
  ],
  [
    'mismatched confirmation',
    { 'Confirm password': 'password123' },
    'Passwords do not match.',
  ],
  [
    'invalid phone',
    { 'Mobile number': '123' },
    'Enter a valid 10-digit Indian mobile number.',
  ],
] as const)(
  'registration rejects %s before calling the save API',
  async (_name, invalidFields, message) => {
    const renderer = await openRegistration();
    await fill(renderer, { ...registrationFields, ...invalidFields });
    await press(renderer, 'Create account');
    expect(authRequests()).toHaveLength(1);
    expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain(message);
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);

test.each([8, 128])(
  'registration accepts a %i character password and the edited phone',
  async length => {
    const renderer = await openRegistration();
    await fill(renderer, {
      ...registrationFields,
      'Mobile number': '9876543213',
      Password: 'a'.repeat(length),
      'Confirm password': 'a'.repeat(length),
    });
    await press(renderer, 'Create account');
    expect(authRequests()[1].data.get('password')).toBe('a'.repeat(length));
    expect(authRequests()[1].data.get('phoneNumber')).toBe('+919876543213');
    expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(1);
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);

test('failed restaurant registration keeps the form and retries the save', async () => {
  registrationFails = true;
  const renderer = await openRegistration();
  await fill(renderer, registrationFields);
  await press(renderer, 'Create account');
  expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(0);
  expect(renderer.root.findAllByType(RegistrationScreen)).toHaveLength(1);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'The server is unavailable. Please try again later.',
  );
  expect(
    renderer.root
      .findAllByType(AppInput)
      .find(input => input.props.label === 'Password')!.props.value,
  ).toBe(' password123 ');
  registrationFails = false;
  await press(renderer, 'Create account');
  expect(
    authRequests().filter(config =>
      config.url.endsWith('/onboarding/owner/complete'),
    ),
  ).toHaveLength(2);
  expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(1);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test.each(['OWNER', 'WAITER'] as const)(
  'registered %s phone reveals a password and signs in after valid credentials',
  async value => {
    role = value;
    const renderer = await render();
    await fill(renderer, { 'Your mobile number': '9876543210' });
    await press(renderer, 'Continue');
    expect(renderer.root.findAllByType(RegistrationScreen)).toHaveLength(0);
    expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(0);
    expect(authRequests().map(config => config.url)).toEqual([
      '/api/v1/auth/phone/check',
    ]);
    const password = renderer.root
      .findAllByType(AppInput)
      .find(input => input.props.label === 'Password')!;
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoComplete).toBe('current-password');
    expect(password.props.value).toBe('');
    await press(renderer, 'Sign in');
    expect(authRequests()).toHaveLength(1);
    await fill(renderer, { Password: 'wrong-password' });
    await press(renderer, 'Sign in');
    expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Phone number or password is incorrect.',
    );
    expect(await getCredentials()).toBeNull();
    await fill(renderer, { Password: ' password123 ' });
    await press(renderer, 'Sign in');
    const requests = authRequests().filter(
      config => config.url === '/api/v1/auth/login',
    );
    expect(requests).toHaveLength(2);
    expect(JSON.parse(requests[1].data)).toEqual({
      phoneNumber: '+919876543210',
      password: ' password123 ',
    });
    expect(requests.every(config => !config.headers.has('Authorization'))).toBe(
      true,
    );
    expect(renderer.root.findAllByType(DashboardScreen)).toHaveLength(1);
    await ReactTestRenderer.act(async () =>
      renderer.root
        .findByType(FloatingTabBar)
        .props.navigation.navigate('Settings'),
    );
    expect(
      renderer.root
        .findAllByType(SettingsRow)
        .some(row => row.props.title === 'Waiter team'),
    ).toBe(value === 'OWNER');
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);

test('changing the phone clears the password and checks the new number before registration', async () => {
  const renderer = await render();
  await fill(renderer, { 'Your mobile number': '9876543210' });
  await press(renderer, 'Continue');
  await fill(renderer, { Password: 'old-password' });
  await fill(renderer, { 'Your mobile number': '9876543211' });
  expect(renderer.root.findAllByType(AppInput)).toHaveLength(1);
  await press(renderer, 'Continue');
  expect(
    renderer.root
      .findAllByType(AppInput)
      .find(input => input.props.label === 'Password')!.props.value,
  ).toBe('');
  await fill(renderer, { 'Your mobile number': '9876543212' });
  await press(renderer, 'Continue');
  expect(
    authRequests().map(config => [
      config.url,
      JSON.parse(config.data).phoneNumber,
    ]),
  ).toEqual([
    ['/api/v1/auth/phone/check', '+919876543210'],
    ['/api/v1/auth/phone/check', '+919876543211'],
    ['/api/v1/auth/phone/check', '+919876543212'],
  ]);
  expect(
    renderer.root.findByType(RegistrationScreen).props.route.params.phone,
  ).toBe('9876543212');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('an invalid phone makes no lookup request', async () => {
  const renderer = await render();
  await fill(renderer, { 'Your mobile number': '123' });
  await press(renderer, 'Continue');
  expect(authRequests()).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Enter a valid 10-digit Indian mobile number.',
  );
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test.each(['network', 'invalid response'])(
  'a phone lookup %s failure stays on the phone screen',
  async failure => {
    phoneCheckFails = failure === 'network';
    phoneCheckInvalid = failure === 'invalid response';
    const renderer = await render();
    await fill(renderer, { 'Your mobile number': '9876543210' });
    await press(renderer, 'Continue');
    expect(renderer.root.findAllByType(RegistrationScreen)).toHaveLength(0);
    expect(renderer.root.findAllByType(AppInput)).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      failure === 'network'
        ? 'Unable to connect. Please check your connection.'
        : 'The backend returned an invalid phone lookup response.',
    );
    expect(authRequests().map(config => config.url)).toEqual([
      '/api/v1/auth/phone/check',
    ]);
    phoneCheckFails = false;
    phoneCheckInvalid = false;
    await press(renderer, 'Continue');
    expect(renderer.root.findAllByType(AppInput)).toHaveLength(2);
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);

test('rapid registration submissions send one save request', async () => {
  const renderer = await openRegistration();
  await fill(renderer, registrationFields);
  await ReactTestRenderer.act(async () => {
    const submit = renderer.root
      .findAllByType(AppButton)
      .find(button => button.props.children === 'Create account')!.props
      .onPress;
    await Promise.all([submit(), submit()]);
  });
  expect(
    authRequests().filter(config =>
      config.url.endsWith('/onboarding/owner/complete'),
    ),
  ).toHaveLength(1);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('owners assign a valid password when adding a waiter account', async () => {
  await saveTokens(account);
  const renderer = await render();
  // Native refresh controls contain React objects; inspect displayed text directly.
  const textContent = () =>
    renderer.root
      .findAllByType(AppText)
      .map(node => node.props.children)
      .filter(value => typeof value === 'string')
      .join('\n');
  await ReactTestRenderer.act(async () =>
    renderer.root
      .findByType(FloatingTabBar)
      .props.navigation.navigate('Settings'),
  );
  await ReactTestRenderer.act(async () =>
    renderer.root
      .findAllByType(SettingsRow)
      .find(row => row.props.title === 'Waiter team')!
      .props.onPress(),
  );
  await press(renderer, 'Add waiter');
  await fill(renderer, {
    'Waiter name': '  New Waiter  ',
    'Mobile number': '9876543214',
    Password: 'short',
  });
  await press(renderer, 'Add waiter');
  expect(
    adapter.mock.calls.some(
      ([config]) => config.url.endsWith('/waiters') && config.method === 'post',
    ),
  ).toBe(false);
  expect(textContent()).toContain(
    'Password must be between 8 and 128 characters.',
  );
  await fill(renderer, { Password: ' waiter-password ' });
  await press(renderer, 'Add waiter');
  const request = adapter.mock.calls.find(
    ([config]) => config.url.endsWith('/waiters') && config.method === 'post',
  )![0];
  expect(JSON.parse(request.data)).toEqual({
    fullName: 'New Waiter',
    phoneNumber: '+919876543214',
    password: ' waiter-password ',
  });
  expect(request.headers.get('Authorization')).toBe('Bearer access-token');
  expect(textContent()).toContain('New Waiter');
  expect(textContent()).not.toContain('waiter-password');
  await ReactTestRenderer.act(async () => renderer.unmount());
});
