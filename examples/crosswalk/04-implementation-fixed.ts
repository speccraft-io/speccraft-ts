import type { RealSystem } from '../../src/index.js';
import type { CarLight, State } from './01-spec.js';
import type { RealState } from './03-implementation.js';
import { newRealState } from './03-implementation.js';

const CAR_LIGHT_BY_PHASE = { 0: 'green', 1: 'yellow', 2: 'red' } as const satisfies Record<RealState['phase'], CarLight>;

function apply(r: RealState, action: string): RealState {
  switch (action) {
    case 'press button':
      return { ...r, requested: true };
    case 'car turns yellow':
      return r.phase === 0 ? { ...r, phase: 1 } : r;
    case 'car turns red':
      return r.phase === 1 ? { ...r, phase: 2 } : r;
    case 'grant walk':
      return r.requested && !r.walkOn && r.phase === 2 ? { ...r, walkOn: true, requested: false } : r;
    case 'end walk':
      return r.walkOn ? { ...r, walkOn: false } : r;
    case 'car turns green':
      return r.phase === 2 && !r.walkOn ? { ...r, phase: 0 } : r;
    default:
      return r;
  }
}

function project(r: RealState): State {
  return { carLight: CAR_LIGHT_BY_PHASE[r.phase], walkSignal: r.walkOn ? 'walk' : 'dontwalk', requested: r.requested };
}

export const implementation: RealSystem<State, RealState> = { init: newRealState, apply, project };
