import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { colors } from '../theme/tokens';

export function SheetOption({
  label,
  icon,
  leading,
  numberOfLines,
  selected,
  plain,
  danger,
  trailing,
  disabled,
  onPress,
}: {
  label: string;
  icon?: IconName;
  leading?: React.ReactNode;
  numberOfLines?: number;
  selected?: boolean;
  plain?: boolean;
  danger?: boolean;
  trailing?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = danger ? '#bd3030' : colors.forest;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={selected !== undefined ? 'radio' : 'button'}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.option,
        plain && !selected && styles.plain,
        disabled && styles.disabled,
      ]}
    >
      {leading ?? (icon && <Icon name={icon} color={color} size={21} />)}
      <AppText numberOfLines={numberOfLines} style={[styles.label, { color }]}>
        {label}
      </AppText>
      {(selected || trailing) && (
        <Icon name={selected ? 'check' : 'arrow'} size={18} />
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  plain: { backgroundColor: 'transparent' },
  label: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21 },
  disabled: { opacity: 0.5 },
});
