import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Linking, NativeModules, Platform, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RNPrint from 'react-native-print';
import '../src/localization/i18n';
import {
  billingApi,
  type CustomerBill,
  type TableCustomers,
} from '../src/api/billing';
import { restaurantApi } from '../src/api/restoflow';
import {
  billDraft,
  calculateBill,
  normalizePrice,
} from '../src/features/billing/billDraft';
import { useBillDraft } from '../src/features/billing/useBillDraft';
import { useReceipt } from '../src/features/billing/useReceipt';
import { printCustomerBill } from '../src/features/billing/billPrinter';
import { downloadBill } from '../src/features/billing/billExport';
import { ledgerFiles } from '../src/features/ledger/ledgerFiles';
import { useOrderDraft } from '../src/features/orders/useOrderDraft';
import { useTableCustomers } from '../src/features/orders/useTableCustomers';
import { BillScreen } from '../src/features/billing/BillScreen';
import { BillItemEditor } from '../src/features/billing/BillItemEditor';
import { BillAddItemSheet } from '../src/features/billing/BillAddItemSheet';
import { EditableBillItems } from '../src/features/billing/EditableBillItems';
import { ReceiptScreen } from '../src/features/billing/ReceiptScreen';
import { PrintSuccessScreen } from '../src/features/billing/PrintSuccessScreen';
import { AppButton } from '../src/components/AppButton';
import { ConfirmationDialog } from '../src/components/ConfirmationDialog';
import {
  fixtureBill,
  fixtureRestaurant as mockRestaurant,
} from './support/billingFixtures';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

let mockRole = 'owner';
let mockFocus: () => void;
const mockRefresh = jest.fn(async () => undefined);
jest.mock('../src/features/restaurant/RestaurantProvider', () => ({
  useRestaurant: () => ({
    restaurant: mockRestaurant,
    refresh: mockRefresh,
  }),
}));
jest.mock('../src/features/auth/SessionProvider', () => ({
  useSession: () => ({ session: { role: mockRole } }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void) => {
    mockFocus = callback;
    require('react').useEffect(callback, [callback]);
  },
  usePreventRemove: jest.fn(),
  useIsFocused: jest.fn(() => true),
}));
let renderer: ReactTestRenderer.ReactTestRenderer;
let bill: CustomerBill;
const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  popTo: jest.fn(),
  dispatch: jest.fn(),
};
const params = { tableId: 'table-1', customerId: 'order-rahul' };
async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider>{element}</SafeAreaProvider>,
    );
  });
  return renderer.root;
}
async function button(label: string) {
  const control = renderer.root
    .findAllByType(AppButton)
    .find(node => node.props.children === label);
  expect(control).toBeDefined();
  expect(control!.props.disabled).not.toBe(true);
  await act(async () => {
    await control!.props.onPress();
  });
}
async function press(label: string) {
  const control = renderer.root
    .findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )
    .pop();
  expect(control).toBeDefined();
  await act(async () => {
    await control!.props.onPress();
  });
}
function screenProps(extra = {}) {
  return {
    route: { key: 'test', name: 'Bill', params: { ...params, ...extra } },
    navigation,
  } as any;
}
beforeEach(() => {
  bill = copy(fixtureBill);
  mockRole = 'owner';
  jest.clearAllMocks();
  jest.spyOn(billingApi, 'get').mockImplementation(async () => copy(bill));
  jest.spyOn(billingApi, 'preview').mockImplementation(async (_r, _o, input) =>
    calculateBill(
      bill,
      input.items.map(line => ({ ...line, lineTotal: '0.00' })),
    ),
  );
  jest.spyOn(billingApi, 'save').mockImplementation(async (_r, _o, input) => {
    bill = {
      ...calculateBill(
        bill,
        input.items.map(line => ({ ...line, lineTotal: '0.00' })),
      ),
      revision: bill.revision + 1,
      billNumber: 'RF-1042',
      isDraft: false,
    };
    return copy(bill);
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

test('exact paise totals match updated quantity and added paneer references', () => {
  const changed = calculateBill(
    bill,
    bill.items.map(line =>
      line.id === 'line-dal' ? { ...line, quantity: 3 } : line,
    ),
  );
  expect(changed).toMatchObject({ itemCount: 7, total: '780.00' });
  const paneer = calculateBill(bill, [
    ...bill.items,
    { ...bill.items[0], id: 'paneer', quantity: 2, unitPrice: '250.00' },
  ]);
  expect(paneer).toMatchObject({ itemCount: 7, total: '920.00' });
  expect(bill.total).toBe('420.00');
  expect(billDraft(bill).expectedOrderUpdatedAt).toBe(
    '2026-10-08T07:30:00.123456Z',
  );
  expect(billDraft(bill).items[0]).not.toHaveProperty('lineTotal');
});
test.each([
  ['₹180', '180.00'],
  ['0.01', '0.01'],
  ['21474836.47', '21474836.47'],
  ['21474836.48', null],
  ['-1', null],
  ['1e3', null],
  ['1.001', null],
  ['', null],
])(
  'validates unit price %s without floating point rounding',
  (input, expected) => expect(normalizePrice(input)).toBe(expected),
);
test('quantity editor shows invalid zero and cannot apply it', async () => {
  const apply = jest.fn();
  await render(
    <BillItemEditor
      line={bill.items[0]}
      field="quantity"
      onApply={apply}
      onClose={jest.fn()}
    />,
  );
  await act(async () =>
    renderer.root.findByType(TextInput).props.onChangeText('0'),
  );
  expect(renderer.root.findByType(AppButton).props.disabled).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Enter a quantity of at least 1.',
  );
  await press('Increase quantity');
  await press('Increase quantity');
  await button('Apply quantity');
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2 }));
});
test('bill screen edits and removes local lines, then saves the full guest-scoped draft', async () => {
  await render(<BillScreen {...screenProps()} />);
  await press('Edit quantity of Dal Tadka, currently 1');
  await press('Increase quantity');
  await press('Increase quantity');
  await button('Apply quantity');
  expect(
    renderer.root.findByType(EditableBillItems).props.items[0].lineTotal,
  ).toBe('540.00');
  expect(billingApi.save).not.toHaveBeenCalled();
  await press('Remove Roti from this bill');
  const dialog = renderer.root
    .findAllByType(ConfirmationDialog)
    .find(node => node.props.visible)!;
  await act(async () => dialog.props.onCancel());
  expect(renderer.root.findByType(EditableBillItems).props.items).toHaveLength(
    3,
  );
  await press('Remove Roti from this bill');
  await act(async () =>
    renderer.root
      .findAllByType(ConfirmationDialog)
      .find(node => node.props.visible)!
      .props.onConfirm(),
  );
  await press('Save bill');
  expect(billingApi.save).toHaveBeenCalledWith(
    'restaurant-1',
    'order-rahul',
    expect.objectContaining({
      expectedRevision: 0,
      items: expect.arrayContaining([expect.objectContaining({ quantity: 3 })]),
    }),
  );
  expect(bill.total).toBe('690.00');
});
test('add item sheet filters the actual available menu and adds only to this bill', async () => {
  const add = jest.fn();
  await render(
    <BillAddItemSheet
      menu={mockRestaurant.menu}
      name="Rahul"
      onAdd={add}
      onClose={jest.fn()}
    />,
  );
  await press('Add Paneer Tikka');
  expect(add).toHaveBeenCalledWith(mockRestaurant.menu[0]);
});
test('small screens use labelled editable rows without hiding fields', async () => {
  await render(
    <EditableBillItems
      items={bill.items}
      disabled={false}
      onEdit={jest.fn()}
      onRemove={jest.fn()}
    />,
  );
  expect(
    renderer.root.findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        String(node.props.accessibilityLabel).startsWith('Edit '),
    ).length,
  ).toBeGreaterThanOrEqual(9);
});
test('conflicting saves retain the draft and block another write', async () => {
  let hook!: ReturnType<typeof useBillDraft>;
  function Harness() {
    hook = useBillDraft('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () =>
    hook.setItems(items => items.map(line => ({ ...line, quantity: 2 }))),
  );
  jest.mocked(billingApi.save).mockRejectedValueOnce({
    isAxiosError: true,
    response: { status: 409, data: { error: { message: 'Bill changed' } } },
  });
  await act(async () => {
    await hook.save();
  });
  expect(hook.conflict).toBe(true);
  expect(hook.dirty).toBe(true);
  expect(hook.items[0].quantity).toBe(2);
  await act(async () => {
    await hook.save();
  });
  expect(billingApi.save).toHaveBeenCalledTimes(1);
});
test('native print success with a lost SENT acknowledgement retries without a second print', async () => {
  const job = { id: 'print-1', status: 'PENDING' as const, receipt: bill };
  jest.spyOn(billingApi, 'createPrintJob').mockResolvedValue(job);
  jest.spyOn(billingApi, 'printHtml').mockResolvedValue('<html>receipt</html>');
  jest
    .spyOn(billingApi, 'updatePrintJob')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ ...job, status: 'SENT' });
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.print()).toBeNull();
  });
  await act(async () => {
    expect(await hook.print()).toBe('print-1');
  });
  expect(RNPrint.print).toHaveBeenCalledTimes(1);
  expect(billingApi.createPrintJob).toHaveBeenCalledTimes(1);
});
test('cancelled native print fails its job and never finishes a visit', async () => {
  const job = { id: 'print-1', status: 'PENDING' as const, receipt: bill };
  jest.spyOn(billingApi, 'createPrintJob').mockResolvedValue(job);
  jest.spyOn(billingApi, 'printHtml').mockResolvedValue('<html>receipt</html>');
  jest
    .spyOn(billingApi, 'updatePrintJob')
    .mockResolvedValue({ ...job, status: 'FAILED' });
  jest.spyOn(billingApi, 'finish');
  jest.mocked(RNPrint.print).mockRejectedValueOnce(new Error('Cancelled'));
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.print()).toBeNull();
  });
  expect(billingApi.updatePrintJob).toHaveBeenCalledWith(
    'restaurant-1',
    'order-rahul',
    'print-1',
    'FAILED',
  );
  expect(billingApi.finish).not.toHaveBeenCalled();
});
test.each(['WHATSAPP', 'EMAIL'] as const)(
  'sharing via %s attaches a receipt PDF with the saved edits',
  async channel => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    jest.spyOn(billingApi, 'share');
    jest.spyOn(ledgerFiles, 'createPdf').mockResolvedValue('file:///bill.pdf');
    jest.spyOn(ledgerFiles, 'sharePdf').mockResolvedValue(undefined);
    const draft = billDraft(
      calculateBill(
        bill,
        bill.items.map((line, index) =>
          index ? line : { ...line, quantity: 3, note: 'Less spicy' },
        ),
      ),
    );
    let hook!: ReturnType<typeof useReceipt>;
    function Harness() {
      hook = useReceipt('table-1', 'order-rahul', draft);
      return null;
    }
    await render(<Harness />);
    await act(async () => {
      expect(await hook.share(channel)).toBe(true);
    });
    expect(hook.bill?.revision).toBe(1);
    expect(billingApi.save).toHaveBeenCalledWith(
      'restaurant-1',
      'order-rahul',
      draft,
    );
    expect(ledgerFiles.createPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: 'receipt',
        fileName: 'Saffron Kitchen bill 8 Oct 2026.pdf',
        generated: expect.stringContaining('Bill #RF-1042'),
        rows: expect.arrayContaining([['Dal Tadka', '3', '₹180', '₹540']]),
        notes: expect.arrayContaining(['Less spicy']),
        totals: [
          ['Taxes & charges', '₹0'],
          ['Grand total', '₹780'],
        ],
      }),
    );
    expect(ledgerFiles.sharePdf).toHaveBeenCalledWith(
      'file:///bill.pdf',
      'Saffron Kitchen bill 8 Oct 2026.pdf',
      channel.toLowerCase(),
    );
    expect(billingApi.share).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  },
);
test('a save conflict prevents sharing a stale bill PDF', async () => {
  jest
    .spyOn(billingApi, 'save')
    .mockRejectedValue(new Error('Bill has changed'));
  jest.spyOn(ledgerFiles, 'createPdf');
  jest.spyOn(ledgerFiles, 'sharePdf');
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.share('WHATSAPP')).toBe(false);
  });
  expect(ledgerFiles.createPdf).not.toHaveBeenCalled();
  expect(ledgerFiles.sharePdf).not.toHaveBeenCalled();
  expect(hook.error).toBeTruthy();
  expect(hook.busy).toBe(false);
});
test('a failed PDF share retains the saved revision for retry', async () => {
  jest.spyOn(ledgerFiles, 'createPdf').mockResolvedValue('file:///bill.pdf');
  jest
    .spyOn(ledgerFiles, 'sharePdf')
    .mockRejectedValueOnce(new Error('Share failed'))
    .mockResolvedValue(undefined);
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.share('WHATSAPP')).toBe(false);
  });
  expect(hook.bill?.revision).toBe(1);
  expect(hook.error).toBeTruthy();
  expect(hook.busy).toBe(false);
  await act(async () => {
    expect(await hook.share('WHATSAPP')).toBe(true);
  });
  expect(billingApi.save).toHaveBeenLastCalledWith(
    'restaurant-1',
    'order-rahul',
    expect.objectContaining({ expectedRevision: 1 }),
  );
  expect(hook.error).toBe('');
});
test('repeated share taps create only one PDF attachment', async () => {
  let complete!: (uri: string) => void;
  jest.spyOn(ledgerFiles, 'createPdf').mockImplementation(
    () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  );
  jest.spyOn(ledgerFiles, 'sharePdf').mockResolvedValue(undefined);
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  let first!: Promise<boolean>;
  await act(async () => {
    first = hook.share('WHATSAPP');
  });
  await act(async () => {
    expect(await hook.share('WHATSAPP')).toBe(false);
  });
  await act(async () => {
    complete('file:///bill.pdf');
    expect(await first).toBe(true);
  });
  expect(billingApi.save).toHaveBeenCalledTimes(1);
  expect(ledgerFiles.createPdf).toHaveBeenCalledTimes(1);
  expect(ledgerFiles.sharePdf).toHaveBeenCalledTimes(1);
});
test('print success requires explicit physical confirmation before guest-only finish', async () => {
  const job = { id: 'print-1', status: 'SENT' as const, receipt: bill };
  jest.spyOn(billingApi, 'printJob').mockResolvedValue(job);
  jest
    .spyOn(billingApi, 'updatePrintJob')
    .mockResolvedValue({ ...job, status: 'CONFIRMED' });
  jest.spyOn(billingApi, 'finish').mockResolvedValue({ finished: true });
  await render(
    <PrintSuccessScreen {...screenProps({ printJobId: 'print-1' })} />,
  );
  expect(billingApi.finish).not.toHaveBeenCalled();
  await button('Confirm receipt & finish visit');
  expect(billingApi.finish).not.toHaveBeenCalled();
  await button('Finish customer visit');
  expect(billingApi.finish).toHaveBeenCalledWith(
    'restaurant-1',
    'order-rahul',
    'print-1',
  );
  expect(navigation.popTo).toHaveBeenCalledWith('Customers', {
    tableId: 'table-1',
  });
});
test('receipt preview uses the edited values while cancel returns to the bill', async () => {
  const draft = billDraft(
    bill,
    bill.items.map(line =>
      line.id === 'line-dal' ? { ...line, quantity: 3 } : line,
    ),
  );
  await render(
    <ReceiptScreen {...screenProps({ draft, presentation: 'table' })} />,
  );
  expect(billingApi.preview).toHaveBeenCalledWith(
    'restaurant-1',
    'order-rahul',
    draft,
    expect.any(AbortSignal),
  );
  expect(JSON.stringify(renderer.toJSON())).toContain('₹780');
  await button('Cancel');
  expect(navigation.goBack).toHaveBeenCalled();
});
test('waiter confirms all quantities in one atomic request preserving snapshots', async () => {
  mockRole = 'waiter';
  const order = {
    id: bill.orderId,
    tableId: 'table-1',
    customerName: 'Rahul',
    closedAt: null,
    itemCount: 5,
    total: bill.total,
    currency: 'INR' as const,
    createdAt: bill.orderedAt,
    orderUpdatedAt: bill.orderUpdatedAt,
    items: bill.items,
    table: bill.table,
    subtotal: bill.subtotal,
  };
  jest.spyOn(restaurantApi, 'getOrder').mockResolvedValue(order);
  jest.spyOn(restaurantApi, 'replaceOrderItems').mockResolvedValue(order);
  jest.spyOn(restaurantApi, 'updateItem');
  jest.spyOn(restaurantApi, 'removeItem');
  let hook!: ReturnType<typeof useOrderDraft>;
  function Harness() {
    hook = useOrderDraft('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => hook.updateQuantity('line-dal', 2));
  await act(async () => {
    expect(await hook.saveOrder()).toBe(true);
  });
  expect(restaurantApi.replaceOrderItems).toHaveBeenCalledWith(
    'restaurant-1',
    'order-rahul',
    bill.orderUpdatedAt,
    expect.arrayContaining([
      expect.objectContaining({ id: 'line-dal', quantity: 3 }),
    ]),
  );
  expect(restaurantApi.updateItem).not.toHaveBeenCalled();
  expect(restaurantApi.removeItem).not.toHaveBeenCalled();
});
test('customer pagination includes every page and keeps waiter order totals separate', async () => {
  jest
    .spyOn(billingApi, 'customers')
    .mockImplementation(async (_r, tableId, offset) => ({
      table: { id: tableId, name: 'Table 1' },
      guestCount: 2,
      customers: [
        {
          orderId: 'guest-' + offset,
          name: 'Guest',
          createdAt: bill.orderedAt,
          items: bill.items,
          orderItems: bill.items,
          total: '780.00',
          orderTotal: '420.00',
          itemCount: 7,
          orderItemCount: 5,
          orderChanged: false,
        },
      ],
      pagination: { total: 2, hasMore: offset === 0 },
    }));
  let hook!: ReturnType<typeof useTableCustomers>;
  function Harness() {
    hook = useTableCustomers('restaurant-1', 'table-1', false);
    return null;
  }
  await render(<Harness />);
  expect(hook.customers).toHaveLength(2);
  expect(hook.customers.every(customer => customer.total === '420.00')).toBe(
    true,
  );
});

test('a newer customer refresh wins over an older response and blur cancels pending reads', async () => {
  const page = (name: string): TableCustomers => ({
    table: { id: 'table-1', name: 'Table 1' },
    guestCount: 1,
    customers: [
      {
        orderId: name,
        name,
        createdAt: bill.orderedAt,
        items: bill.items,
        orderItems: bill.items,
        itemCount: bill.itemCount,
        orderItemCount: bill.itemCount,
        total: bill.total,
        orderTotal: bill.total,
        orderChanged: false,
      },
    ],
    pagination: { total: 1, hasMore: false },
  });
  let resolveOlder!: (value: TableCustomers) => void;
  const older = new Promise<TableCustomers>(resolve => {
    resolveOlder = resolve;
  });
  const customers = jest
    .spyOn(billingApi, 'customers')
    .mockImplementationOnce(() => older)
    .mockResolvedValueOnce(page('Latest shared guest'));
  let hook!: ReturnType<typeof useTableCustomers>;
  function Harness() {
    hook = useTableCustomers('restaurant-1', 'table-1', false);
    return null;
  }
  await render(<Harness />);
  const olderSignal = customers.mock.calls[0][3]!;
  await act(async () => hook.load());
  expect(olderSignal.aborted).toBe(true);
  expect(hook.customers[0].name).toBe('Latest shared guest');
  await act(async () => resolveOlder(page('Stale guest')));
  expect(hook.customers[0].name).toBe('Latest shared guest');
  expect(hook.loading).toBe(false);

  let resolvePending!: (value: TableCustomers) => void;
  customers.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolvePending = resolve;
      }),
  );
  let pendingRead!: Promise<void>;
  await act(async () => {
    pendingRead = hook.load();
  });
  const pendingSignal = customers.mock.calls[2][3]!;
  await act(async () => renderer.unmount());
  expect(pendingSignal.aborted).toBe(true);
  resolvePending(page('After leaving the screen'));
  await pendingRead;
});

test('returning from a preview preserves unsaved lines then accepts a matching saved revision', async () => {
  let hook!: ReturnType<typeof useBillDraft>;
  function Harness() {
    hook = useBillDraft('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () =>
    hook.setItems(items =>
      items.map((line, index) => (index ? line : { ...line, quantity: 3 })),
    ),
  );
  await act(async () => {
    mockFocus();
  });
  expect(hook.dirty).toBe(true);
  expect(hook.bill?.total).toBe('780.00');
  bill = { ...calculateBill(bill, hook.items), revision: 1, isDraft: false };
  await act(async () => {
    mockFocus();
  });
  expect(hook.dirty).toBe(false);
  expect(hook.conflict).toBe(false);
  expect(hook.draft?.expectedRevision).toBe(1);
});

test('a waiter conflict preserves the selection until the latest order is explicitly reloaded', async () => {
  mockRole = 'waiter';
  const order = {
    ...bill,
    id: bill.orderId,
    tableId: 'table-1',
    createdAt: bill.orderedAt,
    currency: 'INR' as const,
  };
  jest.spyOn(restaurantApi, 'getOrder').mockResolvedValue(order);
  jest
    .spyOn(restaurantApi, 'replaceOrderItems')
    .mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
  let hook!: ReturnType<typeof useOrderDraft>;
  function Harness() {
    hook = useOrderDraft('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => hook.updateQuantity('line-roti', 1));
  await act(async () => {
    expect(await hook.saveOrder()).toBe(false);
  });
  expect(hook.items['line-roti']).toBe(4);
  expect(hook.hasConflict).toBe(true);
  await act(async () => {
    await hook.saveOrder();
  });
  expect(restaurantApi.replaceOrderItems).toHaveBeenCalledTimes(1);
  await act(async () => {
    await hook.retry();
  });
  expect(hook.hasConflict).toBe(false);
  expect(hook.items['line-roti']).toBe(3);
});

test('Android printing uses the job-aware bridge and propagates cancellation', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  NativeModules.BillPrinter = {
    print: jest
      .fn()
      .mockRejectedValue({ code: 'PRINT_CANCELLED', message: 'Cancelled' }),
  };
  try {
    await expect(
      printCustomerBill('<html>bill</html>', 'Saffron'),
    ).rejects.toMatchObject({ code: 'PRINT_CANCELLED' });
    expect(NativeModules.BillPrinter.print).toHaveBeenCalledWith(
      '<html>bill</html>',
      'Saffron',
    );
    expect(RNPrint.print).not.toHaveBeenCalled();
  } finally {
    delete NativeModules.BillPrinter;
  }
});

test('iOS null print result means cancelled rather than sent', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.mocked(RNPrint.print).mockResolvedValueOnce(null);
  await expect(
    printCustomerBill('<html>bill</html>', 'Saffron'),
  ).rejects.toMatchObject({ code: 'PRINT_CANCELLED' });
});

test('PDF export preserves edited amounts and does not report a cancelled file picker as saved', async () => {
  const edited = calculateBill(
    bill,
    bill.items.map((line, index) => (index ? line : { ...line, quantity: 3 })),
  );
  jest.spyOn(ledgerFiles, 'createPdf').mockResolvedValue('file:///bill.pdf');
  jest.spyOn(ledgerFiles, 'savePdf').mockResolvedValue(false);
  expect(
    await downloadBill(
      edited,
      {
        title: 'Customer bill',
        item: 'Item',
        qty: 'Qty',
        price: 'Price',
        amount: 'Amount',
        subtotal: 'Subtotal',
        taxes: 'Taxes & charges',
        total: 'Grand total',
      },
      'en',
    ),
  ).toBe(false);
  expect(ledgerFiles.createPdf).toHaveBeenCalledWith(
    expect.objectContaining({
      rows: expect.arrayContaining([['Dal Tadka', '3', '₹180', '₹540']]),
      totals: expect.arrayContaining([['Grand total', '₹780']]),
    }),
  );
  expect(ledgerFiles.savePdf).toHaveBeenCalledWith(
    'file:///bill.pdf',
    'Saffron Kitchen bill 8 Oct 2026.pdf',
  );
});

test('Bluetooth printing uses the immutable job snapshot and does not open a system dialog', async () => {
  const snapshot = {
    ...bill,
    billNumber: 'RF-BT',
    revision: 1,
    isDraft: false,
  };
  const job = {
    id: 'bluetooth-1',
    status: 'PENDING' as const,
    receipt: snapshot,
  };
  jest.spyOn(billingApi, 'createPrintJob').mockResolvedValue(job);
  jest
    .spyOn(billingApi, 'updatePrintJob')
    .mockResolvedValue({ ...job, status: 'SENT' });
  jest.spyOn(billingApi, 'printHtml');
  const send = jest.fn(async () => undefined);
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.print(send)).toBe('bluetooth-1');
  });
  expect(send).toHaveBeenCalledWith(snapshot);
  expect(billingApi.printHtml).not.toHaveBeenCalled();
  expect(RNPrint.print).not.toHaveBeenCalled();
});

test.each([
  'PAPER_OUT',
  'COVER_OPEN',
  'PRINT_UNCERTAIN',
  'PRINTER_DISCONNECTED',
])('%s never confirms a job or closes a visit', async code => {
  const job = {
    id: 'bluetooth-1',
    status: 'PENDING' as const,
    receipt: { ...bill, revision: 1, isDraft: false },
  };
  jest.spyOn(billingApi, 'createPrintJob').mockResolvedValue(job);
  jest
    .spyOn(billingApi, 'updatePrintJob')
    .mockResolvedValue({ ...job, status: 'FAILED' });
  jest.spyOn(billingApi, 'finish');
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(
      await hook.print(async () => {
        throw Object.assign(new Error('Check printer'), { code });
      }),
    ).toBeNull();
  });
  expect(billingApi.updatePrintJob).toHaveBeenCalledWith(
    'restaurant-1',
    'order-rahul',
    'bluetooth-1',
    'FAILED',
  );
  expect(billingApi.finish).not.toHaveBeenCalled();
  expect(hook.bill?.revision).toBe(1);
  expect(hook.error).toBe('Check printer');
});

test('a lost Bluetooth SENT acknowledgement retries without sending a second receipt', async () => {
  const job = { id: 'bluetooth-1', status: 'PENDING' as const, receipt: bill };
  jest.spyOn(billingApi, 'createPrintJob').mockResolvedValue(job);
  jest
    .spyOn(billingApi, 'updatePrintJob')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ ...job, status: 'SENT' });
  const send = jest.fn(async () => undefined);
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.print(send)).toBeNull();
  });
  await act(async () => {
    expect(await hook.print(send)).toBe('bluetooth-1');
  });
  expect(send).toHaveBeenCalledTimes(1);
});

test('skip printing saves edited values and never creates a fake print confirmation', async () => {
  const draft = billDraft(
    bill,
    bill.items.map(line => ({ ...line, quantity: 2 })),
  );
  jest.spyOn(billingApi, 'createPrintJob');
  jest.spyOn(billingApi, 'finish');
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul', draft);
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.continueWithoutPrinting()).toBe(true);
  });
  expect(billingApi.save).toHaveBeenCalledWith(
    'restaurant-1',
    'order-rahul',
    expect.objectContaining({ items: draft.items }),
  );
  expect(billingApi.createPrintJob).not.toHaveBeenCalled();
  expect(billingApi.finish).not.toHaveBeenCalled();
  expect(RNPrint.print).not.toHaveBeenCalled();
});

test('skip printing preserves the bill on a save failure and allows retry', async () => {
  jest.mocked(billingApi.save).mockRejectedValueOnce(new Error('offline'));
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.continueWithoutPrinting()).toBe(false);
  });
  expect(hook.error).toBe('offline');
  expect(hook.bill).toEqual(bill);
  await act(async () => {
    expect(await hook.continueWithoutPrinting()).toBe(true);
  });
});

test('skip printing from the receipt sheet returns to the dashboard', async () => {
  await render(<ReceiptScreen {...screenProps()} />);
  await button('Print bill');
  await button('Continue without printing');
  expect(navigation.popTo).toHaveBeenCalledWith('Home', {
    screen: 'Dashboard',
  });
});

test('a job for another customer cannot be sent over Bluetooth', async () => {
  jest.spyOn(billingApi, 'createPrintJob').mockResolvedValue({
    id: 'wrong-job',
    status: 'PENDING',
    receipt: { ...bill, orderId: 'someone-else' },
  });
  const send = jest.fn(async () => undefined);
  let hook!: ReturnType<typeof useReceipt>;
  function Harness() {
    hook = useReceipt('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  await act(async () => {
    expect(await hook.print(send)).toBeNull();
  });
  expect(send).not.toHaveBeenCalled();
});

test('a failed server save can keep a local draft and restore it without closing the visit', async () => {
  const { receiptDrafts } = require('../src/features/billing/receiptDrafts');
  jest.mocked(billingApi.save).mockRejectedValueOnce(new Error('offline'));
  jest.spyOn(billingApi, 'finish');
  const draft = billDraft(
    bill,
    bill.items.map(line => ({ ...line, quantity: 2 })),
  );
  let receipt!: ReturnType<typeof useReceipt>;
  let editor!: ReturnType<typeof useBillDraft>;
  function ReceiptHarness() {
    receipt = useReceipt('table-1', 'order-rahul', draft);
    return null;
  }
  function EditorHarness() {
    editor = useBillDraft('table-1', 'order-rahul');
    return null;
  }
  await render(<ReceiptHarness />);
  await act(async () => {
    expect(await receipt.continueWithoutPrinting()).toBe(false);
  });
  expect(receipt.skipSaveFailed).toBe(true);
  await act(async () => {
    expect(receipt.keepDraftOnPhone()).toBe(true);
  });
  expect(
    receiptDrafts.get('restaurant-1', 'order-rahul').items[0].quantity,
  ).toBe(2);
  await act(async () => {
    renderer.update(
      <SafeAreaProvider>
        <EditorHarness />
      </SafeAreaProvider>,
    );
  });
  expect(editor.localDraft).toBe(true);
  expect(editor.items[0].quantity).toBe(2);
  expect(editor.conflict).toBe(false);
  expect(billingApi.finish).not.toHaveBeenCalled();
  await act(async () => {
    expect(await editor.save()).toBe(true);
  });
  expect(receiptDrafts.get('restaurant-1', 'order-rahul')).toBeUndefined();
});

test('a restored local bill cannot overwrite a changed server revision', async () => {
  const { receiptDrafts } = require('../src/features/billing/receiptDrafts');
  receiptDrafts.keep('restaurant-1', { ...bill, revision: 0 });
  bill.revision = 2;
  let hook!: ReturnType<typeof useBillDraft>;
  function Harness() {
    hook = useBillDraft('table-1', 'order-rahul');
    return null;
  }
  await render(<Harness />);
  expect(hook.conflict).toBe(true);
  expect(hook.localDraft).toBe(true);
  await act(async () => {
    expect(await hook.save()).toBe(false);
  });
  expect(billingApi.save).not.toHaveBeenCalled();
});
