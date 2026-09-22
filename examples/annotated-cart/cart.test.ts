import { describe, expect, it } from 'vitest';
import { exploreAnnotated } from '../../src/annotated.js';
import { Cart, explorableDeps } from './cart.js';

describe('annotated cart', () => {
  it('applies a stale delivery quote that the spec rejects', async () => {
    const result = await exploreAnnotated(Cart, (env) => new Cart(explorableDeps(env)));
    expect(result.spec.invariants.every((invariant) => invariant.holds)).toBe(true);
    expect(result.conformance.mismatch?.trace).toEqual([
      'add item("A", 1, 5)',
      'add item("A", 1, 5)',
      'deliver quote(0, 7)',
    ]);
  });
});
