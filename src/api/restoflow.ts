import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './client';
import { ENV } from '../config/env';
import type { CustomerBill } from './billing';
import type {
  AccountProfile,
  ApiBill,
  ApiDish,
  ApiOrder,
  ApiOrderSummary,
  ApiTable,
  ApiUser,
  ApiWaiter,
  AuthResult,
  ChangePasswordInput,
  Dashboard,
  OwnerRegistrationInput,
  Subscription,
} from './types';
import type {
  CustomerOrder,
  Dish,
  ProfilePhoto,
  Restaurant,
  Session,
  Waiter,
} from '../features/restaurant/types';
export async function requestData<T>(
  method: string,
  path: string,
  data?: unknown,
  config: AxiosRequestConfig = {},
): Promise<T> {
  const response = await apiClient.request({
    method,
    url: path,
    data,
    ...config,
  });
  if (response.data?.success !== true || response.data.data === undefined)
    throw new Error('The backend returned an invalid response.');
  return response.data.data as T;
}
export function mediaUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  const url = new URL(path, ENV.API_BASE_URL);
  if (
    url.origin !== ENV.API_BASE_URL ||
    !url.pathname.startsWith('/api/v1/media/') ||
    url.username ||
    url.password
  )
    throw new Error('The media origin does not match this application.');
  return url.href;
}
export function profileDetails(
  user: ApiUser,
): Pick<Session, 'userId' | 'name' | 'phone' | 'photo'> {
  if (
    !user ||
    typeof user.id !== 'string' ||
    !user.id ||
    typeof user.fullName !== 'string' ||
    user.fullName.trim().length < 2 ||
    user.fullName.trim().length > 100 ||
    typeof user.phoneNumber !== 'string' ||
    !user.phoneNumber.trim() ||
    (user.profileImageUrl !== null && typeof user.profileImageUrl !== 'string')
  )
    throw new Error('The backend returned an invalid profile.');
  return {
    userId: user.id,
    name: user.fullName,
    phone: user.phoneNumber,
    photo: mediaUrl(user.profileImageUrl),
  };
}
export function profileSession(profile: AccountProfile): Session {
  const restaurant = profile.restaurants[0];
  if (!restaurant)
    throw new Error('This account has no active restaurant membership.');
  return {
    ...profileDetails(profile.user),
    restaurantId: restaurant.id,
    restaurants: profile.restaurants,
    role: restaurant.role === 'OWNER' ? 'owner' : 'waiter',
  };
}
export function photoForm(
  fields: Record<string, string>,
  image?: ProfilePhoto,
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  if (image) body.append('image', image as unknown as Blob);
  return body;
}
export const authApi = {
  checkPhone: async (phoneNumber: string) => {
    const result = await requestData<{ registered: boolean }>(
      'POST',
      '/api/v1/auth/phone/check',
      { phoneNumber },
      { sessionAuth: false },
    );
    if (typeof result?.registered !== 'boolean')
      throw new Error('The backend returned an invalid phone lookup response.');
    return result;
  },
  login: (phoneNumber: string, password: string) =>
    requestData<AuthResult>(
      'POST',
      '/api/v1/auth/login',
      { phoneNumber, password },
      { sessionAuth: false },
    ),
  register: (input: OwnerRegistrationInput, image?: ProfilePhoto) =>
    requestData<AuthResult>(
      'POST',
      '/api/v1/onboarding/owner/complete',
      photoForm({ ...input }, image),
      { sessionAuth: false },
    ),
  me: (signal?: AbortSignal) =>
    requestData<AccountProfile>('GET', '/api/v1/auth/me', undefined, {
      signal,
    }),
  updateProfile: (fullName: string, image?: ProfilePhoto) =>
    requestData<ApiUser>(
      'PATCH',
      '/api/v1/auth/me',
      photoForm({ fullName: fullName.trim() }, image),
    ),
  changePassword: (input: ChangePasswordInput) =>
    requestData<{ passwordChanged: true }>(
      'POST',
      '/api/v1/auth/password',
      input,
    ).then(result => {
      if (result?.passwordChanged !== true)
        throw new Error('The backend did not confirm the password change.');
      return result;
    }),
  logout: () => requestData<{ loggedOut: true }>('POST', '/api/v1/auth/logout'),
};
const base = (restaurantId: string) =>
  `/api/v1/restaurants/${encodeURIComponent(restaurantId)}`;
export async function listPages<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T[]> {
  const records: T[] = [];
  for (let offset = 0; offset <= 1_000_000; offset += 100) {
    const page = await requestData<T[]>('GET', path, undefined, {
      params: { ...params, limit: 100, offset },
      signal,
    });
    if (!Array.isArray(page))
      throw new Error('The backend returned an invalid list.');
    records.push(...page);
    if (page.length < 100) return records;
  }
  throw new Error('The result is too large. Please narrow the filters.');
}
export function customerOrder(
  order: ApiOrderSummary | ApiOrder,
): CustomerOrder {
  return {
    id: order.id,
    name: order.customerName ?? '',
    items: 'items' in order ? order.items : [],
    itemCount: order.itemCount,
    total: order.total,
    createdAt: order.createdAt,
  };
}
export function menuDish(dish: ApiDish): Dish {
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description ?? '',
    price: Number(dish.price),
    category: dish.category,
    foodType: dish.foodType,
    available: dish.available,
    imageUrl: mediaUrl(dish.imageUrl),
  };
}
export function waiterDetails(waiter: ApiWaiter): Waiter {
  return {
    id: waiter.id,
    name: waiter.fullName,
    phone: waiter.phoneNumber,
    photo: mediaUrl(waiter.profileImageUrl),
  };
}
export const restaurantApi = {
  subscription: (id: string, signal?: AbortSignal) =>
    requestData<Subscription>('GET', `${base(id)}/subscription`, undefined, {
      signal,
    }),
  createTable: (id: string) =>
    requestData<{ id: string; tableNumber: number; name: string }>(
      'POST',
      `${base(id)}/tables`,
    ),
  deleteTable: (id: string, tableId: string) =>
    requestData<{ deleted: true }>(
      'DELETE',
      `${base(id)}/tables/${encodeURIComponent(tableId)}`,
    ),
  createWaiter: (
    id: string,
    fullName: string,
    phoneNumber: string,
    image?: ProfilePhoto,
  ) =>
    requestData<ApiWaiter>(
      'POST',
      `${base(id)}/waiters`,
      image
        ? photoForm({ fullName, phoneNumber }, image)
        : { fullName, phoneNumber },
    ),
  listWaiters: (id: string, signal?: AbortSignal) =>
    listPages<ApiWaiter>(`${base(id)}/waiters`, { status: 'ACTIVE' }, signal),
  getOrder: (id: string, orderId: string, signal?: AbortSignal) =>
    requestData<ApiOrder>(
      'GET',
      `${base(id)}/orders/${encodeURIComponent(orderId)}`,
      undefined,
      { signal },
    ),
  createOrder: (
    id: string,
    tableId: string,
    customerName: string,
    items: { dishId: string; quantity: number }[],
  ) =>
    requestData<ApiOrder>('POST', `${base(id)}/orders`, {
      tableId,
      customerName,
      items,
    }),
  renameOrder: (id: string, orderId: string, customerName: string) =>
    requestData<ApiOrder>(
      'PATCH',
      `${base(id)}/orders/${encodeURIComponent(orderId)}`,
      { customerName },
    ),
  replaceOrderItems: (
    id: string,
    orderId: string,
    expectedOrderUpdatedAt: string,
    items: {
      id?: string;
      dishId: string | null;
      quantity: number;
      note?: string | null;
    }[],
  ) =>
    requestData<ApiOrder>(
      'PUT',
      `${base(id)}/orders/${encodeURIComponent(orderId)}/items`,
      { expectedOrderUpdatedAt, items },
    ),
  addItem: (id: string, orderId: string, dishId: string, quantity: number) =>
    requestData(
      'POST',
      `${base(id)}/orders/${encodeURIComponent(orderId)}/items`,
      { dishId, quantity },
    ),
  updateItem: (id: string, orderId: string, itemId: string, quantity: number) =>
    requestData(
      'PATCH',
      `${base(id)}/orders/${encodeURIComponent(
        orderId,
      )}/items/${encodeURIComponent(itemId)}`,
      { quantity },
    ),
  removeItem: (id: string, orderId: string, itemId: string) =>
    requestData(
      'DELETE',
      `${base(id)}/orders/${encodeURIComponent(
        orderId,
      )}/items/${encodeURIComponent(itemId)}`,
    ),
  bill: (id: string, orderId: string, signal?: AbortSignal) =>
    requestData<ApiBill>(
      'GET',
      `${base(id)}/orders/${encodeURIComponent(orderId)}/bill`,
      undefined,
      { signal },
    ),
  closeOrder: (id: string, orderId: string) =>
    requestData<CustomerBill>(
      'POST',
      `${base(id)}/orders/${encodeURIComponent(orderId)}/close`,
    ),
};
export async function fetchRestaurant(
  session: Session,
  signal?: AbortSignal,
): Promise<Restaurant> {
  const id = session.restaurantId;
  const summary = session.restaurants.find(value => value.id === id)!;
  const subscription = await restaurantApi.subscription(id, signal);
  const restaurant: Restaurant = {
    id,
    name: summary.name,
    owner: '',
    phone: '',
    isPremium: subscription.plan === 'LIFETIME',
    trialStartedAt: subscription.trialStartedAt,
    trialEndsAt: subscription.trialEndsAt,
    subscription,
    tables: [],
    waiters: [],
    menu: [],
    dashboard: null,
  };
  if (!subscription.isActive) return restaurant;
  const [detail, tables, menu, openOrders, dashboard, waiters] =
    await Promise.all([
      requestData<{ name: string; owner: ApiUser }>(
        'GET',
        base(id),
        undefined,
        { signal },
      ),
      listPages<ApiTable>(`${base(id)}/tables`, {}, signal),
      listPages<ApiDish>(`${base(id)}/menu/dishes`, {}, signal),
      listPages<ApiOrderSummary>(
        `${base(id)}/orders`,
        { closed: 'false' },
        signal,
      ),
      requestData<Dashboard>('GET', `${base(id)}/dashboard`, undefined, {
        signal,
      }),
      session.role === 'owner'
        ? restaurantApi.listWaiters(id, signal)
        : Promise.resolve([]),
    ]);
  return {
    ...restaurant,
    name: detail.name,
    owner: detail.owner.fullName,
    phone: detail.owner.phoneNumber,
    photo: mediaUrl(detail.owner.profileImageUrl),
    dashboard,
    menu: menu.map(menuDish),
    waiters: waiters.map(waiterDetails),
    tables: tables.map(value => ({
      id: value.id,
      number: value.tableNumber,
      occupied: value.occupied,
      guestCount: value.openOrderCount,
      customers: openOrders
        .filter(order => order.tableId === value.id)
        .map(customerOrder),
    })),
  };
}
