import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestaurant } from '../restaurant/RestaurantProvider';
import { useSession } from '../auth/SessionProvider';
import { restaurantApi, waiterDetails } from '../../api/restoflow';
import { normalizeApiError } from '../../api/errors';
import { toE164Phone } from '../auth/validation';
import type { ProfilePhoto } from '../restaurant/types';
export function useWaiters() {
  const { t } = useTranslation();
  const { restaurant, updateWaiters } = useRestaurant();
  const { session } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const pendingList = useRef<AbortController | null>(null);
  const canManage = session?.role === 'owner';
  const restaurantId = restaurant.id;

  const cancelRefresh = useCallback(() => {
    pendingList.current?.abort();
    pendingList.current = null;
    if (mounted.current) setRefreshing(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingList.current?.abort();
    };
  }, [restaurantId, canManage]);

  const refreshWaiters = useCallback(async () => {
    if (!canManage) return;
    pendingList.current?.abort();
    const controller = new AbortController();
    pendingList.current = controller;
    setRefreshing(true);
    setLoadError('');
    try {
      const records = await restaurantApi.listWaiters(
        restaurantId,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        const waiters = records.map(waiterDetails);
        updateWaiters(() => waiters);
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setLoadError(normalizeApiError(cause).message);
    } finally {
      if (!controller.signal.aborted) {
        pendingList.current = null;
        setRefreshing(false);
      }
    }
  }, [canManage, restaurantId, updateWaiters]);

  async function addWaiter(name: string, phone: string, photo?: ProfilePhoto) {
    if (!canManage || pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (name.trim().length < 2 || name.trim().length > 100)
        throw new Error(t('employees.enterWaiterFullName'));
      const value = await restaurantApi.createWaiter(
        restaurantId,
        name.trim(),
        toE164Phone(phone),
        photo,
      );
      if (!mounted.current) return false;
      const waiter = waiterDetails(value);
      // Keep the saved waiter visible even if the following list refresh fails.
      updateWaiters(current => [
        ...current.filter(existing => existing.id !== waiter.id),
        waiter,
      ]);
      return true;
    } catch (cause) {
      if (mounted.current) setError(normalizeApiError(cause).message);
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    waiters: restaurant.waiters,
    error,
    busy,
    addWaiter,
    loadError,
    refreshing,
    refreshWaiters,
    cancelRefresh,
  };
}
