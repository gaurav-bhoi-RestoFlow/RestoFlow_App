import { useTranslation } from 'react-i18next';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Icon } from '../../components/Icon';
import { colors } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { DishImage } from '../menu/DishImage';

export function OrderDishRow({
  dish,
  quantity,
  onChange,
  disabled = false,
}: {
  dish: {
    name: string;
    unitPrice: string;
    imageUrl?: string;
    category?: string;
  };
  quantity: number;
  onChange: (change: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { contentWidth, fontScale } = useResponsiveLayout();
  const compact = contentWidth < 310 || fontScale > 1.15;
  return (
    <View style={[styles.row, compact && styles.compact]}>
      <View style={styles.food}>
        <DishImage uri={dish.imageUrl} category={dish.category} />
      </View>
      <View style={styles.info}>
        <AppText numberOfLines={1} style={styles.name}>
          {dish.name}
        </AppText>
        <AppText muted numberOfLines={1} style={styles.price}>
          {formatCurrency(dish.unitPrice)}
        </AppText>
      </View>
      <View style={compact && styles.controls}>
        {quantity > 0 ? (
          <View style={styles.quantity}>
            <Pressable
              disabled={disabled}
              accessibilityState={{ disabled }}
              onPress={() => onChange(-1)}
              accessibilityRole="button"
              accessibilityLabel={t('orders.removeOneValue', {
                value0: dish.name,
              })}
              style={styles.quantityButton}
            >
              <Icon name="minus" size={16} />
            </Pressable>
            <AppText accessibilityLiveRegion="polite" style={styles.count}>
              {quantity}
            </AppText>
            <Pressable
              disabled={disabled || quantity >= 10000}
              accessibilityState={{ disabled: disabled || quantity >= 10000 }}
              onPress={() => onChange(1)}
              accessibilityRole="button"
              accessibilityLabel={t('orders.addOneValue', {
                value0: dish.name,
              })}
              style={styles.quantityButton}
            >
              <Icon name="plus" size={16} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={disabled}
            accessibilityState={{ disabled }}
            onPress={() => onChange(1)}
            accessibilityRole="button"
            accessibilityLabel={t('orders.addValue', { value0: dish.name })}
            style={styles.add}
          >
            <Icon name="plus" size={14} />
            <AppText numberOfLines={1} style={styles.addLabel}>
              {t('orders.add')}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  compact: { flexWrap: 'wrap' },
  controls: { width: '100%', alignItems: 'flex-end' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  food: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#eeeadf',
    overflow: 'hidden',
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, lineHeight: 19.6 },
  price: { fontSize: 12, marginTop: 4 },
  quantity: {
    height: 44,
    minWidth: 112,
    borderRadius: 22,
    backgroundColor: colors.sage,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 13,
    color: colors.forest,
    minWidth: 20,
    textAlign: 'center',
  },
  add: {
    minHeight: 44,
    minWidth: 75,
    paddingHorizontal: 13,
    borderRadius: 23,
    backgroundColor: colors.sage,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  addLabel: { color: colors.forest, fontSize: 12 },
});
