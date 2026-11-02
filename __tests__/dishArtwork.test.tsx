import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';
import { DishImage } from '../src/features/menu/DishImage';
import { artworkCategory } from '../src/features/menu/categoryArtwork';

let renderer: ReactTestRenderer.ReactTestRenderer;
async function render(category?: string | null, uri?: string | null) {
  await act(async () => {
    const element = <DishImage category={category} uri={uri} />;
    if (renderer) renderer.update(element);
    else renderer = ReactTestRenderer.create(element);
  });
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined as unknown as ReactTestRenderer.ReactTestRenderer;
});

test.each([
  ['Starters', 'Starters'],
  ['Main Course', 'Main Course'],
  ['Breads', 'Breads'],
  ['Rice', 'Rice'],
  ['Desserts', 'Desserts'],
  ['Beverages', 'Beverages'],
  ['Other', 'Other'],
  ['Mains', 'Main Course'],
  ['Drinks', 'Beverages'],
  ['Drink', 'Beverages'],
  ['  MAIN COURSE  ', 'Main Course'],
  ['not a category', 'Other'],
  ['main-course', 'Other'],
  ['मुख्य पदार्थ', 'Other'],
  [undefined, 'Other'],
  [null, 'Other'],
])(
  'renders the supplied artwork for %s without cropping or duplicate accessibility',
  async (category, artwork) => {
    await render(category);
    expect(renderer.toJSON()).toMatchObject({
      type: 'SvgAsset',
      props: {
        testID: `dish-artwork-${artwork}`,
        width: '100%',
        height: '100%',
        preserveAspectRatio: 'xMidYMid meet',
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      },
    });
  },
);

test.each([
  undefined,
  null,
  '',
  '  ',
  'illustration:paneer',
  'ftp://food.jpg',
  'food.jpg',
  'https://host/dish.svg?version=2',
  'data:image/svg+xml;base64,PHN2Zz4=',
])(
  'invalid photo %s uses the category and never a dish-name heuristic',
  async uri => {
    await render('Desserts', uri);
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(renderer.toJSON()).toMatchObject({
      type: 'SvgAsset',
      props: { testID: 'dish-artwork-Desserts' },
    });
  },
);

test.each([
  'https://host/dish.jpg',
  'http://localhost/dish.png',
  'file:///dish.jpg',
  'file:///Pictures/My dish.jpg',
  'content://media/23',
  'ph://photo',
  'assets-library://asset/23',
  'data:image/png;base64,aGVsbG8=',
])('valid photo %s wins and survives category changes', async uri => {
  await render('Starters', uri);
  expect(renderer.root.findByType(Image).props.source).toEqual({ uri });
  await render('Breads', uri);
  expect(renderer.root.findByType(Image).props.source).toEqual({ uri });
  await render('Breads');
  expect(renderer.toJSON()).toMatchObject({
    type: 'SvgAsset',
    props: { testID: 'dish-artwork-Breads' },
  });
});

test('a failed source falls back to the current category and retries after any source change', async () => {
  const uri = 'https://host/first.jpg';
  await render('Main Course', uri);
  const oldError = renderer.root.findByType(Image).props.onError;
  await act(async () => oldError());
  expect(renderer.toJSON()).toMatchObject({
    type: 'SvgAsset',
    props: { testID: 'dish-artwork-Main Course' },
  });
  await render('Rice', uri);
  expect(renderer.toJSON()).toMatchObject({
    type: 'SvgAsset',
    props: { testID: 'dish-artwork-Rice' },
  });
  await render('Rice', 'https://host/replacement.jpg');
  await act(async () => oldError());
  expect(renderer.root.findByType(Image).props.source.uri).toContain(
    'replacement.jpg',
  );
  await render('Rice', uri);
  expect(renderer.root.findByType(Image).props.source).toEqual({ uri });
  await act(async () => renderer.root.findByType(Image).props.onError());
  await render('Rice', '');
  await render('Rice', uri);
  expect(renderer.root.findByType(Image).props.source).toEqual({ uri });
  expect(artworkCategory('unknown')).toBe('Other');
});
