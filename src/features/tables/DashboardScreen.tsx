import { useTranslation } from 'react-i18next';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  useAppNavigation,
  type HomeTabsParams,
} from '../../app/navigationTypes';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { AppButton } from '../../components/AppButton';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { ConfirmationSheet } from '../../components/ConfirmationSheet';
import { FilterChips } from '../../components/FilterChips';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { FigmaAsset } from '../../components/FigmaAsset';
import { colors, layout } from '../../theme/tokens';
import { useSession } from '../auth/SessionProvider';
import { FloorSummary } from './FloorSummary';
import { TableTile } from './TableTile';
import { useTables, type TableFilter } from './useTables';

export function DashboardScreen({
  navigation: tabNavigation,
}: BottomTabScreenProps<HomeTabsParams, 'Dashboard'>) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const { session } = useSession();
  const tables = useTables();
  const filters: { value: TableFilter; label: string }[] = [
    {
      value: 'All tables',
      label: t('dashboard.allTables', {
        count: tables.restaurant.tables.length,
      }),
    },
    { value: 'Available', label: t('dashboard.available') },
    { value: 'Occupied', label: t('dashboard.occupied') },
  ];
  return (
    <>
      <Screen
        hasTabs
        refreshing={tables.refreshing}
        onRefresh={tables.refreshTables}
        header={
          <AppHeader
            title={t('dashboard.todaySFloor')}
            subtitle={tables.restaurant.name}
            right={
              <Pressable
                onPress={() => tabNavigation.navigate('Settings')}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.openAccountSettings')}
              >
                <Avatar name={session?.name ?? ''} photo={session?.photo} />
              </Pressable>
            }
          />
        }
      >
        <FloorSummary
          occupied={tables.occupiedCount}
          tables={tables.restaurant.tables.length}
          guests={tables.guestCount}
        />
        <View style={layout.section}>
          <AppText
            variant="section"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.sectionTitle}
          >
            {t('dashboard.restaurantTables')}
          </AppText>
          {tables.canManage ? (
            <Pressable
              onPress={() => tables.setIsEditing(!tables.isEditing)}
              accessibilityRole="button"
              style={styles.manage}
            >
              <AppText style={styles.manageLabel}>
                {tables.isEditing ? t('dashboard.done') : t('dashboard.manage')}
              </AppText>
            </Pressable>
          ) : (
            <Badge>{t('dashboard.waiter')}</Badge>
          )}
        </View>
        {!tables.restaurant.tables.length ? (
          <EmptyState
            art={<FigmaAsset name="table" />}
            title={t('dashboard.yourFloorStartsHere')}
            description={t('dashboard.addYourRestaurantTablesAndYouReReadyTo')}
            action={
              tables.canManage
                ? {
                    label: t('dashboard.addFirstTable'),
                    onPress: tables.addTable,
                  }
                : undefined
            }
          />
        ) : (
          <>
            <FilterChips
              options={filters}
              selected={tables.filter}
              onSelect={tables.setFilter}
              style={styles.filters}
            />
            <View style={styles.grid}>
              {tables.visibleTables.map(table => (
                <TableTile
                  key={table.id}
                  table={table}
                  onPress={() =>
                    navigation.navigate('Customers', { tableId: table.id })
                  }
                  onRemove={
                    tables.canManage && tables.isEditing && !table.occupied
                      ? () => tables.setTableToRemove(table.id)
                      : undefined
                  }
                />
              ))}
            </View>
            {!tables.visibleTables.length && (
              <AppText muted style={styles.empty}>
                {t('dashboard.noTablesWithThisStatus')}
              </AppText>
            )}
            {tables.canManage && (
              <AppButton
                onPress={tables.addTable}
                loading={tables.busy}
                icon="plus"
                variant="secondary"
                style={styles.add}
              >
                {t('dashboard.addTable')}
              </AppButton>
            )}
          </>
        )}
      </Screen>
      <ConfirmationSheet
        visible={tables.tableToRemove !== null}
        title={t('dashboard.removeThisTable')}
        description={t(
          'dashboard.thisTableIsCurrentlyAvailableExistingOccupiedTablesCannot',
        )}
        icon="table"
        confirmLabel={t('dashboard.removeTable')}
        cancelLabel={t('dashboard.keepTable')}
        onConfirm={tables.removeTable}
        onCancel={() => tables.setTableToRemove(null)}
      />
    </>
  );
}
const styles = StyleSheet.create({
  filters: { marginTop: 4 },
  manage: { minHeight: 44, justifyContent: 'center' },
  manageLabel: { fontSize: 12, lineHeight: 18, color: colors.forest },
  sectionTitle: { flex: 1, minWidth: 0 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  add: { marginTop: 18 },
  empty: { paddingVertical: 32, textAlign: 'center' },
});
