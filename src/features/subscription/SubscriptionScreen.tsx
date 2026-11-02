import { useTranslation } from 'react-i18next';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigationTypes';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Notice } from '../../components/Notice';
import { Icon } from '../../components/Icon';
import { colors, layout, premiumColors } from '../../theme/tokens';
import { formatDate } from '../../utils/date';
import { useRestaurant } from '../restaurant/RestaurantProvider';
import { PlanCard } from './PlanCard';
import { useSubscription } from './useSubscription';

export function SubscriptionScreen({
  navigation,
}: RootScreenProps<'Subscription'>) {
  const { t } = useTranslation();
  const { restaurant } = useRestaurant();
  const { daysRemaining, isExpired, progress, trialDays } = useSubscription();
  const details = [
    {
      label: t('subscription.planStatus'),
      value: t(isExpired ? 'subscription.expired' : 'subscription.active'),
    },
    {
      label: t('subscription.startDate'),
      value: formatDate(restaurant.trialStartedAt),
    },
    {
      label: restaurant.isPremium
        ? t('subscription.renewalDetails')
        : t('subscription.trialEnds'),
      value: restaurant.isPremium
        ? t('subscription.asPerYourPlan')
        : formatDate(restaurant.trialEndsAt),
    },
  ];
  return (
    <Screen
      header={
        <AppHeader
          title={t('subscription.yourSubscription')}
          subtitle={t('subscription.aClearViewOfYourPlan')}
          onBack={navigation.goBack}
        />
      }
    >
      <PlanCard
        isPremium={restaurant.isPremium}
        daysRemaining={daysRemaining}
        progress={progress}
        trialDays={trialDays}
      />
      <View
        style={[styles.details, restaurant.isPremium && styles.premiumDetails]}
      >
        {details.map((detail, index) => (
          <View
            key={detail.label}
            style={[
              layout.row,
              styles.row,
              restaurant.isPremium && styles.premiumRow,
              restaurant.isPremium &&
                index === details.length - 1 &&
                styles.lastRow,
            ]}
          >
            <AppText
              muted
              variant="small"
              style={restaurant.isPremium && styles.premiumLabel}
            >
              {detail.label}
            </AppText>
            <AppText
              style={[
                styles.value,
                restaurant.isPremium && styles.premiumValue,
              ]}
            >
              {detail.value}
            </AppText>
          </View>
        ))}
      </View>
      {restaurant.isPremium ? (
        <View style={styles.premiumNotice}>
          <Icon name="shield" color={premiumColors.goldDark} size={20} />
          <AppText style={styles.premiumNoticeCopy}>
            {t('subscription.yourPlanDetailsAreLinkedToYourRestaurantAccount')}
          </AppText>
        </View>
      ) : (
        <Notice icon="shield">
          {t('subscription.enjoyEveryOrderingAndBillingFeatureDuringYourTrial')}
        </Notice>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  details: { marginVertical: 27 },
  row: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  value: { fontSize: 12, fontWeight: '700' },
  premiumDetails: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: premiumColors.surfaceBorder,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 2,
    marginVertical: 22,
  },
  premiumRow: { borderBottomColor: premiumColors.surfaceBorder },
  lastRow: { borderBottomWidth: 0 },
  premiumLabel: { flex: 1 },
  premiumValue: { flex: 1, textAlign: 'right' },
  premiumNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: premiumColors.surface,
    borderWidth: 1,
    borderColor: premiumColors.surfaceBorder,
    borderRadius: 20,
    padding: 18,
  },
  premiumNoticeCopy: {
    flex: 1,
    color: premiumColors.goldDark,
    fontSize: 12,
    lineHeight: 20,
  },
});
