import { describe, expect, it } from 'vitest';
import { exploreAnnotated } from '../../src/annotated.js';
import { explorableDeps, FixedInventory, Inventory } from './inventory.js';

describe('stock reservation under SpecCraft', () => {
  it('finds the oversell with the shortest trace', async () => {
    const result = await exploreAnnotated(Inventory, (env) => new Inventory({ mug: 3 }, explorableDeps(env)));
    expect(result.spec.visitedCount).toBe(25);
    expect(result.spec.invariants).toEqual([
      {
        name: 'stock never goes negative',
        holds: false,
        counterexample: ['reserve("mug", 2)', 'reserve("mug", 2)', 'deliver save(0, "r1")', 'deliver save(0, "r1")'],
      },
    ]);
    expect(result.conformance).toEqual({ visitedCount: 25 });
  });

  it('holds in every reachable state once stock is taken before the save', async () => {
    const result = await exploreAnnotated(
      FixedInventory,
      (env) => new FixedInventory({ mug: 3 }, explorableDeps(env)),
    );
    expect(result.spec.visitedCount).toBe(13);
    expect(result.spec.invariants.every((invariant) => invariant.holds)).toBe(true);
    expect(result.conformance).toEqual({ visitedCount: 13 });
  });
});
