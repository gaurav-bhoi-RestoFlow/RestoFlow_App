import { useTranslation } from 'react-i18next';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Icon } from '../../components/Icon';
import { colors, layout } from '../../theme/tokens';
import { PremiumPlanCard } from './PremiumPlanCard';

export function PlanCard({
  isPremium,
  daysRemaining,
  progress,
  trialDays,
}: {
  isPremium: boolean;
  daysRemaining: number;
  progress: number;
  trialDays: number;
}) {
  const { t } = useTranslation();
  if (isPremium) {
    return <PremiumPlanCard />;
  }
  return (
    <View style={styles.plan}>
      <View style={layout.row}>
        <View style={styles.icon}>
          <Icon name="crown" color={colors.white} size={23} />
        </View>
        <AppText style={styles.badge}>
          •{' '}
          {daysRemaining ? t('subscription.active') : t('subscription.expired')}
        </AppText>
      </View>
      <AppText variant="heading" style={styles.title}>
        {t('subscription.aGreatStart')}
      </AppText>
      <AppText style={styles.copy}>
        {t('api.trialDescription', { days: trialDays })}
      </AppText>
      <View style={styles.track}>
        <View style={[styles.progress, { width: `${progress * 100}%` }]} />
      </View>
      <View style={[layout.row, styles.remaining]}>
        <AppText style={styles.remainingLabel}>
          {t('subscription.valueDaysRemaining', { value0: daysRemaining })}
        </AppText>
        <AppText style={styles.remainingLabel}>
          {t('api.trialLabel', { days: trialDays })}
        </AppText>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  plan: {
    backgroundColor: colors.forest,
    borderRadius: 30,
    paddingVertical: 26,
    paddingHorizontal: 24,
  },
  icon: {
    backgroundColor: colors.forestLight,
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e7f0e6',
    borderRadius: 20,
    backgroundColor: colors.forestLight,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  title: { fontSize: 27, color: colors.white, marginVertical: 11 },
  copy: { color: '#d8e5d9', fontSize: 13, marginBottom: 24 },
  track: {
    height: 5,
    borderRadius: 10,
    backgroundColor: colors.forestLight,
    overflow: 'hidden',
  },
  progress: { height: 5, backgroundColor: '#c8d9b6', borderRadius: 10 },
  remaining: { marginTop: 12 },
  remainingLabel: { fontSize: 10, color: '#dae6da' },
});
