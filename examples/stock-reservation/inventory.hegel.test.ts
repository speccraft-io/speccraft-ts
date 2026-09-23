import * as hegel from '@hegeldev/hegel';
import * as gs from '@hegeldev/hegel/generators';
import { describe, expect, it } from 'vitest';
import { FixedInventory, Inventory } from './inventory.js';
import type { InventoryDeps } from './inventory.js';

interface Reserves {
  stock: Record<string, number>;
  reserve: (sku: string, quantity: number) => Promise<string | null>;
}

const deps: InventoryDeps = { saveReservation: async () => await Promise.resolve('r1') };

const settings = { database: hegel.Database.disabled, derandomize: true };

function buggy(stock: number): Reserves {
  return new Inventory({ mug: stock }, deps);
}

function fixed(stock: number): Reserves {
  return new FixedInventory({ mug: stock }, deps);
}

function oneReservation(make: (stock: number) => Reserves): (tc: hegel.TestCase) => Promise<void> {
  return async (tc) => {
    const before = tc.draw(gs.integers({ minValue: 0, maxValue: 100 }));
    const quantity = tc.draw(gs.integers());
    const inventory = make(before);
    const id = await inventory.reserve('mug', quantity);
    const after = inventory.stock['mug'] ?? 0;
    if (id !== null && (after < 0 || after >= before)) {
      throw new Error(`reserved ${quantity} of ${before}, stock is now ${after}`);
    }
  };
}

function twoAtOnce(make: (stock: number) => Reserves): (tc: hegel.TestCase) => Promise<void> {
  return async (tc) => {
    const before = tc.draw(gs.integers({ minValue: 1, maxValue: 100 }));
    const first = tc.draw(gs.integers({ minValue: 1, maxValue: before }));
    const second = tc.draw(gs.integers({ minValue: 1, maxValue: before }));
    const inventory = make(before);
    await Promise.all([inventory.reserve('mug', first), inventory.reserve('mug', second)]);
    const after = inventory.stock['mug'] ?? 0;
    if (after < 0) {
      throw new Error(`reserved ${first} and ${second} of ${before}, stock is now ${after}`);
    }
  };
}

describe('stock reservation under Hegel', () => {
  it('finds a quantity the stock check lets through', async () => {
    await expect(hegel.testAsync(oneReservation(buggy), settings)).rejects.toThrow('stock is now');
  });

  it('holds for every sampled quantity once quantities are checked', async () => {
    await hegel.testAsync(oneReservation(fixed), settings);
  });

  it('finds the oversell when two reservations run at once', async () => {
    await expect(hegel.testAsync(twoAtOnce(buggy), settings)).rejects.toThrow('stock is now');
  });

  it('holds for every sampled pair once stock is taken before the save', async () => {
    await hegel.testAsync(twoAtOnce(fixed), settings);
  });
});
