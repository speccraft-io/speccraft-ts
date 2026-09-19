import { describe, expect, it } from 'vitest';
import { explore } from '../../src/index.js';
import { REFUTED, spec } from './01-spec.js';

describe('step 1: the spec, matched against the case study', () => {
  it(
    'every invariant holds, every refuted belief stays false',
    () => {
      const result = explore(spec);

      expect(result.visitedCount).toBe(283951);
      expect(result.endings.length).toBe(1);
      expect(result.stuck.length).toBe(0);

      const refutedNames = new Set(REFUTED.map((i) => i.name));
      const failed = result.invariants.filter((i) => !refutedNames.has(i.name) && !i.holds);
      const noLongerRefuted = result.invariants.filter((i) => refutedNames.has(i.name) && i.holds);

      expect(failed).toEqual([]);
      expect(noLongerRefuted).toEqual([]);
    },
    // explores 283,951 states; slower shared CI runners need more than the 5s default
    30000,
  );
});
