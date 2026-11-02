import type { Dish } from '../restaurant/types';

// Keep these aligned with the backend's menu.validation and config/constants.
export const dishLimits = {
  name: 120,
  description: 2000,
  priceLength: 20,
  pricePaise: 2147483647n,
  imageBytes: 5 * 1024 * 1024,
};

export const dishCategories = [
  'Starters',
  'Main Course',
  'Breads',
  'Rice',
  'Desserts',
  'Beverages',
  'Other',
] as const;
export const menuFilters = [
  'All',
  'Starters',
  'Mains',
  'Breads',
  'Drinks',
] as const;
export type MenuFilter = (typeof menuFilters)[number];

export function filterVisibleMenu(
  menu: Dish[],
  search: string,
  category: MenuFilter,
) {
  const query = search.trim().toLocaleLowerCase();
  return menu.filter(dish => {
    const matchesCategory =
      category === 'All' ||
      (category === 'Mains'
        ? ['Main Course', 'Mains', 'Rice'].includes(dish.category)
        : category === 'Drinks'
        ? ['Beverages', 'Drinks', 'Drink'].includes(dish.category)
        : dish.category === category);
    return (
      matchesCategory &&
      `${dish.name} ${dish.description}`.toLocaleLowerCase().includes(query)
    );
  });
}
