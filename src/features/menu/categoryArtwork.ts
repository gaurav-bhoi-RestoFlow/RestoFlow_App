import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';
import Starters from '../../../assets/illustrations/categories/starters.svg';
import MainCourse from '../../../assets/illustrations/categories/main-course.svg';
import Breads from '../../../assets/illustrations/categories/breads.svg';
import Rice from '../../../assets/illustrations/categories/rice.svg';
import Desserts from '../../../assets/illustrations/categories/desserts.svg';
import Beverages from '../../../assets/illustrations/categories/beverages.svg';
import Other from '../../../assets/illustrations/categories/other.svg';
import type { dishCategories } from './menuConfig';

export type DishCategory = (typeof dishCategories)[number];

const categoryArtwork = {
  Starters,
  'Main Course': MainCourse,
  Breads,
  Rice,
  Desserts,
  Beverages,
  Other,
} satisfies Record<DishCategory, ComponentType<SvgProps>>;

// Presentation-only aliases already supported by menuConfig. Keep API values intact.
export function artworkCategory(category?: string | null): DishCategory {
  switch (category?.trim().toLowerCase()) {
    case 'starters':
      return 'Starters';
    case 'main course':
    case 'mains':
      return 'Main Course';
    case 'breads':
      return 'Breads';
    case 'rice':
      return 'Rice';
    case 'desserts':
      return 'Desserts';
    case 'beverages':
    case 'drinks':
    case 'drink':
      return 'Beverages';
    default:
      return 'Other';
  }
}

export function getCategoryArtwork(category?: string | null) {
  return categoryArtwork[artworkCategory(category)];
}
