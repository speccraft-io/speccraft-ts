import type { RealSystem } from '../../src/index.js';
import type { State } from './01-spec.js';

export function newRealState(): State {
  return { carLight: 'green', walkSignal: 'dontwalk', requested: false };
}

// mirrors 00b-naive-crosswalk.ts's actual logic, bug included: grantWalkIfRequested()
// never checks that advanceLight() actually got the car light to red first.
function apply(r: State, action: string): State {
  switch (action) {
    case 'press button':
      return { ...r, requested: true };
    case 'car turns yellow':
      return r.carLight === 'green' ? { ...r, carLight: 'yellow' } : r;
    case 'car turns red':
      return r.carLight === 'yellow' ? { ...r, carLight: 'red' } : r;
    case 'grant walk':
      return r.requested && r.walkSignal === 'dontwalk' ? { ...r, walkSignal: 'walk', requested: false } : r;
    case 'end walk':
      return { ...r, walkSignal: 'dontwalk' };
    case 'car turns green':
      return r.carLight === 'red' && r.walkSignal === 'dontwalk' ? { ...r, carLight: 'green' } : r;
    default:
      return r;
  }
}

function project(r: State): State {
  return r;
}

export const implementation: RealSystem<State, State> = { init: newRealState, apply, project };
