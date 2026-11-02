import { useTranslation } from 'react-i18next';
import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '../auth/SessionProvider';
import { fetchRestaurant } from '../../api/restoflow';
import { normalizeApiError } from '../../api/errors';
import { AppButton } from '../../components/AppButton';
import { EmptyState } from '../../components/EmptyState';
import { hideStartupSplash } from '../../app/bootstrap';
import type { Dish, Restaurant, Waiter } from './types';
interface RestaurantContextValue {
  restaurant: Restaurant | null;
  refresh: () => Promise<void>;
  refreshing: boolean;
  updateMenu: (update: (dishes: Dish[]) => Dish[]) => void;
  updateWaiters: (update: (waiters: Waiter[]) => Waiter[]) => void;
}
const RestaurantContext = createContext<RestaurantContextValue | null>(null);
export function RestaurantProvider({ children }: React.PropsWithChildren) {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // Profile edits keep the current restaurant and navigation mounted.
  const accountKey = session
    ? `${session.userId}:${session.restaurantId}:${session.role}`
    : null;
  const latestAccountKey = useRef(accountKey);
  latestAccountKey.current = accountKey;
  const loadedFor = useRef<string | null>(null);
  const latestSession = useRef(session);
  latestSession.current = session;
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const menuRevision = useRef(0);
  const waiterRevision = useRef(0);
  const updateWaiters = useCallback(
    (update: (waiters: Waiter[]) => Waiter[]) => {
      waiterRevision.current += 1;
      setRestaurant(current =>
        current && loadedFor.current === latestAccountKey.current
          ? { ...current, waiters: update(current.waiters) }
          : current,
      );
    },
    [],
  );
  const updateMenu = useCallback((update: (dishes: Dish[]) => Dish[]) => {
    menuRevision.current += 1;
    setRestaurant(current =>
      current && loadedFor.current === latestAccountKey.current
        ? { ...current, menu: update(current.menu) }
        : current,
    );
  }, []);
  const refresh = useCallback(async () => {
    const account = latestSession.current;
    if (!account) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const expected = ++generation.current;
    const expectedAccountKey = latestAccountKey.current;
    const menuVersion = menuRevision.current;
    const waiterVersion = waiterRevision.current;
    setRefreshing(true);
    try {
      const value = await fetchRestaurant(account, controller.signal);
      if (
        generation.current === expected &&
        latestAccountKey.current === expectedAccountKey
      ) {
        loadedFor.current = expectedAccountKey;
        setRestaurant(current => ({
          ...value,
          menu:
            current && menuVersion !== menuRevision.current
              ? current.menu
              : value.menu,
          waiters:
            current && waiterVersion !== waiterRevision.current
              ? current.waiters
              : value.waiters,
        }));
        setError('');
      }
    } catch (cause) {
      if (
        controller.signal.aborted ||
        generation.current !== expected ||
        latestAccountKey.current !== expectedAccountKey
      )
        return;
      const failure = normalizeApiError(cause);
      // A trial may expire between the subscription read and operational reads.
      if (failure.status === 402) {
        try {
          const value = await fetchRestaurant(account, controller.signal);
          if (
            generation.current === expected &&
            latestAccountKey.current === expectedAccountKey
          ) {
            loadedFor.current = expectedAccountKey;
            setRestaurant(current => ({
              ...value,
              menu:
                current && menuVersion !== menuRevision.current
                  ? current.menu
                  : value.menu,
              waiters:
                current && waiterVersion !== waiterRevision.current
                  ? current.waiters
                  : value.waiters,
            }));
            setError('');
          }
        } catch (retryError) {
          if (!controller.signal.aborted && generation.current === expected) {
            setError(normalizeApiError(retryError).message);
            throw retryError;
          }
        }
      } else {
        setError(failure.message);
        throw failure;
      }
    } finally {
      if (generation.current === expected) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    generation.current += 1;
    pending.current?.abort();
    loadedFor.current = null;
    setRestaurant(null);
    setError('');
    if (accountKey) refresh().catch(() => undefined);
    return () => {
      generation.current += 1;
      pending.current?.abort();
    };
  }, [accountKey, refresh]);
  useEffect(() => {
    if (error || restaurant) hideStartupSplash();
  }, [error, restaurant]);
  const available = restaurant && loadedFor.current === accountKey;
  return (
    <RestaurantContext.Provider
      value={{
        restaurant: available
          ? session?.role === 'owner'
            ? {
                ...restaurant,
                owner: session.name,
                phone: session.phone,
                photo: session.photo,
              }
            : restaurant
          : null,
        refresh,
        refreshing,
        updateMenu,
        updateWaiters,
      }}
    >
      {!session || available ? (
        children
      ) : error ? (
        <View style={styles.error}>
          <EmptyState
            title={t('api.loadRestaurantFailed')}
            description={error}
            action={{
              label: t('api.retry'),
              onPress: () => {
                refresh().catch(() => undefined);
              },
            }}
          />
          <AppButton variant="secondary" onPress={signOut}>
            {t('api.signOut')}
          </AppButton>
        </View>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel={t('api.loadingRestaurant')} />
        </View>
      )}
    </RestaurantContext.Provider>
  );
}
export function useRestaurantState() {
  const context = useContext(RestaurantContext);
  if (!context) throw new Error('useRestaurant requires RestaurantProvider');
  return context;
}
export function useRestaurant() {
  const context = useRestaurantState();
  if (!context.restaurant) throw new Error('Restaurant data is not loaded.');
  return { ...context, restaurant: context.restaurant };
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center' },
  error: { flex: 1, justifyContent: 'center', padding: 24 },
});
