import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { AppText } from '../../components/AppText';
import { Icon, type IconName } from '../../components/Icon';
import { colors, premiumColors } from '../../theme/tokens';

const features: { icon: IconName; label: string }[] = [
  { icon: 'cutlery', label: 'subscription.ordering' },
  { icon: 'print', label: 'subscription.billing' },
  { icon: 'people', label: 'subscription.floorTeam' },
];

export function PremiumPlanCard() {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient
              id="premiumBackground"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0" stopColor={premiumColors.highlight} />
              <Stop offset="0.55" stopColor={premiumColors.background} />
              <Stop offset="1" stopColor="#0a231f" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#premiumBackground)" />
          <Circle
            cx="100%"
            cy="0"
            r="160"
            fill="none"
            stroke={premiumColors.gold}
            strokeOpacity={0.12}
          />
          <Circle
            cx="100%"
            cy="0"
            r="195"
            fill="none"
            stroke={premiumColors.gold}
            strokeOpacity={0.08}
          />
          <Circle
            cx="100%"
            cy="0"
            r="230"
            fill="none"
            stroke={premiumColors.gold}
            strokeOpacity={0.05}
          />
        </Svg>
        <View style={styles.innerBorder} />
      </View>

      <View style={styles.header}>
        <View style={styles.membership}>
          <View style={styles.crown}>
            <Icon name="crown" color={premiumColors.background} size={25} />
          </View>
          <View style={styles.membershipCopy}>
            <AppText style={styles.brand}>RestoFlow</AppText>
            <AppText style={styles.access}>
              {t('subscription.lifetimeAccess')}
            </AppText>
          </View>
        </View>
        <View style={styles.badge}>
          <View style={styles.statusDot} />
          <AppText style={styles.badgeLabel}>
            {t('subscription.active')}
          </AppText>
        </View>
      </View>

      <AppText variant="heading" style={styles.title}>
        {t('subscription.premiumPlan')}
      </AppText>
      <AppText style={styles.description}>
        {t('subscription.yourRestaurantInFullFlow')}
      </AppText>

      <View style={styles.divider} />
      <View style={styles.features}>
        {features.map(feature => (
          <View key={feature.label} style={styles.feature}>
            <Icon name={feature.icon} color={premiumColors.gold} size={18} />
            <AppText style={styles.featureLabel}>{t(feature.label)}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: premiumColors.background,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: premiumColors.border,
    overflow: 'hidden',
    padding: 24,
  },
  innerBorder: {
    position: 'absolute',
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(234, 210, 154, 0.1)',
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  membership: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flexShrink: 1,
  },
  crown: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: premiumColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipCopy: { flexShrink: 1 },
  brand: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  access: { color: premiumColors.gold, fontSize: 10, lineHeight: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(234, 210, 154, 0.3)',
    backgroundColor: 'rgba(234, 210, 154, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: premiumColors.gold,
  },
  badgeLabel: {
    color: premiumColors.gold,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 16,
  },
  title: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 40,
    marginTop: 22,
  },
  description: {
    color: premiumColors.copy,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(234, 210, 154, 0.23)',
    marginVertical: 20,
  },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  feature: { flex: 1, minWidth: 65, gap: 8 },
  featureLabel: { color: premiumColors.copy, fontSize: 11, lineHeight: 17 },
});
