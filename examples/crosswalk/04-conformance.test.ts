import { describe, expect, it } from 'vitest';
import { checkConformance } from '../../src/index.js';
import { spec } from './02-spec-fixed.js';
import { implementation } from './04-implementation-fixed.js';

describe('step 4: the fixed implementation', () => {
  it('conforms to the spec on every reachable transition', () => {
    const result = checkConformance(spec, implementation);
    expect(result).toEqual({ visitedCount: 8 });
  });
});
