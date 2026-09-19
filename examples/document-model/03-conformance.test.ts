import { describe, expect, it } from 'vitest';
import { checkConformance } from '../../src/index.js';
import { spec } from './01-spec.js';
import { implementation } from './03-implementation-fixed.js';

describe('step 3: the fixed implementation', () => {
  it(
    'conforms to the spec on every reachable transition',
    () => {
      const result = checkConformance(spec, implementation);
      expect(result).toEqual({ visitedCount: 283951 });
    },
    30000,
  );
});
