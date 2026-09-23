import { describe, expect, it } from 'vitest';
import { exploreAnnotated } from '../../src/annotated.js';
import { Autosave, AutosaveFixed, explorableDeps } from './autosave.js';

describe('autosave under SpecCraft', () => {
  it('finds the stale save reply with the shortest trace', async () => {
    const result = await exploreAnnotated(Autosave, (env) => new Autosave(explorableDeps(env)));
    expect(result.conformance).toEqual({ visitedCount: 77 });
    expect(result.spec.visitedCount).toBe(77);
    expect(result.spec.invariants).toEqual([
      {
        name: 'once nothing is pending, the saved text is the current text',
        holds: false,
        counterexample: [
          'type("Hello")',
          'debounce fires(0)',
          'type("Hello world")',
          'debounce fires(0)',
          'save returns(1)',
          'save returns(0)',
        ],
      },
    ]);
  });

  it('holds in every reachable state once saves are serialized', async () => {
    const result = await exploreAnnotated(AutosaveFixed, (env) => new AutosaveFixed(explorableDeps(env)));
    expect(result.conformance).toEqual({ visitedCount: 41 });
    expect(result.spec.visitedCount).toBe(41);
    expect(result.spec.invariants.every((invariant) => invariant.holds)).toBe(true);
  });
});
