import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  usePreventRemove,
  type NavigationAction,
} from '@react-navigation/native';
import type { RootScreenProps } from '../../app/navigationTypes';
import { useFeedback } from '../../app/FeedbackProvider';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppText } from '../../components/AppText';
import { AppButton } from '../../components/AppButton';
import { Badge } from '../../components/Badge';
import { ConfirmationSheet } from '../../components/ConfirmationSheet';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { SearchInput } from '../../components/SearchInput';
import { colors, layout } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';
import { OrderDishRow } from './OrderDishRow';
import { useOrderDraft } from './useOrderDraft';
import { useSession } from '../auth/SessionProvider';

export function OrderScreen({ navigation, route }: RootScreenProps<'Order'>) {
  const { t } = useTranslation();
  const { session } = useSession();
  const draft = useOrderDraft(route.params.tableId, route.params.customerId);
  const showFeedback = useFeedback();
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(
    null,
  );
  const [canLeave, setCanLeave] = useState(false);
  const [reloadOrder, setReloadOrder] = useState(false);
  usePreventRemove((draft.isDirty || draft.busy) && !canLeave, ({ data }) => {
    if (!draft.busy) setPendingAction(data.action);
  });
  useEffect(() => {
    if (canLeave) {
      if (pendingAction) {
        navigation.dispatch(pendingAction);
      } else {
        navigation.goBack();
      }
    }
  }, [canLeave, navigation, pendingAction]);
  async function handleConfirm() {
    if (await draft.saveOrder()) {
      showFeedback(
        t('orders.orderSavedForValue', { value0: draft.name.trim() }),
      );
      setCanLeave(true);
    }
  }
  const dishes = draft.visibleLines;
  if (draft.loading)
    return (
      <Screen>
        <AppText>{t('api.loadingOrder')}</AppText>
      </Screen>
    );
  if (draft.error && !draft.isAvailable)
    return (
      <Screen>
        <EmptyState
          title={t('api.loadOrderFailed')}
          description={draft.error}
          action={{
            label: t('api.retry'),
            onPress: () => {
              draft.retry();
            },
          }}
        />
      </Screen>
    );
  if (!draft.isAvailable) {
    return (
      <Screen>
        <EmptyState
          title={t('orders.orderUnavailable')}
          description={t('orders.thisCustomerOrTableIsNoLongerActive')}
          action={{
            label: t('orders.backToFloor'),
            onPress: () => navigation.popToTop(),
          }}
        />
      </Screen>
    );
  }
  return (
    <>
      <Screen
        header={
          <AppHeader
            wrap
            title={
              draft.isEditing ? t('orders.editOrder') : t('orders.newCustomer')
            }
            subtitle={t(
              session?.role === 'owner'
                ? 'orders.tableValueOwner'
                : 'orders.tableValueWaiter',
              { value0: draft.tableNumber },
            )}
            onBack={navigation.goBack}
          />
        }
        footer={
          <>
            <View style={[layout.row, styles.total]}>
              <AppText variant="small" style={styles.summaryItem}>
                {t('orders.valueItemsCustomerOrder', {
                  value0: draft.itemCount,
                })}
              </AppText>
              <AppText style={styles.amount}>
                {formatCurrency(draft.total)}
              </AppText>
            </View>
            <AppButton
              wrapLabel
              disabled={
                !draft.itemCount || !draft.name.trim() || draft.hasConflict
              }
              loading={draft.busy}
              onPress={handleConfirm}
              icon="check"
              iconPosition="after"
            >
              {t('orders.confirmOrder')}
            </AppButton>
          </>
        }
      >
        <AppInput
          label={t('orders.customerName')}
          value={draft.name}
          onChangeText={draft.setName}
          placeholder={t('orders.nameOnTheOrder')}
          maxLength={120}
          error={
            draft.error ||
            (draft.itemCount > 0 && !draft.name.trim()
              ? t('orders.addTheCustomerSNameBeforeConfirming')
              : undefined)
          }
          editable={!draft.busy}
        />
        {draft.hasConflict && (
          <AppButton
            wrapLabel
            variant="secondary"
            onPress={() => setReloadOrder(true)}
          >
            {t('orders.reloadLatestOrder')}
          </AppButton>
        )}
        <View style={[layout.section, styles.section]}>
          <AppText variant="section" style={styles.summaryItem}>
            {t('orders.whatCanWeGetYou')}
          </AppText>
          <Badge>{t('orders.valueItems', { value0: draft.itemCount })}</Badge>
        </View>
        <SearchInput
          value={draft.search}
          onChangeText={draft.setSearch}
          placeholder={t('orders.findADish')}
        />
        {dishes.map(dish => (
          <OrderDishRow
            key={dish.key}
            dish={dish}
            disabled={draft.busy}
            quantity={draft.items[dish.key] ?? 0}
            onChange={change => draft.updateQuantity(dish.key, change)}
          />
        ))}
        {!dishes.length && (
          <AppText muted style={styles.empty}>
            {t('orders.noDishesFound')}
          </AppText>
        )}
        {!!draft.search.trim() && !!draft.itemCount && (
          <View style={styles.summary}>
            <AppText style={styles.summaryTitle}>
              {t('orders.orderSummary')}
            </AppText>
            {draft.itemCount ? (
              draft.selectedLines.map(line => (
                <View key={line.key} style={[layout.row, styles.summaryLine]}>
                  <AppText muted variant="small" style={styles.summaryItem}>
                    {line.name} × {line.quantity}
                  </AppText>
                  <AppText muted variant="small">
                    {formatCurrency(line.lineTotal)}
                  </AppText>
                </View>
              ))
            ) : (
              <AppText muted variant="small">
                {t('orders.addDishesToStartThisOrder')}
              </AppText>
            )}
          </View>
        )}
      </Screen>
      <ConfirmationSheet
        visible={reloadOrder}
        title={t('orders.reloadLatestOrder')}
        description={t('orders.reloadOrderDescription')}
        confirmLabel={t('orders.reloadLatestOrder')}
        cancelLabel={t('orders.keepEditing')}
        onConfirm={() => {
          setReloadOrder(false);
          draft.retry();
        }}
        onCancel={() => setReloadOrder(false)}
        onDismiss={() => setReloadOrder(false)}
      />
      <ConfirmationSheet
        visible={!!pendingAction && !canLeave}
        title={t('orders.leaveThisOrder')}
        description={t(
          'orders.yourUnsavedChangesWillBeDiscardedConfirmTheOrder',
        )}
        confirmLabel={t('orders.keepEditing')}
        cancelLabel={t('orders.discardChanges')}
        onConfirm={() => setPendingAction(null)}
        onCancel={() => setCanLeave(true)}
        onDismiss={() => setPendingAction(null)}
      />
    </>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: 0, gap: 10, flexWrap: 'wrap' },
  summaryItem: { flexShrink: 1 },
  total: { marginBottom: 12 },
  amount: { fontSize: 24, lineHeight: 36 },
  summary: {
    padding: 18,
    backgroundColor: colors.sage,
    borderRadius: 23,
    marginTop: 24,
  },
  summaryTitle: { marginBottom: 8 },
  summaryLine: { marginTop: 8 },
  empty: { paddingVertical: 40, textAlign: 'center' },
});
