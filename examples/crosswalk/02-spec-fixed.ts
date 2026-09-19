import type { Spec } from '../../src/index.js';
import { actions, INVARIANTS, newState, type State } from './01-spec.js';

// The fix: also require the car light to be red before granting a walk.
export const spec: Spec<State> = {
  init: newState,
  actions: actions(
    (s: State): boolean => s.requested && s.walkSignal === 'dontwalk' && s.carLight === 'red',
  ),
  invariants: INVARIANTS,
};
