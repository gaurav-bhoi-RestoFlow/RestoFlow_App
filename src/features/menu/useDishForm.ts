import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { normalizeApiError } from '../../api/errors';
import type { Dish, ProfilePhoto } from '../restaurant/types';
import { useMenu } from './MenuProvider';
import { dishLimits } from './menuConfig';
import { dishPhotoUri } from './DishImage';

export interface DishDraft {
  name: string;
  description: string;
  price: string;
  category: string;
  foodType: Dish['foodType'];
  available: boolean;
  imageUrl: string;
  image?: ProfilePhoto;
}
export function validateDishDraft(draft: DishDraft) {
  const decimal = /^\d+(\.\d{1,2})?$/.test(draft.price);
  const [whole, fraction = ''] = draft.price.split('.');
  const validPrice =
    decimal &&
    draft.price.length <= dishLimits.priceLength &&
    BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')) <=
      dishLimits.pricePaise;
  return {
    name: !draft.name.trim()
      ? 'menu.nameRequired'
      : draft.name.trim().length > dishLimits.name
      ? 'menu.nameTooLong'
      : undefined,
    price: validPrice ? undefined : 'menu.validPriceRequired',
  };
}
export function useDishForm(dish: Dish | undefined, onSaved: () => void) {
  const { saveDish } = useMenu();
  const [draft, setDraft] = useState<DishDraft>(() => ({
    name: dish?.name ?? '',
    description: dish?.description ?? '',
    price: dish ? dish.price.toFixed(2) : '',
    category: dish?.category ?? 'Main Course',
    foodType: dish?.foodType ?? 'VEG',
    available: dish?.available ?? true,
    imageUrl: dishPhotoUri(dish?.imageUrl) ?? '',
  }));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const errors = validateDishDraft(draft);
  function update<K extends keyof DishDraft>(key: K, value: DishDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setSaveError('');
  }
  function selectImage(image: ProfilePhoto) {
    setDraft(current => ({ ...current, image, imageUrl: image.uri }));
    setSaveError('');
  }
  function removeSelectedImage() {
    // The API supports replacing a saved photo, but has no photo-deletion field.
    setDraft(current => ({
      ...current,
      image: undefined,
      imageUrl: dishPhotoUri(dish?.imageUrl) ?? '',
    }));
    setSaveError('');
  }
  async function submit() {
    if (pending.current) return;
    setSubmitted(true);
    if (errors.name || errors.price) return;
    Keyboard.dismiss();
    pending.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await saveDish(
        {
          name: draft.name.trim(),
          description: draft.description.trim(),
          price: draft.price,
          category: draft.category,
          foodType: draft.foodType,
          available: draft.available,
        },
        dish?.id,
        draft.image,
      );
      if (mounted.current) onSaved();
    } catch (cause) {
      if (mounted.current) setSaveError(normalizeApiError(cause).message);
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return {
    draft,
    update,
    selectImage,
    removeSelectedImage,
    errors: submitted ? errors : { name: undefined, price: undefined },
    saving,
    saveError,
    submit,
  };
}
