import { describe, expect, it } from 'vitest';
import { explore } from '../../src/index.js';
import { buggySpec, fixedSpec } from './model.js';

describe('webhook spec', () => {
  it('finds the double charge with the shortest trace', () => {
    const result = explore(buggySpec);
    expect(result.visitedCount).toBe(20);
    expect(result.invariants).toEqual([
      {
        name: 'the card is charged at most once',
        holds: false,
        counterexample: ['w1 reads status', 'w1 charges card', 'w2 reads status', 'w2 charges card'],
      },
    ]);
  });

  it('holds in every reachable state once the claim is atomic', () => {
    const result = explore(fixedSpec);
    expect(result.invariants.every((invariant) => invariant.holds)).toBe(true);
  });
});
