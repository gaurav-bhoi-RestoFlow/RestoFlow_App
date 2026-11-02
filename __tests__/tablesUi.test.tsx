import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import '../src/localization/i18n';
import { apiClient } from '../src/api/client';
import { profileSession } from '../src/api/restoflow';
import { saveTokens } from '../src/services/auth/credentials';
import { RestaurantProvider } from '../src/features/restaurant/RestaurantProvider';
import { DashboardScreen } from '../src/features/tables/DashboardScreen';
import { TableTile } from '../src/features/tables/TableTile';
import { CustomersScreen } from '../src/features/orders/CustomersScreen';
import { CustomerCard } from '../src/features/orders/CustomerCard';
import { AppText } from '../src/components/AppText';
import { AppHeader } from '../src/components/AppHeader';
import { AppButton } from '../src/components/AppButton';
import { ConfirmationSheet } from '../src/components/ConfirmationSheet';
import { Screen } from '../src/components/Screen';
import type {
  HomeTabsParams,
  RootStackParams,
} from '../src/app/navigationTypes';
import { account, restaurantId, subscription } from './support/apiFixtures';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

let mockSession = profileSession(account);
jest.mock('../src/features/auth/SessionProvider', () => ({
  useSession: () => ({ session: mockSession, signOut: jest.fn() }),
}));
const Stack = createNativeStackNavigator<RootStackParams>();
const navigation = createNavigationContainerRef<RootStackParams>();
const tabNavigation = {
  navigate: jest.fn(),
} as unknown as BottomTabScreenProps<HomeTabsParams, 'Dashboard'>['navigation'];
const originalAdapter = apiClient.defaults.adapter;
const root = `/api/v1/restaurants/${restaurantId}`;
const tableIds = [1, 2, 3].map(
  value => `30000000-0000-4000-8000-${String(value).padStart(12, '0')}`,
);
let renderer: ReactTestRenderer.ReactTestRenderer;

function tableServer() {
  const orders = [
    {
      id: 'shared-customer',
      tableId: tableIds[2],
      customerName: 'Asha',
      itemCount: 2,
      total: '200.00',
      createdAt: '2026-11-02T10:00:00Z',
    },
  ];
  let tables = tableIds.map((id, index) => ({
    id,
    tableNumber: index + 1,
    name: `Table ${index + 1}`,
    occupied: index === 2,
    openOrderCount: index === 2 ? 1 : 0,
  }));
  function removeFirst() {
    tables = tables.slice(1).map((table, index) => ({
      ...table,
      tableNumber: index + 1,
      name: `Table ${index + 1}`,
    }));
  }
  function addCustomer(tableId: string, name: string) {
    orders.push({ ...orders[0], id: name, tableId, customerName: name });
    const table = tables.find(value => value.id === tableId)!;
    table.occupied = true;
    table.openOrderCount += 1;
  }
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    let data: unknown;
    if (config.url === `${root}/tables` && config.method === 'post') {
      const number = tables.length + 1;
      const table = {
        id: '30000000-0000-4000-8000-000000000004',
        tableNumber: number,
        name: `Table ${number}`,
        occupied: false,
        openOrderCount: 0,
      };
      tables.push(table);
      data = table;
    } else if (
      config.url === `${root}/tables/${tableIds[0]}` &&
      config.method === 'delete'
    ) {
      const table = tables.find(value => value.id === tableIds[0]);
      if (!table || table.occupied)
        throw new AxiosError(
          'Cannot delete table',
          undefined,
          config,
          undefined,
          {
            data: {
              success: false,
              error: table
                ? {
                    code: 'TABLE_HAS_OPEN_ORDER',
                    message: 'Close open orders before removing this table.',
                  }
                : { code: 'TABLE_NOT_FOUND', message: 'Table was not found.' },
            },
            status: table ? 409 : 404,
            statusText: '',
            headers: { 'x-restoflow-environment': 'development' },
            config,
          },
        );
      removeFirst();
      data = { deleted: true };
    } else if (config.url === `${root}/subscription`) data = subscription;
    else if (config.url === root)
      data = { name: 'Test Restaurant', owner: account.user };
    else if (config.url === `${root}/tables`) data = tables.slice();
    else if (config.url === `${root}/dashboard`)
      data = {
        totalTables: tables.length,
        occupiedTables: tables.filter(table => table.occupied).length,
        availableTables: tables.filter(table => !table.occupied).length,
        guestCount: orders.length,
        openOrderTotal: '200.00',
        currency: 'INR',
      };
    else if (config.url?.endsWith('/customers')) {
      const table = tables.find(
        value => config.url === `${root}/tables/${value.id}/customers`,
      )!;
      const customers = orders
        .filter(order => order.tableId === table.id)
        .map(order => ({
          orderId: order.id,
          name: order.customerName,
          createdAt: order.createdAt,
          items: [],
          orderItems: [],
          itemCount: 3,
          orderItemCount: order.itemCount,
          total: '300.00',
          orderTotal: order.total,
          orderChanged: false,
        }));
      data = {
        table: { id: table.id, name: table.name },
        guestCount: customers.length,
        customers,
        pagination: { total: customers.length, hasMore: false },
      };
    } else if (config.url === `${root}/orders`) data = orders.slice();
    else if (
      config.url === `${root}/menu/dishes` ||
      config.url === `${root}/waiters`
    )
      data = [];
    else
      throw new Error(
        `Unexpected table test request: ${config.method} ${config.url}`,
      );
    return {
      data: { success: true, data },
      status: 200,
      statusText: '',
      headers: { 'x-restoflow-environment': 'development' },
      config,
    };
  });
  return { adapter, removeFirst, addCustomer };
}
function Home() {
  return (
    <DashboardScreen
      navigation={tabNavigation}
      route={{ key: 'dashboard', name: 'Dashboard' }}
    />
  );
}
function Empty() {
  return null;
}
async function render() {
  await saveTokens(account);
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider>
        <RestaurantProvider>
          <NavigationContainer ref={navigation}>
            <Stack.Navigator
              screenOptions={{ headerShown: false, animation: 'none' }}
            >
              <Stack.Screen name="Home" component={Home} />
              <Stack.Screen name="Language" component={Empty} />
              <Stack.Screen name="Customers" component={CustomersScreen} />
              <Stack.Screen name="Order" component={Empty} />
              <Stack.Screen name="Bill" component={Empty} />
            </Stack.Navigator>
          </NavigationContainer>
        </RestaurantProvider>
      </SafeAreaProvider>,
    );
  });
}
function displayedTables() {
  return renderer.root.findAllByType(TableTile).map(tile => ({
    id: tile.props.table.id,
    number: tile.props.table.number,
  }));
}
async function selectFirstForRemoval() {
  const manage = renderer.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(control =>
      control
        .findAllByType(AppText)
        .some(text => text.props.children === 'Manage'),
    );
  expect(manage).toBeDefined();
  await act(async () => manage!.props.onPress());
  await act(async () =>
    renderer.root.findAllByType(TableTile)[0].props.onRemove(),
  );
}
beforeEach(() => {
  mockSession = profileSession(account);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  apiClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

test('deleting Table 1 refreshes displayed numbers and keeps customers on their original table UUID', async () => {
  const server = tableServer();
  apiClient.defaults.adapter = server.adapter;
  await render();
  expect(displayedTables().map(table => table.number)).toEqual([1, 2, 3]);
  await selectFirstForRemoval();
  await act(async () =>
    renderer.root.findByType(ConfirmationSheet).props.onConfirm(),
  );
  expect(displayedTables()).toEqual([
    { id: tableIds[1], number: 1 },
    { id: tableIds[2], number: 2 },
  ]);
  expect(renderer.root.findAllByType(TableTile)[1].props.table).toMatchObject({
    occupied: true,
    customers: [{ id: 'shared-customer', name: 'Asha', total: '200.00' }],
  });
  const add = renderer.root
    .findAllByType(AppButton)
    .find(button => button.props.children === 'Add table');
  expect(add).toBeDefined();
  await act(async () => add!.props.onPress());
  expect(displayedTables().map(table => table.number)).toEqual([1, 2, 3]);
  expect(
    server.adapter.mock.calls.filter(([config]) => config.method === 'delete'),
  ).toHaveLength(1);
});

test.each(['focus', 'pull to refresh'])(
  'waiters see owner renumbering on dashboard %s',
  async mode => {
    mockSession = { ...profileSession(account), role: 'waiter' };
    const server = tableServer();
    apiClient.defaults.adapter = server.adapter;
    await render();
    expect(
      renderer.root
        .findAllByType(TableTile)
        .every(tile => !tile.props.onRemove),
    ).toBe(true);
    expect(
      renderer.root
        .findAllByType(AppButton)
        .some(button =>
          ['Add table', 'Add first table'].includes(button.props.children),
        ),
    ).toBe(false);
    if (mode === 'focus')
      await act(async () => navigation.navigate('Language'));
    server.removeFirst();
    if (mode === 'focus') await act(async () => navigation.goBack());
    else
      await act(async () => renderer.root.findByType(Screen).props.onRefresh());
    expect(displayedTables()).toEqual([
      { id: tableIds[1], number: 1 },
      { id: tableIds[2], number: 2 },
    ]);
    expect(
      renderer.root.findAllByType(TableTile)[1].props.table.customers[0].name,
    ).toBe('Asha');
    expect(
      server.adapter.mock.calls.every(([config]) => config.method === 'get'),
    ).toBe(true);
  },
);

test.each(['occupied', 'deleted'])(
  'a table %s by another staff member refreshes the floor after deletion fails',
  async state => {
    const server = tableServer();
    apiClient.defaults.adapter = server.adapter;
    await render();
    await selectFirstForRemoval();
    if (state === 'occupied') server.addCustomer(tableIds[0], 'New guest');
    else server.removeFirst();
    await act(async () =>
      renderer.root.findByType(ConfirmationSheet).props.onConfirm(),
    );
    expect(renderer.root.findByType(ConfirmationSheet).props.visible).toBe(
      false,
    );
    if (state === 'occupied') {
      expect(displayedTables()).toHaveLength(3);
      expect(
        renderer.root.findAllByType(TableTile)[0].props.table,
      ).toMatchObject({
        id: tableIds[0],
        occupied: true,
        guestCount: 1,
      });
      expect(
        renderer.root.findAllByType(TableTile)[0].props.onRemove,
      ).toBeUndefined();
    } else {
      expect(displayedTables()).toEqual([
        { id: tableIds[1], number: 1 },
        { id: tableIds[2], number: 2 },
      ]);
    }
  },
);

test.each([
  ['owner', 'focus'],
  ['waiter', 'focus'],
  ['owner', 'pull to refresh'],
  ['waiter', 'pull to refresh'],
] as const)(
  '%s customer screen reloads table numbers and shared guests on %s',
  async (role, mode) => {
    mockSession = { ...profileSession(account), role };
    const server = tableServer();
    apiClient.defaults.adapter = server.adapter;
    await render();
    await act(async () =>
      renderer.root.findAllByType(TableTile)[2].props.onPress(),
    );
    expect(navigation.getCurrentRoute()).toMatchObject({
      name: 'Customers',
      params: { tableId: tableIds[2] },
    });
    const customerScreen = () => renderer.root.findByType(CustomersScreen);
    expect(customerScreen().findByType(AppHeader).props.title).toBe('Table 3');
    expect(customerScreen().findAllByType(CustomerCard)).toHaveLength(1);
    if (mode === 'focus')
      await act(async () => navigation.navigate('Language'));
    server.removeFirst();
    server.addCustomer(tableIds[2], 'Saved by another waiter');
    if (mode === 'focus') await act(async () => navigation.goBack());
    else
      await act(async () =>
        customerScreen().findByType(Screen).props.onRefresh(),
      );
    expect(customerScreen().findByType(AppHeader).props.title).toBe('Table 2');
    const cards = customerScreen().findAllByType(CustomerCard);
    expect(cards.map(card => card.props.order.name)).toEqual([
      'Asha',
      'Saved by another waiter',
    ]);
    expect(cards[1].props.order.total).toBe(
      role === 'owner' ? '300.00' : '200.00',
    );
    await act(async () => cards[1].props.onPress());
    expect(navigation.getCurrentRoute()).toMatchObject({
      name: role === 'owner' ? 'Bill' : 'Order',
      params: { tableId: tableIds[2], customerId: 'Saved by another waiter' },
    });
    expect(
      server.adapter.mock.calls.every(([config]) => config.method === 'get'),
    ).toBe(true);
  },
);
