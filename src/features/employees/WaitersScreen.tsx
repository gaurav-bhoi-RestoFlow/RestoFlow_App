import { useTranslation } from 'react-i18next';
import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { RootScreenProps } from '../../app/navigationTypes';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Notice } from '../../components/Notice';
import { colors } from '../../theme/tokens';
import { useWaiters } from './useWaiters';

export function WaitersScreen({ navigation }: RootScreenProps<'Waiters'>) {
  const { t } = useTranslation();
  const { waiters, refreshing, refreshWaiters, cancelRefresh, loadError } =
    useWaiters();
  useFocusEffect(
    useCallback(() => {
      refreshWaiters();
      return cancelRefresh;
    }, [refreshWaiters, cancelRefresh]),
  );
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={refreshWaiters}
      header={
        <AppHeader
          title={t('employees.yourWaiterTeam')}
          subtitle={t('employees.goodServiceStartsWithGoodPeople')}
          onBack={navigation.goBack}
        />
      }
      footer={
        <AppButton icon="plus" onPress={() => navigation.navigate('AddWaiter')}>
          {t('employees.addWaiter')}
        </AppButton>
      }
    >
      {!!loadError && waiters.length > 0 && (
        <View style={styles.loadError}>
          <AppText accessibilityRole="alert" style={styles.error}>
            {loadError}
          </AppText>
          <AppButton variant="ghost" onPress={refreshWaiters}>
            {t('api.retry')}
          </AppButton>
        </View>
      )}
      {waiters.length ? (
        <>
          <AppText variant="section" style={styles.heading}>
            {t('employees.valueTeamMembers', { value0: waiters.length })}
          </AppText>
          {waiters.map(waiter => (
            <View key={waiter.id} style={styles.waiter}>
              <Avatar name={waiter.name} photo={waiter.photo} size={50} />
              <View style={styles.details}>
                <AppText style={styles.name}>{waiter.name}</AppText>
                <AppText muted variant="small">
                  {waiter.phone}
                </AppText>
              </View>
              <Badge>{t('employees.waiter')}</Badge>
            </View>
          ))}
          <View style={styles.notice}>
            <Notice icon="shield">
              {t('employees.waitersUseTheirMobileNumberToJoinYourRestaurant')}
            </Notice>
          </View>
        </>
      ) : loadError ? (
        <EmptyState
          title={t('employees.loadWaitersFailed')}
          description={loadError}
          icon="people"
          action={{ label: t('api.retry'), onPress: refreshWaiters }}
        />
      ) : refreshing ? (
        <ActivityIndicator
          accessibilityLabel={t('employees.loadingWaiters')}
          color={colors.forest}
          style={styles.loading}
        />
      ) : (
        <EmptyState
          title={t('employees.buildYourFloorTeam')}
          description={t(
            'employees.addYourFirstWaiterTheirMobileNumberWillConnect',
          )}
          icon="people"
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  loading: { minHeight: 200 },
  loadError: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 17,
    padding: 12,
    marginBottom: 12,
  },
  error: { color: colors.error, fontSize: 12 },
  heading: { marginTop: 4, marginBottom: 16 },
  waiter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.white,
    borderRadius: 25,
    padding: 18,
    marginBottom: 13,
  },
  details: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  notice: { marginTop: 18 },
});
