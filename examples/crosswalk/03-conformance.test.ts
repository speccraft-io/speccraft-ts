import { describe, expect, it } from 'vitest';
import { checkConformance } from '../../src/index.js';
import { spec } from './02-spec-fixed.js';
import { implementation } from './03-implementation.js';

describe('step 3: checking a real implementation against the proven-correct spec', () => {
  it('catches a bug the spec never had: the implementation forgets to clear the request', () => {
    const result = checkConformance(spec, implementation);
    expect(result.mismatch).toBeDefined();
    expect(result.mismatch?.action).toBe('grant walk');
    expect(result.mismatch?.expected.requested).toBe(false);
    expect(result.mismatch?.actual.requested).toBe(true);
  });
});
