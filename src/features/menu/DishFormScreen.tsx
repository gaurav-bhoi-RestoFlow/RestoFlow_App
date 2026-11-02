import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type TextInputInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootScreenProps } from '../../app/navigationTypes';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppText } from '../../components/AppText';
import { AppButton } from '../../components/AppButton';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { colors, contentWidths } from '../../theme/tokens';
import type { Dish } from '../restaurant/types';
import { useDishDetails } from './useDishDetails';
import { useDishForm, validateDishDraft } from './useDishForm';
import { DishPhotoField } from './DishPhotoField';
import { FoodTypeSelector } from './FoodTypeSelector';
import { AvailabilityField } from './AvailabilityField';
import { DishCategorySheet } from './DishCategorySheet';
import { DishImageSheet } from './DishImageSheet';
import { dishLimits } from './menuConfig';

export function DishFormScreen({
  route,
  navigation,
}: RootScreenProps<'DishForm'>) {
  const { t } = useTranslation();
  const editing = !!route.params.dishId;
  const details = useDishDetails(route.params.dishId);
  if (
    editing &&
    (details.loading ||
      (!details.error && details.dish?.id !== route.params.dishId))
  )
    return (
      <Screen
        header={
          <AppHeader
            title={t('menu.editDish')}
            onBack={navigation.goBack}
            maxWidth={contentWidths.form}
          />
        }
      >
        <ActivityIndicator
          accessibilityLabel={t('menu.loadingDish')}
          color={colors.forest}
        />
      </Screen>
    );
  if (editing && details.error)
    return (
      <Screen
        header={
          <AppHeader
            title={t('menu.editDish')}
            onBack={navigation.goBack}
            maxWidth={contentWidths.form}
          />
        }
      >
        <EmptyState
          title={t(
            details.error.status === 404
              ? 'menu.dishNotFound'
              : 'menu.loadDishFailed',
          )}
          description={
            details.error.status === 404
              ? t('menu.dishNotFoundDescription')
              : details.error.message
          }
          action={{
            label: t(
              details.error.status === 404 ? 'common.goBack' : 'api.retry',
            ),
            onPress:
              details.error.status === 404 ? navigation.goBack : details.retry,
          }}
        />
      </Screen>
    );
  return (
    <DishForm
      key={route.params.dishId ?? 'new'}
      dish={details.dish}
      editing={editing}
      navigation={navigation}
    />
  );
}
function DishForm({
  dish,
  editing,
  navigation,
}: {
  dish?: Dish;
  editing: boolean;
  navigation: RootScreenProps<'DishForm'>['navigation'];
}) {
  const { t } = useTranslation();
  const {
    draft,
    update,
    selectImage,
    removeSelectedImage,
    errors,
    saving,
    saveError,
    submit,
  } = useDishForm(dish, navigation.goBack);
  const [sheet, setSheet] = useState<'category' | 'image' | null>(null);
  const nameInput = useRef<TextInputInstance>(null);
  const priceInput = useRef<TextInputInstance>(null);
  const { contentWidth, fontScale } = useResponsiveLayout(contentWidths.form);
  const stackFields = contentWidth < 310 || fontScale >= 1.3;
  function handleSubmit() {
    submit();
    const invalid = validateDishDraft(draft);
    if (invalid.name) nameInput.current?.focus();
    else if (invalid.price) priceInput.current?.focus();
  }
  return (
    <>
      <Screen
        contentMaxWidth={contentWidths.form}
        header={
          <AppHeader
            title={t(editing ? 'menu.editDish' : 'menu.addDish')}
            subtitle={t('menu.dishSubtitle')}
            onBack={navigation.goBack}
            backDisabled={saving}
            maxWidth={contentWidths.form}
          />
        }
        footer={
          <>
            {!!saveError && (
              <AppText accessibilityRole="alert" style={styles.error}>
                {saveError}
              </AppText>
            )}
            <View
              style={[styles.actions, stackFields && styles.stackedActions]}
            >
              <AppButton
                variant="ghost"
                onPress={navigation.goBack}
                disabled={saving}
                style={[styles.action, stackFields && styles.fullAction]}
              >
                {t('auth.cancel')}
              </AppButton>
              <AppButton
                onPress={handleSubmit}
                loading={saving}
                style={[styles.action, stackFields && styles.fullAction]}
              >
                {t(
                  saving
                    ? 'menu.saving'
                    : editing
                    ? 'menu.saveChanges'
                    : 'menu.addDish',
                )}
              </AppButton>
            </View>
          </>
        }
      >
        <DishPhotoField
          uri={draft.imageUrl}
          category={draft.category}
          editing={editing}
          disabled={saving}
          onPress={() => setSheet('image')}
        />
        <AppInput
          ref={nameInput}
          label={t('menu.dishName')}
          labelStyle={styles.label}
          placeholder={t('menu.namePlaceholder')}
          value={draft.name}
          onChangeText={value => update('name', value)}
          error={errors.name && t(errors.name)}
          editable={!saving}
          maxLength={dishLimits.name}
          returnKeyType="next"
          onSubmitEditing={() => priceInput.current?.focus()}
        />
        <AppInput
          label={t('menu.descriptionOptional')}
          labelStyle={styles.label}
          placeholder={t('menu.descriptionPlaceholder')}
          value={draft.description}
          onChangeText={value => update('description', value)}
          multiline
          style={styles.description}
          maxLength={dishLimits.description}
          editable={!saving}
        />
        <FoodTypeSelector
          value={draft.foodType}
          onChange={value => update('foodType', value)}
          disabled={saving}
        />
        <View style={[styles.fields, stackFields && styles.stacked]}>
          <View style={styles.field}>
            <AppInput
              ref={priceInput}
              label={t('menu.price')}
              labelStyle={styles.label}
              placeholder="₹0.00"
              value={draft.price ? `₹${draft.price}` : ''}
              onChangeText={value =>
                update('price', value.replace(/[₹,\s]/g, ''))
              }
              error={errors.price && t(errors.price)}
              keyboardType="decimal-pad"
              editable={!saving}
              maxLength={dishLimits.priceLength + 1}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
          <View style={styles.field}>
            <AppText variant="label" style={styles.label}>
              {t('menu.category')}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('menu.category')}: ${t(
                `menu.categories.${draft.category}`,
                { defaultValue: draft.category },
              )}`}
              accessibilityState={{ disabled: saving }}
              onPress={() => setSheet('category')}
              disabled={saving}
              style={styles.category}
            >
              <AppText numberOfLines={1} style={styles.categoryText}>
                {t(`menu.categories.${draft.category}`, {
                  defaultValue: draft.category,
                })}
              </AppText>
              <View style={styles.chevron}>
                <Icon name="arrow" size={17} color={colors.muted} />
              </View>
            </Pressable>
          </View>
        </View>
        <AvailabilityField
          value={draft.available}
          onChange={value => update('available', value)}
          disabled={saving}
        />
      </Screen>
      <DishCategorySheet
        visible={sheet === 'category'}
        selected={draft.category}
        onClose={() => setSheet(null)}
        onSelect={value => {
          update('category', value);
          setSheet(null);
        }}
      />
      <DishImageSheet
        visible={sheet === 'image'}
        canRemove={!!draft.image}
        onRemove={() => {
          removeSelectedImage();
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        onSelect={image => {
          selectImage(image);
          setSheet(null);
        }}
      />
    </>
  );
}
const styles = StyleSheet.create({
  error: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    paddingBottom: 8,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stackedActions: { flexDirection: 'column' },
  action: { flex: 1 },
  fullAction: { flex: 0, width: '100%' },
  label: { color: colors.muted, lineHeight: 14, marginBottom: 6 },
  description: { minHeight: 68, textAlignVertical: 'top' },
  fields: { flexDirection: 'row', gap: 14 },
  stacked: { flexDirection: 'column', gap: 0 },
  field: { flex: 1, minWidth: 0 },
  category: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 21,
  },
  categoryText: { flex: 1, minWidth: 0 },
  chevron: { transform: [{ rotate: '90deg' }] },
});
