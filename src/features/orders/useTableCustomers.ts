import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { billingApi } from '../../api/billing';
import { normalizeApiError } from '../../api/errors';
import type { CustomerOrder } from '../restaurant/types';

export function useTableCustomers(
  restaurantId: string,
  tableId: string,
  isOwner: boolean,
) {
  const [customers, setCustomers] = useState<CustomerOrder[]>([]);
  const [guestCount, setGuestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const { signal } = controller;
    setLoading(true);
    try {
      const records: CustomerOrder[] = [];
      let totalGuests = 0;
      for (let offset = 0; offset <= 100000; offset += 100) {
        const page = await billingApi.customers(
          restaurantId,
          tableId,
          offset,
          signal,
        );
        if (signal.aborted) return;
        if (page.table.id !== tableId)
          throw new Error('The customers do not belong to this table.');
        totalGuests = page.guestCount;
        records.push(
          ...page.customers.map(guest => ({
            id: guest.orderId,
            name: guest.name ?? '',
            createdAt: guest.createdAt,
            items: isOwner ? guest.items : guest.orderItems,
            itemCount: isOwner ? guest.itemCount : guest.orderItemCount,
            total: isOwner ? guest.total : guest.orderTotal,
          })),
        );
        if (!page.pagination.hasMore) break;
      }
      setCustomers(records);
      setGuestCount(totalGuests);
      setError('');
    } catch (cause) {
      if (!signal.aborted) setError(normalizeApiError(cause).message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [restaurantId, tableId, isOwner]);
  useFocusEffect(
    useCallback(() => {
      load();
      return () => pending.current?.abort();
    }, [load]),
  );
  return { customers, guestCount, loading, error, load };
}
