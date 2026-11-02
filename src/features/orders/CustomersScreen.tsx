import { useTranslation } from 'react-i18next';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { RootScreenProps } from '../../app/navigationTypes';
import { useFeedback } from '../../app/FeedbackProvider';
import { normalizeApiError } from '../../api/errors';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { layout } from '../../theme/tokens';
import { useSession } from '../auth/SessionProvider';
import { useRestaurant } from '../restaurant/RestaurantProvider';
import { CustomerCard } from './CustomerCard';
import { useTableCustomers } from './useTableCustomers';

export function CustomersScreen({
  navigation,
  route,
}: RootScreenProps<'Customers'>) {
  const { t } = useTranslation();
  const { restaurant, refresh, refreshing } = useRestaurant();
  const showFeedback = useFeedback();
  const refreshFloor = useCallback(() => {
    refresh().catch(error => showFeedback(normalizeApiError(error).message));
  }, [refresh, showFeedback]);
  useFocusEffect(refreshFloor);
  const { session } = useSession();
  const table = restaurant.tables.find(
    item => item.id === route.params.tableId,
  );
  const isOwner = session?.role === 'owner';
  const guests = useTableCustomers(
    restaurant.id,
    route.params.tableId,
    isOwner,
  );
  if (!table) {
    return (
      <Screen>
        <EmptyState
          title={t('orders.tableUnavailable')}
          description={t('orders.thisTableIsNoLongerOnYourFloor')}
          action={{
            label: t('orders.backToFloor'),
            onPress: () => navigation.popToTop(),
          }}
        />
      </Screen>
    );
  }
  return (
    <Screen
      header={
        <AppHeader
          wrap
          title={t('orders.tableValue', { value0: table.number })}
          subtitle={t(
            isOwner && guests.guestCount > 0
              ? 'orders.guestsOwner'
              : 'orders.guestsWaiter',
            { count: guests.guestCount },
          )}
          onBack={navigation.goBack}
        />
      }
      footer={
        <AppButton
          wrapLabel
          icon="plus"
          onPress={() => navigation.navigate('Order', { tableId: table.id })}
        >
          {t('orders.addCustomer')}
        </AppButton>
      }
      refreshing={guests.loading || refreshing}
      onRefresh={() => {
        refreshFloor();
        guests.load();
      }}
    >
      {!!guests.error && (
        <EmptyState
          title={t('api.loadOrderFailed')}
          description={guests.error}
          action={{
            label: t('api.retry'),
            onPress: () => {
              guests.load();
            },
          }}
        />
      )}
      {!guests.error && guests.loading && !guests.customers.length ? (
        <AppText>{t('api.loadingOrder')}</AppText>
      ) : !guests.error && guests.customers.length ? (
        <>
          <View style={[layout.section, styles.section]}>
            <AppText variant="section" style={styles.sectionTitle}>
              {isOwner ? t('orders.whoSCheckingOut') : t('orders.yourGuests')}
            </AppText>
            <Badge warm={isOwner}>
              {isOwner ? t('orders.billing') : t('orders.occupied')}
            </Badge>
          </View>
          <View style={layout.stack}>
            {guests.customers.map(order => (
              <CustomerCard
                order={order}
                key={order.id}
                isOwner={isOwner}
                onPress={() =>
                  navigation.navigate(isOwner ? 'Bill' : 'Order', {
                    tableId: table.id,
                    customerId: order.id,
                  })
                }
              />
            ))}
          </View>
        </>
      ) : (
        !guests.error &&
        !guests.loading && (
          <EmptyState
            title={t('orders.readyForYourGuests')}
            description={t('orders.startANewCustomerOrderTheirDishesAndBill')}
            icon="people"
          />
        )
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: 5, flexWrap: 'wrap', gap: 10 },
  sectionTitle: { flexShrink: 1 },
});
