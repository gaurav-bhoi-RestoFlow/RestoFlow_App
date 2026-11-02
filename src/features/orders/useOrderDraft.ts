import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRestaurant } from '../restaurant/RestaurantProvider';
import { useSession } from '../auth/SessionProvider';
import { restaurantApi } from '../../api/restoflow';
import { normalizeApiError } from '../../api/errors';
import type { ApiOrder } from '../../api/types';
import type { OrderItems } from '../restaurant/types';
import {
  changeQuantity,
  countOrderItems,
  paiseMoney,
  pricePaise,
} from './orderCalculations';
interface DraftLine {
  key: string;
  dishId: string | null;
  itemId?: string;
  name: string;
  unitPrice: string;
  imageUrl?: string;
  category?: string;
  note?: string | null;
}
export function useOrderDraft(tableId: string, customerId?: string) {
  const { restaurant, refresh } = useRestaurant();
  const { session } = useSession();
  const table = restaurant.tables.find(value => value.id === tableId);
  const [original, setOriginal] = useState<ApiOrder | null>(null);
  const [name, setName] = useState('');
  const [items, setItems] = useState<OrderItems>({});
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(!!customerId);
  const [busy, setBusy] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const pending = useRef(false);
  const initial = useRef({ name: '', items: {} as OrderItems });
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!customerId) return;
      setLoading(true);
      setOriginal(null);
      try {
        const order = await restaurantApi.getOrder(
          restaurant.id,
          customerId,
          signal,
        );
        if (signal?.aborted) return;
        if (order.tableId !== tableId || order.closedAt)
          throw new Error('This customer order is no longer active.');
        const quantities = Object.fromEntries(
          order.items.map(item => [item.id, item.quantity]),
        );
        initial.current = { name: order.customerName ?? '', items: quantities };
        setOriginal(order);
        setName(order.customerName ?? '');
        setItems(quantities);
        setError('');
        setHasConflict(false);
      } catch (cause) {
        if (!signal?.aborted) setError(normalizeApiError(cause).message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [customerId, restaurant.id, tableId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const lines = useMemo<DraftLine[]>(() => {
    const snapshots = (original?.items ?? []).map(item => {
      const dish = restaurant.menu.find(value => value.id === item.dishId);
      return {
        key: item.id,
        itemId: item.id,
        dishId: item.dishId,
        name: item.name,
        note: item.note,
        unitPrice: item.unitPrice,
        imageUrl: dish?.imageUrl,
        category: dish?.category,
      };
    });
    const existingIds = new Set(snapshots.map(item => item.dishId));
    return [
      ...snapshots,
      ...restaurant.menu
        .filter(dish => dish.available && !existingIds.has(dish.id))
        .map(dish => ({
          key: dish.id,
          dishId: dish.id,
          name: dish.name,
          unitPrice: dish.price.toFixed(2),
          imageUrl: dish.imageUrl,
          category: dish.category,
        })),
    ];
  }, [original, restaurant.menu]);
  const selectedLines = lines
    .filter(line => (items[line.key] ?? 0) > 0)
    .map(line => ({
      ...line,
      quantity: items[line.key],
      lineTotal: paiseMoney(
        pricePaise(line.unitPrice) * BigInt(items[line.key]),
      ),
    }));
  const total = paiseMoney(
    selectedLines.reduce(
      (sum, line) => sum + pricePaise(line.unitPrice) * BigInt(line.quantity),
      0n,
    ),
  );
  const isDirty =
    name !== initial.current.name ||
    JSON.stringify(items) !== JSON.stringify(initial.current.items);
  function updateQuantity(id: string, change: number) {
    if (!busy) {
      setItems(current => changeQuantity(current, id, change));
      setError('');
    }
  }
  async function saveOrder() {
    if (
      (session?.role !== 'owner' && session?.role !== 'waiter') ||
      !table ||
      pending.current ||
      loading ||
      hasConflict
    )
      return false;
    if (!name.trim()) {
      setError('Add the customer’s name before confirming.');
      return false;
    }
    if (!countOrderItems(items)) {
      setError('Add at least one dish before confirming.');
      return false;
    }
    if (selectedLines.length > 100) {
      setError('Orders can contain at most 100 items.');
      return false;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (original) {
        // Submit the whole selection atomically: a failed item validation
        // cannot leave this guest with a partially updated order.
        let updated = await restaurantApi.replaceOrderItems(
          restaurant.id,
          original.id,
          original.orderUpdatedAt,
          selectedLines.map(line => ({
            ...(line.itemId ? { id: line.itemId } : {}),
            dishId: line.dishId,
            quantity: line.quantity,
            note: line.note,
          })),
        );
        setOriginal(updated);
        initial.current.items = Object.fromEntries(
          updated.items.map(item => [item.id, item.quantity]),
        );
        setItems(initial.current.items);
        if (name.trim() !== updated.customerName) {
          updated = await restaurantApi.renameOrder(
            restaurant.id,
            updated.id,
            name.trim(),
          );
          setOriginal(updated);
        }
        initial.current.name = updated.customerName ?? '';
      } else {
        await restaurantApi.createOrder(
          restaurant.id,
          tableId,
          name.trim(),
          selectedLines.map(line => ({
            dishId: line.dishId!,
            quantity: line.quantity,
          })),
        );
      }
      // The mutation is confirmed by the server even if the floor reload fails.
      await refresh().catch(() => undefined);
      return true;
    } catch (cause) {
      const failure = normalizeApiError(cause);
      // Retain the editable draft on a conflict; explicit retry reloads it.
      setHasConflict(failure.status === 409);
      setError(failure.message);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return {
    name,
    setName,
    items,
    search,
    setSearch,
    error,
    isDirty,
    isEditing: !!customerId,
    isAvailable: !!table && (!customerId || original?.id === customerId),
    loading,
    busy,
    hasConflict,
    retry: load,
    tableNumber: table?.number,
    lines,
    selectedLines,
    visibleLines: lines.filter(line =>
      line.name.toLowerCase().includes(search.trim().toLowerCase()),
    ),
    itemCount: countOrderItems(items),
    total,
    updateQuantity,
    saveOrder,
  };
}
