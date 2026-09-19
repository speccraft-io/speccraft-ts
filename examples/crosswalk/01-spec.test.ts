import { describe, expect, it } from 'vitest';
import { explore } from '../../src/index.js';
import { spec } from './01-spec.js';

describe('step 1: the spec, as first written', () => {
  it('the guard lets a pedestrian walk while cars still have a green light', () => {
    const result = explore(spec);
    expect(result.invariants).toEqual([
      {
        name: 'pedestrians only get a walk signal while car traffic is stopped',
        holds: false,
        counterexample: ['press button', 'grant walk'],
      },
    ]);
  });
});
