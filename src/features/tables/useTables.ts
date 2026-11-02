import { useTranslation } from 'react-i18next';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useFeedback } from '../../app/FeedbackProvider';
import { useSession } from '../auth/SessionProvider';
import { useRestaurant } from '../restaurant/RestaurantProvider';
import { restaurantApi } from '../../api/restoflow';
import { normalizeApiError } from '../../api/errors';
export type TableFilter = 'All tables' | 'Available' | 'Occupied';
export function useTables() {
  const { t } = useTranslation();
  const { restaurant, refresh, refreshing } = useRestaurant();
  const { session } = useSession();
  const showFeedback = useFeedback();
  const [filter, setFilter] = useState<TableFilter>('All tables');
  const [isEditing, setIsEditing] = useState(false);
  const [tableToRemove, setTableToRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const canManage = session?.role === 'owner';
  const refreshTables = useCallback(() => {
    refresh().catch(error => showFeedback(normalizeApiError(error).message));
  }, [refresh, showFeedback]);
  useFocusEffect(refreshTables);
  const visibleTables = restaurant.tables.filter(
    table =>
      filter === 'All tables' ||
      (filter === 'Occupied' ? table.occupied : !table.occupied),
  );
  async function mutate(operation: () => Promise<void>) {
    if (!canManage || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await operation();
      await refresh();
    } catch (error) {
      const failure = normalizeApiError(error);
      if (
        failure.code === 'TABLE_HAS_OPEN_ORDER' ||
        failure.code === 'TABLE_NOT_FOUND'
      ) {
        setTableToRemove(null);
        // Another staff member may have changed this table since the last read.
        await refresh().catch(() => undefined);
      }
      showFeedback(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function addTable() {
    await mutate(async () => {
      const value = await restaurantApi.createTable(restaurant.id);
      setFilter('All tables');
      showFeedback(
        t('dashboard.tableValueAdded', { value0: value.tableNumber }),
      );
    });
  }
  async function removeTable() {
    if (!tableToRemove) return;
    await mutate(async () => {
      await restaurantApi.deleteTable(restaurant.id, tableToRemove);
      setTableToRemove(null);
      showFeedback(t('dashboard.tableRemoved'));
    });
  }
  return {
    restaurant,
    refreshing,
    refreshTables,
    canManage,
    busy,
    occupiedCount: restaurant.dashboard?.occupiedTables ?? 0,
    guestCount: restaurant.dashboard?.guestCount ?? 0,
    visibleTables,
    filter,
    setFilter,
    isEditing,
    setIsEditing,
    tableToRemove,
    setTableToRemove,
    addTable,
    removeTable,
  };
}
