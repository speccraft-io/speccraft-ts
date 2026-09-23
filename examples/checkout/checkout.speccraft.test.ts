import { describe, expect, it } from 'vitest';
import { explore } from '../../src/index.js';
import { buggySpec, fixedSpec } from './model.js';

describe('checkout spec', () => {
  it('finds the stale payment reply with the shortest trace', () => {
    const result = explore(buggySpec);
    expect(result.visitedCount).toBe(26);
    expect(result.endings).toHaveLength(6);
    expect(result.invariants).toEqual([
      {
        name: 'the paid amount matches the cart',
        holds: false,
        counterexample: ['checkout', 'back', 'add item', 'checkout', 'payment of 10 succeeds'],
      },
    ]);
  });

  it('holds in every reachable state once back is not allowed while pending', () => {
    const result = explore(fixedSpec);
    expect(result.visitedCount).toBe(8);
    expect(result.endings).toHaveLength(4);
    expect(result.invariants.every((invariant) => invariant.holds)).toBe(true);
  });
});
