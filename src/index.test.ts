import { describe, expect, it } from 'vitest';
import { explore, type Spec } from './index.js';

interface CounterState { count: number }

function counterSpec(): Spec<CounterState> {
  return {
    init: () => ({ count: 0 }),
    actions: [
      { name: 'inc', guard: (s) => s.count < 3, effect: (s) => ({ count: s.count + 1 }) },
    ],
    invariants: [
      { name: 'bounded', check: (s) => s.count <= 3 },
    ],
  };
}

describe('explore', () => {
  it('visits every reachable state and stops at the dead end', () => {
    const result = explore(counterSpec());
    expect(result.visitedCount).toBe(4);
    expect(result.endings).toEqual([{ count: 3 }]);
    expect(result.stuck).toEqual([]);
  });

  it('reports invariants that hold with no counterexample', () => {
    const result = explore(counterSpec());
    expect(result.invariants).toEqual([
      { name: 'bounded', holds: true },
    ]);
  });

  it('returns the shortest action trace when an invariant breaks', () => {
    const spec = counterSpec();
    spec.invariants = [{ name: 'stays under 2', check: (s): boolean => s.count < 2 }];
    const result = explore(spec);
    expect(result.invariants).toEqual([
      { name: 'stays under 2', holds: false, counterexample: ['inc', 'inc'] },
    ]);
  });

  it('splits dead ends into stuck vs endings using the stuck predicate', () => {
    interface WaitState { requested: boolean; served: boolean }
    const spec: Spec<WaitState> = {
      init: () => ({ requested: false, served: false }),
      actions: [
        { name: 'request', guard: (s) => !s.requested, effect: (s) => ({ ...s, requested: true }) },
      ],
      invariants: [],
      stuck: (s) => s.requested && !s.served,
    };
    const result = explore(spec);
    expect(result.endings).toEqual([]);
    expect(result.stuck).toEqual([{ requested: true, served: false }]);
  });
});
