import { describe, expect, it } from 'vitest';
import { explore } from '../../src/index.js';
import { spec } from './02-spec-fixed.js';

describe('step 2: the fixed spec', () => {
  it('adding the missing guard clause makes the invariant hold everywhere', () => {
    const result = explore(spec);
    expect(result.visitedCount).toBe(8);
    expect(result.invariants).toEqual([
      {
        name: 'pedestrians only get a walk signal while car traffic is stopped',
        holds: true,
      },
    ]);
  });
});
