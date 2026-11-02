import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../components/BottomSheet';
import { SearchInput } from '../../components/SearchInput';
import { AppText } from '../../components/AppText';
import { AppButton } from '../../components/AppButton';
import { DishImage } from '../menu/DishImage';
import type { Dish } from '../restaurant/types';
import { colors } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';

export function BillAddItemSheet({
  menu,
  name,
  onAdd,
  onClose,
}: {
  menu: Dish[];
  name: string;
  onAdd: (dish: Dish) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const dishes = menu.filter(
    dish =>
      dish.available &&
      dish.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <BottomSheet
      visible
      tall
      title={t('billing.addItemToBill')}
      onClose={onClose}
    >
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('billing.searchMenuItem')}
      />
      <AppText muted variant="small" style={styles.label}>
        {t('billing.availableMenu')}
      </AppText>
      {dishes.map(dish => (
        <View key={dish.id} style={styles.row}>
          <View style={styles.food}>
            <DishImage uri={dish.imageUrl} category={dish.category} />
          </View>
          <View style={styles.info}>
            <AppText numberOfLines={1}>{dish.name}</AppText>
            <AppText
              muted
              numberOfLines={1}
              variant="small"
              style={styles.price}
            >
              {formatCurrency(dish.price)}
            </AppText>
          </View>
          <AppButton
            variant="ghost"
            icon="plus"
            onPress={() => onAdd(dish)}
            accessibilityLabel={t('orders.addValue', { value0: dish.name })}
          >
            {t('orders.add')}
          </AppButton>
        </View>
      ))}
      {!dishes.length && (
        <AppText muted style={styles.empty}>
          {t('orders.noDishesFound')}
        </AppText>
      )}
      <AppText muted variant="helper" style={styles.note}>
        {t('billing.addedToBillOnly', { name })}
      </AppText>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  label: { marginTop: 18, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 10,
    marginBottom: 6,
    borderRadius: 24,
    backgroundColor: colors.white,
  },
  food: {
    width: 58,
    height: 58,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: colors.food,
  },
  info: { flex: 1, minWidth: 0 },
  price: { marginTop: 6 },
  note: { marginTop: 28, marginBottom: 40 },
  empty: { textAlign: 'center', padding: 24 },
});
