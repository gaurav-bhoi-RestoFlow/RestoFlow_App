import { useTranslation } from 'react-i18next';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Icon } from '../../components/Icon';
import { colors } from '../../theme/tokens';
import type { RestaurantTable } from '../restaurant/types';

export function TableTile({
  table,
  onPress,
  onRemove,
}: {
  table: RestaurantTable;
  onPress: () => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const isOccupied = table.occupied;
  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(
          isOccupied
            ? 'dashboard.accessibleTableOccupied'
            : 'dashboard.accessibleTableAvailable',
          { table: table.number, count: table.guestCount },
        )}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          isOccupied && styles.occupied,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.glyphRow}>
          <View style={[styles.chair, isOccupied && styles.occupiedChair]} />
          <View style={[styles.glyph, isOccupied && styles.occupiedGlyph]} />
          <View style={[styles.chair, isOccupied && styles.occupiedChair]} />
        </View>
        <AppText style={[styles.name, isOccupied && styles.light]}>
          {t('dashboard.tableValue', { value0: table.number })}
        </AppText>
        <AppText style={[styles.description, isOccupied && styles.lightMuted]}>
          {isOccupied
            ? t('dashboard.valueCustomers', { value0: table.guestCount })
            : t('dashboard.readyForGuests')}
        </AppText>
        <AppText style={[styles.status, isOccupied && styles.light]}>
          • {isOccupied ? t('dashboard.occupied') : t('dashboard.available')}
        </AppText>
      </Pressable>
      {onRemove && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.removeTableValue', {
            value0: table.number,
          })}
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => [
            styles.remove,
            pressed && styles.removePressed,
          ]}
        >
          <Icon name="trash" size={14} color={colors.error} />
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  // Leave room for the floating button and its full touch target above the card.
  wrapper: { width: '47.4%', paddingTop: 22 },
  tile: {
    minHeight: 145,
    borderRadius: 38,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 12,
  },
  occupied: { backgroundColor: colors.forest },
  pressed: { opacity: 0.85 },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  glyph: {
    width: 57,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.sage,
  },
  chair: { width: 6, height: 21, borderRadius: 4, backgroundColor: '#c8d9c7' },
  occupiedGlyph: { backgroundColor: '#43695c' },
  occupiedChair: { backgroundColor: '#688b7b' },
  name: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  description: { fontSize: 11, color: colors.muted, lineHeight: 17 },
  status: { fontSize: 10, lineHeight: 15, marginTop: 5 },
  light: { color: colors.white },
  lightMuted: { color: '#d4e4d8' },
  remove: {
    position: 'absolute',
    right: 8,
    top: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    zIndex: 1,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  removePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
});
