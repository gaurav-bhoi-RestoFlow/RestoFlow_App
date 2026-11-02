import { filterMenu, menuCategories } from '../src/features/menu/menuData';
import {
  changeQuantity,
  countOrderItems,
  paiseMoney,
  pricePaise,
} from '../src/features/orders/orderCalculations';
import { toE164Phone } from '../src/features/auth/validation';
import { createReceiptHtml } from '../src/features/billing/receiptPrinting';
import { formatCurrency } from '../src/utils/currency';
import { mediaUrl, profileDetails, profileSession } from '../src/api/restoflow';
import { account, bill, DEV_ORIGIN, PROD_ORIGIN } from './support/apiFixtures';
import type { Dish } from '../src/features/restaurant/types';
const menu: Dish[] = [
  {
    id: 'uuid-one',
    name: 'Rice',
    price: 150,
    description: '',
    category: 'Custom category',
    foodType: 'VEG',
    available: true,
  },
  {
    id: 'uuid-two',
    name: 'Tea',
    price: 25,
    description: '',
    category: 'Beverages',
    foodType: 'VEG',
    available: true,
  },
];
test('menu categories and search use server dishes instead of fixed IDs', () => {
  expect(menuCategories(menu)).toEqual(['All', 'Beverages', 'Custom category']);
  expect(
    filterMenu(menu, ' RICE ', 'Custom category').map(dish => dish.id),
  ).toEqual(['uuid-one']);
  expect(filterMenu(menu, 'rice', 'Beverages')).toEqual([]);
});
test('quantities are local drafts only and stay within API bounds', () => {
  expect(changeQuantity({ item: 1 }, 'item', -2)).toEqual({});
  expect(changeQuantity({ item: 9999 }, 'item', 5)).toEqual({ item: 10000 });
  expect(countOrderItems({ a: 2, b: 3 })).toBe(5);
});
test('draft prices and displayed server totals retain exact paise', () => {
  expect(paiseMoney(pricePaise('150.00') * 2n)).toBe('300.00');
  expect(formatCurrency('9007199254740993.01')).toBe(
    '₹9,00,71,99,25,47,40,993.01',
  );
  expect(() => pricePaise('1e3')).toThrow();
});
test('phone normalization submits E.164 to authentication endpoints', () => {
  expect(toE164Phone('9876543210')).toBe('+919876543210');
  expect(toE164Phone('+91 9876543210')).toBe('+919876543210');
  expect(() => toE164Phone('123')).toThrow();
});
test('printed receipts use server price snapshots and escape names', () => {
  const html = createReceiptHtml(
    'Kitchen & Co',
    { ...bill, customerName: '<script>Guest</script>' },
    new Date('2026-10-14T12:30:00Z'),
  );
  expect(html).toContain('&lt;script&gt;Guest&lt;/script&gt;');
  expect(html).toContain('Kitchen &amp; Co');
  expect(html).toContain('Snapshot Rice');
  expect(html).toContain('₹300');
  expect(html).not.toContain('Taxes');
});
test('session roles come from server membership and media stays on the Worker origin', () => {
  expect(profileSession(account)).toMatchObject({
    userId: account.user.id,
    restaurantId: account.restaurants[0].id,
    role: 'owner',
  });
  expect(mediaUrl('/api/v1/media/users/key.png')).toBe(
    `${DEV_ORIGIN}/api/v1/media/users/key.png`,
  );
  expect(() => mediaUrl(`${PROD_ORIGIN}/api/v1/media/key.png`)).toThrow();
});

test('saved and restored account details use the same server fields', () => {
  const user = {
    ...account.user,
    fullName: 'Saved User',
    phoneNumber: '+919123456789',
    profileImageUrl: '/api/v1/media/users/profile.jpg',
  };
  const details = profileDetails(user);
  expect(details).toEqual({
    userId: user.id,
    name: 'Saved User',
    phone: '+919123456789',
    photo: `${DEV_ORIGIN}${user.profileImageUrl}`,
  });
  expect(profileSession({ ...account, user })).toMatchObject(details);
});

test.each([
  { fullName: '' },
  { fullName: 'x'.repeat(101) },
  { phoneNumber: '' },
  { profileImageUrl: undefined },
])('rejects incomplete profile responses %j', invalid => {
  expect(() =>
    profileDetails({ ...account.user, ...invalid } as typeof account.user),
  ).toThrow('The backend returned an invalid profile.');
});
