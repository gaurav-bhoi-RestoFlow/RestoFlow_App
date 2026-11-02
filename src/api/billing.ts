import { apiClient } from './client';
import { requestData } from './restoflow';
import type { ApiOrderItem } from './types';

export interface BillLine extends ApiOrderItem {}
export interface BillDraft {
  expectedRevision: number;
  expectedOrderUpdatedAt: string;
  items: Omit<BillLine, 'lineTotal'>[];
}
export type BillSettlement = Pick<
  BillDraft,
  'expectedRevision' | 'expectedOrderUpdatedAt'
>;
export interface CustomerBill {
  orderId: string;
  billId: string | null;
  billNumber: string | null;
  revision: number;
  restaurantName: string;
  customerName: string | null;
  table: { id: string; name: string };
  orderedAt: string;
  orderUpdatedAt: string;
  sourceOrderUpdatedAt: string;
  orderChanged: boolean;
  closedAt: string | null;
  savedAt: string | null;
  items: BillLine[];
  dishCount: number;
  itemCount: number;
  subtotal: string;
  taxesAndCharges: string;
  total: string;
  currency: string;
  timezone: string;
  isDraft: boolean;
}
export interface TableCustomer {
  orderId: string;
  name: string | null;
  createdAt: string;
  items: BillLine[];
  orderItems: BillLine[];
  itemCount: number;
  total: string;
  orderItemCount: number;
  orderTotal: string;
  orderChanged: boolean;
}
export interface TableCustomers {
  table: { id: string; name: string };
  guestCount: number;
  customers: TableCustomer[];
  pagination: { hasMore: boolean; total: number };
}
export interface BillPrintJob {
  id: string;
  status: 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  receipt: CustomerBill;
}
const base = (restaurantId: string, orderId: string) =>
  `/api/v1/restaurants/${encodeURIComponent(
    restaurantId,
  )}/orders/${encodeURIComponent(orderId)}/bill`;

export const billingApi = {
  customers: (
    restaurantId: string,
    tableId: string,
    offset: number,
    signal?: AbortSignal,
  ) =>
    requestData<TableCustomers>(
      'GET',
      `/api/v1/restaurants/${encodeURIComponent(
        restaurantId,
      )}/tables/${encodeURIComponent(tableId)}/customers`,
      undefined,
      { params: { limit: 100, offset }, signal },
    ),
  get: (restaurantId: string, orderId: string, signal?: AbortSignal) =>
    requestData<CustomerBill>('GET', base(restaurantId, orderId), undefined, {
      signal,
    }),
  preview: (
    restaurantId: string,
    orderId: string,
    draft: BillDraft,
    signal?: AbortSignal,
  ) =>
    requestData<CustomerBill>(
      'POST',
      `${base(restaurantId, orderId)}/preview`,
      draft,
      { signal },
    ),
  save: (restaurantId: string, orderId: string, draft: BillDraft) =>
    requestData<CustomerBill>('PUT', base(restaurantId, orderId), draft),
  createPrintJob: (
    restaurantId: string,
    orderId: string,
    draft: BillDraft,
    requestId: string,
  ) =>
    requestData<BillPrintJob>(
      'POST',
      `${base(restaurantId, orderId)}/print-jobs`,
      { ...draft, requestId },
    ),
  printJob: (restaurantId: string, orderId: string, jobId: string) =>
    requestData<BillPrintJob>(
      'GET',
      `${base(restaurantId, orderId)}/print-jobs/${encodeURIComponent(jobId)}`,
    ),
  printHtml: async (restaurantId: string, orderId: string, jobId: string) => {
    const response = await apiClient.get<string>(
      `${base(restaurantId, orderId)}/print-jobs/${encodeURIComponent(
        jobId,
      )}/document`,
      {
        params: { format: 'html' },
        responseType: 'text',
        headers: { Accept: 'text/html' },
      },
    );
    if (typeof response.data !== 'string' || !response.data.includes('<html'))
      throw new Error('Invalid receipt document.');
    return response.data;
  },
  updatePrintJob: (
    restaurantId: string,
    orderId: string,
    jobId: string,
    status: Exclude<BillPrintJob['status'], 'PENDING'>,
  ) =>
    requestData<BillPrintJob>(
      'PATCH',
      `${base(restaurantId, orderId)}/print-jobs/${encodeURIComponent(jobId)}`,
      { status },
    ),
  finish: (restaurantId: string, orderId: string, printJobId: string) =>
    requestData<{ finished: boolean }>(
      'POST',
      `${base(restaurantId, orderId)}/finish`,
      { printJobId },
    ),
  settle: async (
    restaurantId: string,
    orderId: string,
    input: BillSettlement,
  ) => {
    const result = await requestData<{ finished: boolean; bill: CustomerBill }>(
      'POST',
      `${base(restaurantId, orderId)}/settle`,
      input,
    );
    if (!result.finished) throw new Error('The visit could not be completed.');
    return result.bill;
  },
  share: (
    restaurantId: string,
    orderId: string,
    draft: BillDraft,
    channel: 'WHATSAPP' | 'EMAIL',
  ) =>
    requestData<{ intentUrl: string }>(
      'POST',
      `${base(restaurantId, orderId)}/shares`,
      { ...draft, channel },
    ),
};
