import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import '../src/localization/i18n';
import { apiClient } from '../src/api/client';
import {
  RestaurantProvider,
  useRestaurant,
} from '../src/features/restaurant/RestaurantProvider';
import { profileSession } from '../src/api/restoflow';
import { saveTokens } from '../src/services/auth/credentials';
import { account } from './support/apiFixtures';
import { deferred, dishBase, menuServer } from './support/menuServer';
import { MenuProvider } from '../src/features/menu/MenuProvider';
import { MenuScreen } from '../src/features/menu/MenuScreen';
import { DishFormScreen } from '../src/features/menu/DishFormScreen';
import { DishCard } from '../src/features/menu/DishCard';
import { MenuFilters } from '../src/features/menu/MenuFilters';
import { DishImageSheet } from '../src/features/menu/DishImageSheet';
import { DishPhotoField } from '../src/features/menu/DishPhotoField';
import { DishImage } from '../src/features/menu/DishImage';
import { DishCategorySheet } from '../src/features/menu/DishCategorySheet';
import { dishCategories } from '../src/features/menu/menuConfig';
import { FoodTypeSelector } from '../src/features/menu/FoodTypeSelector';
import { AvailabilityField } from '../src/features/menu/AvailabilityField';
import { MenuEmptyState } from '../src/features/menu/MenuEmptyState';
import { AppText } from '../src/components/AppText';
import { Screen } from '../src/components/Screen';
import { EmptyState } from '../src/components/EmptyState';
import { DishManagementOverlay } from '../src/features/menu/DishManagementOverlay';
import { AppButton } from '../src/components/AppButton';
import { AppInput } from '../src/components/AppInput';
import { SearchInput } from '../src/components/SearchInput';
import { SheetOption } from '../src/components/SheetOption';
import { mockMenu } from './support/menuFixtures';
import type { RootStackParams } from '../src/app/navigationTypes';
import type { Dish } from '../src/features/restaurant/types';

let mockSession = profileSession(account);
jest.mock('../src/features/auth/SessionProvider', () => ({
  useSession: () => ({ session: mockSession, signOut: jest.fn() }),
}));
const Stack = createNativeStackNavigator<RootStackParams>();
const originalAdapter = apiClient.defaults.adapter;
let renderer: ReactTestRenderer.ReactTestRenderer;
let server: ReturnType<typeof menuServer>;
beforeEach(async () => {
  mockSession = profileSession(account);
  await saveTokens(account);
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'setImmediate'] });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  expect(
    server.adapter.mock.calls.every(([request]) =>
      request.url?.startsWith(
        `/api/v1/restaurants/${mockSession.restaurantId}`,
      ),
    ),
  ).toBe(true);
  apiClient.defaults.adapter = originalAdapter;
  jest.useRealTimers();
  jest.restoreAllMocks();
});
let cachedDishes: Dish[];
let refreshRestaurant: () => Promise<void>;
function ReadMenuCache() {
  const state = useRestaurant();
  cachedDishes = state.restaurant.menu;
  refreshRestaurant = state.refresh;
  return null;
}
async function render(initialDishes: Dish[] = mockMenu) {
  server = menuServer(initialDishes);
  apiClient.defaults.adapter = server.adapter;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider>
        <RestaurantProvider>
          <ReadMenuCache />
          <MenuProvider>
            <NavigationContainer>
              <Stack.Navigator
                screenOptions={{ headerShown: false, animation: 'none' }}
              >
                <Stack.Screen name="Home" component={MenuScreen} />
                <Stack.Screen name="DishForm" component={DishFormScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </MenuProvider>
        </RestaurantProvider>
      </SafeAreaProvider>,
    );
  });
  return renderer.root;
}
async function press(label: string) {
  const control = renderer.root
    .findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )
    .pop();
  expect(control).toBeDefined();
  await act(async () => control!.props.onPress());
}
async function button(label: string) {
  const control = renderer.root
    .findAllByType(AppButton)
    .find(node => node.props.children === label);
  expect(control).toBeDefined();
  await act(async () => control!.props.onPress());
}
async function field(label: string, value: string) {
  await act(async () =>
    renderer.root
      .findAllByType(AppInput)
      .find(node => node.props.label === label)!
      .props.onChangeText(value),
  );
}
function textContent() {
  return renderer.root
    .findAllByType(AppText)
    .map(node =>
      typeof node.props.children === 'string' ? node.props.children : '',
    )
    .join('\n');
}
function names() {
  return renderer.root
    .findAllByType(DishCard)
    .map(card => card.props.dish.name);
}

test('menu filters, search and clear filters show the screenshot states from the paginated API', async () => {
  const root = await render();
  expect(names()).toEqual(mockMenu.map(dish => dish.name));
  await press('Starters');
  expect(names()).toEqual(['Paneer Tikka']);
  await press('Mains');
  expect(names()).toEqual(['Dal Tadka', 'Jeera Rice']);
  await press('Drinks');
  expect(names()).toEqual(['Coca-Cola']);
  await act(async () =>
    root.findByType(SearchInput).props.onChangeText('missing dish'),
  );
  expect(names()).toEqual([]);
  await button('Clear filters');
  expect(names()).toHaveLength(6);
  expect(root.findByType(MenuFilters).props.selected).toBe('All');
});

test('dish actions toggle availability and deletion requires confirmation', async () => {
  await render();
  await press('More options for Paneer Tikka');
  await press('Mark unavailable');
  expect(renderer.root.findAllByType(DishCard)[0].props.dish.available).toBe(
    false,
  );
  expect(textContent()).toContain('Dish marked unavailable');
  await press('More options for Paneer Tikka');
  await press('Mark available');
  expect(renderer.root.findAllByType(DishCard)[0].props.dish.available).toBe(
    true,
  );
  await press('More options for Paneer Tikka');
  await press('Delete dish');
  await button('Cancel');
  expect(names()).toHaveLength(6);
  await press('More options for Paneer Tikka');
  await press('Delete dish');
  await button('Delete');
  expect(names()[0]).toBe('Dal Tadka');
  expect(names()).not.toContain('Paneer Tikka');
});

test('add form validates and saves food type, category, availability and pending server request', async () => {
  await render();
  await press('Add dish');
  await button('Add Dish');
  expect(
    renderer.root
      .findAllByType(AppInput)
      .find(input => input.props.label === 'Dish name')!.props.error,
  ).toBe('Dish name is required');
  expect(
    renderer.root
      .findAllByType(AppInput)
      .find(input => input.props.label === 'Price')!.props.error,
  ).toBe('Enter a valid price');
  await field('Dish name', 'Butter Chicken');
  await field(
    'Description · Optional',
    'Tender chicken in tomato & butter gravy.',
  );
  await field('Price', '₹250');
  await act(async () =>
    renderer.root.findByType(FoodTypeSelector).props.onChange('NON_VEG'),
  );
  await act(async () =>
    renderer.root.findByType(AvailabilityField).props.onChange(false),
  );
  await press('Category: Main Course');
  await press('Breads');
  server.controls.holdWrite = deferred();
  await button('Add Dish');
  expect(
    renderer.root
      .findAllByType(AppButton)
      .find(node => node.props.children === 'Saving…')!.props.loading,
  ).toBe(true);
  await act(async () => server.controls.holdWrite!.resolve(undefined));
  expect(names()[0]).toBe('Butter Chicken');
  expect(renderer.root.findAllByType(DishCard)[0].props.dish).toMatchObject({
    foodType: 'NON_VEG',
    available: false,
    category: 'Breads',
    price: 250,
  });
  expect(textContent()).toContain('Dish added successfully');
});

test('edits preload each dish and keep its optional photo missing while saving changes', async () => {
  await render();
  await press('More options for Dal Tadka');
  await press('Edit dish');
  expect(
    renderer.root
      .findAllByType(AppInput)
      .find(input => input.props.label === 'Dish name')!.props.value,
  ).toBe('Dal Tadka');
  expect(renderer.root.findByType(DishPhotoField).props.uri).toBe('');
  expect(renderer.root.findByType(DishPhotoField).props.category).toBe(
    'Main Course',
  );
  await field('Price', '₹200.50');
  await act(async () =>
    renderer.root.findByType(FoodTypeSelector).props.onChange('NON_VEG'),
  );
  await press('Category: Main Course');
  await press('Starters');
  await button('Save Changes');
  await act(async () => {});
  expect(renderer.root.findAllByType(DishCard)[1].props.dish).toMatchObject({
    price: 200.5,
    category: 'Starters',
    foodType: 'NON_VEG',
    imageUrl: undefined,
  });
});

test('empty menu and cancel leave the draft unsaved', async () => {
  await render([]);
  expect(renderer.root.findAllByType(MenuEmptyState)).toHaveLength(1);
  expect(renderer.root.findAllByType(SearchInput)).toHaveLength(0);
  await button('Add Dish');
  await field('Dish name', 'Unsaved dish');
  await button('Cancel');
  expect(renderer.root.findAllByType(DishCard)).toHaveLength(0);
  expect(renderer.root.findAllByType(MenuEmptyState)).toHaveLength(1);
});

test('image source sheet keeps the default, accepts a gallery image and supports camera', async () => {
  await render();
  await press('Add dish');
  await act(async () =>
    renderer.root.findByType(DishPhotoField).props.onPress(),
  );
  await button('Keep default image');
  expect(renderer.root.findByType(DishPhotoField).props.uri).toBe('');
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [{ uri: 'file:///dish.jpg', fileSize: 500, type: 'image/jpeg' }],
  });
  await act(async () =>
    renderer.root.findByType(DishPhotoField).props.onPress(),
  );
  await act(async () =>
    renderer.root
      .findAllByType(SheetOption)
      .find(option => option.props.label === 'Choose from gallery')!
      .props.onPress(),
  );
  expect(renderer.root.findByType(DishPhotoField).props.uri).toBe(
    'file:///dish.jpg',
  );
  expect(renderer.root.findByType(DishImageSheet).props.visible).toBe(false);
  jest.mocked(launchCamera).mockResolvedValueOnce({
    assets: [
      { uri: 'file:///camera-dish.jpg', fileSize: 800, type: 'image/jpeg' },
    ],
  });
  await act(async () =>
    renderer.root.findByType(DishPhotoField).props.onPress(),
  );
  await act(async () =>
    renderer.root
      .findAllByType(SheetOption)
      .find(option => option.props.label === 'Take photo')!
      .props.onPress(),
  );
  expect(renderer.root.findByType(DishPhotoField).props.uri).toBe(
    'file:///camera-dish.jpg',
  );
});

test('waiters can browse menu but cannot edit dishes or open the owner ledger', async () => {
  mockSession = { ...mockSession, role: 'waiter' };
  await render();
  expect(
    renderer.root.findAllByType(DishCard).every(card => !card.props.onMore),
  ).toBe(true);
  expect(
    renderer.root.findAll(
      control => control.props.accessibilityLabel === 'Add dish',
    ).length > 0,
  ).toBe(false);
  await press('Switch restaurant workspace');
  expect(
    renderer.root
      .findAllByType(SheetOption)
      .find(option => option.props.label === 'Ledger')!.props.disabled,
  ).toBe(true);
});

test('all seven category previews update immediately, and pending photos survive switches and picker cancellation', async () => {
  await render();
  await press('Add dish');
  const preview = () => renderer.root.findByType(DishPhotoField);
  expect(preview().props).toMatchObject({ category: 'Main Course', uri: '' });
  for (const category of dishCategories) {
    await press(`Category: ${preview().props.category}`);
    const options = renderer.root
      .findByType(DishCategorySheet)
      .findAllByType(SheetOption);
    expect(options.map(option => option.props.label)).toEqual(dishCategories);
    expect(options.every(option => option.props.numberOfLines === 1)).toBe(
      true,
    );
    expect(options.filter(option => option.props.selected)).toHaveLength(1);
    expect(
      options.map(option => option.findByType(DishImage).props.category),
    ).toEqual(dishCategories);
    await press(category);
    expect(preview().props).toMatchObject({ category, uri: '' });
    expect(preview().findByType(DishImage).props.category).toBe(category);
  }
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [
      { uri: 'file:///selected.jpg', type: 'image/jpeg', fileSize: 500 },
    ],
  });
  await act(async () => preview().props.onPress());
  await press('Choose from gallery');
  await press('Category: Other');
  await press('Desserts');
  expect(preview().props).toMatchObject({
    category: 'Desserts',
    uri: 'file:///selected.jpg',
  });
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
  await act(async () => preview().props.onPress());
  await press('Choose from gallery');
  expect(preview().props.uri).toBe('file:///selected.jpg');
  await press('Remove selected photo');
  expect(preview().props).toMatchObject({ category: 'Desserts', uri: '' });
  await field('Dish name', 'Photo-less dessert');
  await field('Price', '80');
  await button('Add Dish');
  const request = server.adapter.mock.calls.find(
    ([value]) => value.method === 'post',
  )![0];
  expect(request.data.get('image')).toBeNull();
  expect(cachedDishes[0]).toMatchObject({
    category: 'Desserts',
    imageUrl: undefined,
  });
  await press('More options for Photo-less dessert');
  await press('Edit dish');
  expect(preview().props).toMatchObject({ category: 'Desserts', uri: '' });
});

test('edit keeps existing uploads and unknown categories without inventing photo data', async () => {
  await render([{ ...mockMenu[0], category: 'Seasonal' }]);
  server.dishes[0].imageUrl = '/api/v1/media/restaurants/test/existing.jpg';
  await press('More options for Paneer Tikka');
  await press('Edit dish');
  const preview = () => renderer.root.findByType(DishPhotoField);
  const savedUri = preview().props.uri;
  expect(savedUri).toContain('existing.jpg');
  expect(preview().props.category).toBe('Seasonal');
  await press('Category: Seasonal');
  await press('Rice');
  expect(preview().props.uri).toBe(savedUri);
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [
      { uri: 'file:///replacement.jpg', type: 'image/jpeg', fileSize: 500 },
    ],
  });
  await act(async () => preview().props.onPress());
  await press('Choose from gallery');
  await act(async () => preview().props.onPress());
  await press('Remove selected photo');
  expect(preview().props.uri).toBe(savedUri);
  await button('Save Changes');
  const request = server.adapter.mock.calls.find(
    ([value]) => value.method === 'patch',
  )![0];
  expect(request.data.get('image')).toBeNull();
  expect(cachedDishes[0].imageUrl).toBe(savedUri);
  server.dishes[0].imageUrl = null;
  server.dishes[0].category = 'Seasonal';
  for (let reopen = 0; reopen < 2; reopen += 1) {
    await press('More options for Paneer Tikka');
    await press('Edit dish');
    expect(preview().props).toMatchObject({ category: 'Seasonal', uri: '' });
    await button('Cancel');
  }
});

test('server-confirmed changes also update the restaurant cache used by ordering', async () => {
  await render();
  await press('More options for Paneer Tikka');
  await press('Mark unavailable');
  expect(cachedDishes[0].available).toBe(false);
  const patch = server.adapter.mock.calls.find(
    ([request]) => request.method === 'patch',
  )![0];
  expect(patch.data.get('available')).toBe('false');
  expect(patch.data.get('name')).toBeNull();
  expect(patch.headers.get('Content-Type')).toBe('multipart/form-data');
  expect(patch.headers.get('Authorization')).toBe('Bearer access-token');
  await press('More options for Paneer Tikka');
  await press('Delete dish');
  await button('Delete');
  expect(cachedDishes.some(dish => dish.name === 'Paneer Tikka')).toBe(false);
});

test('editing loads fresh details rather than using the menu snapshot', async () => {
  await render();
  server.dishes[0].description = 'Fresh detail from backend';
  await press('More options for Paneer Tikka');
  await press('Edit dish');
  expect(
    renderer.root
      .findAllByType(AppInput)
      .find(input => input.props.label === 'Description · Optional')!.props
      .value,
  ).toBe('Fresh detail from backend');
  expect(
    server.adapter.mock.calls.some(
      ([request]) =>
        request.url === `${dishBase}/${server.dishes[0].id}` &&
        request.method === 'get',
    ),
  ).toBe(true);
});

test('failed creates retain the draft and can retry without an optimistic dish or success toast', async () => {
  await render();
  await press('Add dish');
  await field('Dish name', 'Retry dish');
  await field('Price', '250.50');
  server.controls.failure = { method: 'post', status: 500 };
  await button('Add Dish');
  expect(
    renderer.root
      .findAllByType(AppInput)
      .find(input => input.props.label === 'Dish name')!.props.value,
  ).toBe('Retry dish');
  expect(textContent()).toContain(
    'The server is unavailable. Please try again later.',
  );
  expect(cachedDishes.some(dish => dish.name === 'Retry dish')).toBe(false);
  expect(textContent()).not.toContain('Dish added successfully');
  await button('Add Dish');
  expect(names()[0]).toBe('Retry dish');
  expect(cachedDishes[0].price).toBe(250.5);
});

test('failed availability and delete requests preserve saved dishes and keep retry controls open', async () => {
  await render();
  await press('More options for Paneer Tikka');
  server.controls.failure = {
    method: 'patch',
    status: 403,
    message: 'You do not have permission to change this dish.',
  };
  await press('Mark unavailable');
  expect(cachedDishes[0].available).toBe(true);
  expect(renderer.root.findByType(DishManagementOverlay).props.error).toContain(
    'permission',
  );
  await press('Mark unavailable');
  expect(cachedDishes[0].available).toBe(false);
  await press('More options for Paneer Tikka');
  await press('Delete dish');
  server.controls.failure = { method: 'delete', status: 500 };
  await button('Delete');
  expect(names()).toContain('Paneer Tikka');
  expect(
    renderer.root.findByType(DishManagementOverlay).props.selection
      .confirmingDelete,
  ).toBe(true);
  await button('Delete');
  expect(names()).not.toContain('Paneer Tikka');
});

test('detail failures can retry and missing dishes show the unavailable state', async () => {
  await render();
  const url = `${dishBase}/${server.dishes[0].id}`;
  server.controls.failure = { method: 'get', status: 503, url };
  await press('More options for Paneer Tikka');
  await press('Edit dish');
  expect(renderer.root.findAllByType(AppInput)).toHaveLength(0);
  expect(renderer.root.findByType(EmptyState).props.title).toBe(
    'Could not load this dish',
  );
  await button('Retry');
  expect(renderer.root.findAllByType(AppInput)).toHaveLength(3);
  await button('Cancel');
  server.controls.failure = { method: 'get', status: 404, url };
  await press('More options for Paneer Tikka');
  await press('Edit dish');
  expect(renderer.root.findByType(EmptyState).props.title).toBe(
    'Dish no longer available',
  );
});

test('list failures retain cached menu data and retry restores the server list', async () => {
  await render();
  server.controls.failure = { method: 'get', status: 500, url: dishBase };
  await act(async () => renderer.root.findByType(Screen).props.onRefresh());
  expect(names()).toHaveLength(6);
  expect(textContent()).toContain(
    'The server is unavailable. Please try again later.',
  );
  server.dishes[0].name = 'Updated on another device';
  await button('Retry');
  expect(names()[0]).toBe('Updated on another device');
  expect(textContent()).not.toContain(
    'The server is unavailable. Please try again later.',
  );
});

test('a stale menu read cannot restore a dish deleted while that read was pending', async () => {
  await render();
  const hold = deferred();
  server.controls.holdList = hold;
  await act(async () => {
    renderer.root.findByType(Screen).props.onRefresh();
  });
  await press('More options for Paneer Tikka');
  await press('Delete dish');
  await button('Delete');
  await act(async () => hold.resolve());
  expect(names()).not.toContain('Paneer Tikka');
  expect(cachedDishes.some(dish => dish.name === 'Paneer Tikka')).toBe(false);
});

test('zero-price dishes follow the backend contract and unsupported image types stay local', async () => {
  await render();
  await press('Add dish');
  await field('Dish name', 'Complimentary dish');
  await field('Price', '0.00');
  await act(async () =>
    renderer.root.findByType(DishPhotoField).props.onPress(),
  );
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [{ uri: 'file:///dish.gif', type: 'image/gif', fileSize: 500 }],
  });
  await press('Choose from gallery');
  expect(textContent()).toContain('Choose a JPEG, PNG, or WebP image.');
  await button('Keep default image');
  await button('Add Dish');
  expect(cachedDishes[0]).toMatchObject({
    name: 'Complimentary dish',
    price: 0,
    imageUrl: undefined,
  });
});

test('an older floor refresh cannot overwrite a confirmed menu deletion', async () => {
  await render();
  const hold = deferred();
  server.controls.holdList = hold;
  let refresh!: Promise<void>;
  await act(async () => {
    refresh = refreshRestaurant();
  });
  await press('More options for Paneer Tikka');
  await press('Delete dish');
  await button('Delete');
  await act(async () => {
    hold.resolve();
    await refresh;
  });
  expect(cachedDishes.some(dish => dish.name === 'Paneer Tikka')).toBe(false);
  expect(names()).not.toContain('Paneer Tikka');
});

test('repeated submits while a create is pending send exactly one request', async () => {
  await render();
  await press('Add dish');
  await field('Dish name', 'One dish');
  await field('Price', '100.00');
  const hold = deferred();
  server.controls.holdWrite = hold;
  await button('Add Dish');
  await button('Saving…');
  expect(
    server.adapter.mock.calls.filter(([request]) => request.method === 'post'),
  ).toHaveLength(1);
  expect(cachedDishes.some(dish => dish.name === 'One dish')).toBe(false);
  await act(async () => hold.resolve());
  expect(cachedDishes.filter(dish => dish.name === 'One dish')).toHaveLength(1);
});
