import { describe, expect, it } from 'vitest';
import { checkConformance } from '../../src/index.js';
import { spec } from './01-spec.js';
import { implementation } from './02-implementation.js';

describe('step 2: checking a real implementation against the proven-correct spec', () => {
  it(
    'catches a bug the spec never had: renaming forgets the summary also depends on the name',
    () => {
      const result = checkConformance(spec, implementation);
      expect(result.mismatch).toBeDefined();
      expect(result.mismatch?.action).toBe('rename document to n2');
      expect(result.mismatch?.expected.summaryGenerating).toBe(false);
      expect(result.mismatch?.actual.summaryGenerating).toBe(true);
    },
    30000,
  );
});
