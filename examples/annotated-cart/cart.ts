import * as spec from '../../src/annotated.js';

export interface CartItem {
  readonly name: string;
  readonly quantity: number;
  readonly cost: number;
}

export interface CartDeps {
  quoteDelivery: (forItems: readonly CartItem[]) => Promise<number>;
}

export const realDeps: CartDeps = {
  quoteDelivery: async (_forItems) =>
    await new Promise<number>((resolve) => {
      setTimeout(
        () => {
          resolve(Math.round((3 + Math.random() * 12) * 100) / 100);
        },
        50 + Math.random() * 200,
      );
    }),
};

export function explorableDeps(env: spec.Environment): CartDeps {
  return { quoteDelivery: env.channel<number>('quote') };
}

export type DeliveryStatus = 'idle' | 'pending';

type Qty = 'none' | 'one' | 'many';

interface ItemLevels {
  A: Qty;
  B: Qty;
}

type FeeLevel = 'none' | 'quoted';

interface CartState {
  items: ItemLevels;
  deliveryStatus: DeliveryStatus;
  fee: FeeLevel;
  quotedForItems: ItemLevels | null;
  pending: { quote: readonly ItemLevels[] };
}

function qtyOf(items: readonly CartItem[], name: string): Qty {
  const quantity = items.find((item) => item.name === name)?.quantity ?? 0;
  return quantity === 0 ? 'none' : quantity === 1 ? 'one' : 'many';
}

function itemLevels(items: readonly CartItem[]): ItemLevels {
  return { A: qtyOf(items, 'A'), B: qtyOf(items, 'B') };
}

function quotedLevels(items: readonly CartItem[] | null): ItemLevels | null {
  return items === null ? null : itemLevels(items);
}

function feeLevel(fee: number | null): FeeLevel {
  return fee === null ? 'none' : 'quoted';
}

function sameLevels(a: ItemLevels, b: ItemLevels): boolean {
  return a.A === b.A && a.B === b.B;
}

function requested(s: CartState, items: ItemLevels): CartState {
  return { ...s, items, deliveryStatus: 'pending', pending: { quote: [...s.pending.quote, items] } };
}

@spec.Model<CartState>({
  invariants: {
    "a settled quote was quoted for the cart's current items": (s) =>
      s.deliveryStatus !== 'idle' || s.quotedForItems === null || sameLevels(s.quotedForItems, s.items),
  },
})
export class Cart {
  @spec.State(itemLevels) items: CartItem[] = [];
  @spec.State deliveryStatus: DeliveryStatus = 'idle';
  @spec.State(feeLevel) fee: number | null = null;
  @spec.State(quotedLevels) quotedForItems: readonly CartItem[] | null = null;
  private readonly deps: CartDeps;

  constructor(deps: CartDeps = realDeps) {
    this.deps = deps;
  }

  @spec.Action<CartState, ['A' | 'B', number, number]>({
    name: 'add item',
    args: [
      ['A', 1, 5],
      ['B', 1, 9],
    ],
    guard: () => true,
    effect: (s, name) => requested(s, { ...s.items, [name]: s.items[name] === 'none' ? 'one' : 'many' }),
  })
  addItem(name: string, quantity: number, cost: number): void {
    const existing = this.items.find((item) => item.name === name);
    this.items = existing
      ? this.items.map((item) => (item.name === name ? { ...item, quantity: item.quantity + quantity } : item))
      : [...this.items, { name, quantity, cost }];
    this.requestQuote();
  }

  @spec.Action<CartState, ['A' | 'B']>({
    name: 'remove item',
    args: [['A'], ['B']],
    guard: (s, name) => s.items[name] !== 'none',
    effect: (s, name) => requested(s, { ...s.items, [name]: 'none' }),
  })
  removeItem(name: string): void {
    if (!this.items.some((item) => item.name === name)) {
      return;
    }
    this.items = this.items.filter((item) => item.name !== name);
    this.requestQuote();
  }

  @spec.Action<CartState, [number, number]>({
    name: 'deliver quote',
    delivers: 'quote',
    requestAs: itemLevels,
    maxPending: 2,
    args: [
      [0, 7],
      [1, 7],
    ],
    guard: (s, index) => index < s.pending.quote.length,
    effect: (s, index) => {
      const forItems = s.pending.quote[index];
      const pending = { quote: s.pending.quote.filter((_, i) => i !== index) };
      return forItems !== undefined && sameLevels(forItems, s.items)
        ? { ...s, deliveryStatus: 'idle', fee: 'quoted', quotedForItems: forItems, pending }
        : { ...s, pending };
    },
  })
  receiveQuote(forItems: readonly CartItem[], fee: number): void {
    if (this.deliveryStatus !== 'pending') {
      return;
    }
    this.quotedForItems = forItems;
    this.fee = fee;
    this.deliveryStatus = 'idle';
  }

  private requestQuote(): void {
    const forItems = [...this.items];
    this.deliveryStatus = 'pending';
    this.deps.quoteDelivery(forItems).then(
      (fee) => {
        this.receiveQuote(forItems, fee);
      },
      (error: unknown) => {
        console.error(error);
      },
    );
  }
}
