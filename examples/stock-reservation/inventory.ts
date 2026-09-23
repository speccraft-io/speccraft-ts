import * as spec from '../../src/annotated.js';

export interface Reservation {
  readonly sku: string;
  readonly quantity: number;
}

export interface InventoryDeps {
  saveReservation: (reservation: Reservation) => Promise<string>;
}

export function explorableDeps(env: spec.Environment): InventoryDeps {
  return { saveReservation: env.channel<string>('save') };
}

interface StockState {
  stock: { mug: number };
  pending: { save: readonly number[] };
}

const invariants = {
  'stock never goes negative': (s: StockState): boolean => s.stock.mug >= 0,
};

const reserveArgs: readonly ['mug', number][] = [
  ['mug', 1],
  ['mug', 2],
];

const saveArgs: readonly [number, string][] = [
  [0, 'r1'],
  [1, 'r1'],
];

function withoutPending(s: StockState, index: number): StockState {
  return { ...s, pending: { save: s.pending.save.filter((_, i) => i !== index) } };
}

function quantityOf(reservation: Reservation): number {
  return reservation.quantity;
}

@spec.Model<StockState>({ invariants })
export class Inventory {
  @spec.State stock: Record<string, number>;
  private readonly deps: InventoryDeps;

  constructor(stock: Record<string, number>, deps: InventoryDeps) {
    this.stock = { ...stock };
    this.deps = deps;
  }

  @spec.Action<StockState, [number, string]>({
    name: 'deliver save',
    delivers: 'save',
    requestAs: quantityOf,
    maxPending: 2,
    args: saveArgs,
    guard: (s, index) => index < s.pending.save.length,
    effect: (s, index) => {
      const quantity = s.pending.save[index] ?? 0;
      return { ...withoutPending(s, index), stock: { mug: s.stock.mug - quantity } };
    },
  })
  @spec.Action<StockState, ['mug', number]>({
    name: 'reserve',
    args: reserveArgs,
    guard: () => true,
    effect: (s, _sku, quantity) =>
      quantity > s.stock.mug ? s : { ...s, pending: { save: [...s.pending.save, quantity] } },
  })
  async reserve(sku: string, quantity: number): Promise<string | null> {
    if (quantity > (this.stock[sku] ?? 0)) {
      return null;
    }
    const id = await this.deps.saveReservation({ sku, quantity });
    this.stock[sku] = (this.stock[sku] ?? 0) - quantity;
    return id;
  }
}

@spec.Model<StockState>({ invariants })
export class FixedInventory {
  @spec.State stock: Record<string, number>;
  private readonly deps: InventoryDeps;

  constructor(stock: Record<string, number>, deps: InventoryDeps) {
    this.stock = { ...stock };
    this.deps = deps;
  }

  @spec.Action<StockState, [number, string]>({
    name: 'deliver save',
    delivers: 'save',
    requestAs: quantityOf,
    maxPending: 2,
    args: saveArgs,
    guard: (s, index) => index < s.pending.save.length,
    effect: (s, index) => withoutPending(s, index),
  })
  @spec.Action<StockState, ['mug', number]>({
    name: 'reserve',
    args: reserveArgs,
    guard: () => true,
    effect: (s, _sku, quantity) =>
      quantity > s.stock.mug
        ? s
        : { stock: { mug: s.stock.mug - quantity }, pending: { save: [...s.pending.save, quantity] } },
  })
  async reserve(sku: string, quantity: number): Promise<string | null> {
    const available = this.stock[sku] ?? 0;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > available) {
      return null;
    }
    this.stock[sku] = available - quantity;
    return await this.deps.saveReservation({ sku, quantity });
  }
}
