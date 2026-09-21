import { describe, expect, it } from 'vitest';
import { checkConformance } from '../../src/index.js';
import { spec } from './01-spec.js';
import { implementation } from './01b-naive-conformance.js';

describe('step 1b: checking the real, shipped implementation against that same buggy spec', () => {
  it('conforms exactly - the real code has the same missing red-light check', () => {
    const result = checkConformance(spec, implementation);
    expect(result).toEqual({ visitedCount: 12 });
  });
});
