import { describe, expect, it } from 'vitest';
import { explore } from '../../src/index.js';
import { buggySpec, fixedSpec } from './model.js';

describe('crosswalk example', () => {
  it('the buggy guard lets a pedestrian walk while cars still have a green light', () => {
    const result = explore(buggySpec);
    expect(result.invariants).toEqual([
      {
        name: 'pedestrians only get a walk signal while car traffic is stopped',
        holds: false,
        counterexample: ['press button', 'grant walk'],
      },
    ]);
  });

  it('adding the missing guard clause fixes it', () => {
    const result = explore(fixedSpec);
    expect(result.invariants).toEqual([
      {
        name: 'pedestrians only get a walk signal while car traffic is stopped',
        holds: true,
      },
    ]);
  });
});
