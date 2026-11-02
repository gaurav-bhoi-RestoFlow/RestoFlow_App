import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootScreenProps } from '../../app/navigationTypes';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { BillStatus } from './BillStatus';

export function PrintSuccessScreen({
  route,
  navigation,
}: RootScreenProps<'PrintSuccess'>) {
  const { t } = useTranslation();
  return (
    <Screen>
      <BillStatus
        title={t('billing.customerVisitCompleted')}
        description={t('billing.billSavedAndCustomerCleared')}
      >
        <AppButton
          wrapLabel
          onPress={() =>
            navigation.popTo('Customers', { tableId: route.params.tableId })
          }
        >
          {t('billing.backToCustomers')}
        </AppButton>
        <AppButton
          wrapLabel
          variant="secondary"
          onPress={() =>
            navigation.replace('Receipt', {
              tableId: route.params.tableId,
              customerId: route.params.customerId,
            })
          }
        >
          {t('billing.reprintReceipt')}
        </AppButton>
        <AppText muted style={styles.note}>
          {t('billing.otherGuestsAtThisTableStayActive')}
        </AppText>
        <AppButton
          wrapLabel
          variant="ghost"
          onPress={() => navigation.popTo('Home', { screen: 'Dashboard' })}
        >
          {t('bluetooth.goToDashboard')}
        </AppButton>
      </BillStatus>
    </Screen>
  );
}
const styles = StyleSheet.create({
  note: { fontSize: 13, lineHeight: 22.1, textAlign: 'center' },
});
