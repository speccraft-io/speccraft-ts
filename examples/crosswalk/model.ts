import type { Action, Invariant, Spec } from '../../src/index.js';

export type CarLight = 'green' | 'yellow' | 'red';
export type WalkSignal = 'walk' | 'dontwalk';

export interface State {
  readonly carLight: CarLight;
  readonly walkSignal: WalkSignal;
  readonly requested: boolean;
}

export function newState(): State {
  return { carLight: 'green', walkSignal: 'dontwalk', requested: false };
}

function actions(grantWalkGuard: (s: State) => boolean): Action<State>[] {
  return [
    {
      name: 'press button',
      guard: (s: State): boolean => !s.requested,
      effect: (s: State): State => ({ ...s, requested: true }),
    },
    {
      name: 'car turns yellow',
      guard: (s: State): boolean => s.carLight === 'green',
      effect: (s: State): State => ({ ...s, carLight: 'yellow' }),
    },
    {
      name: 'car turns red',
      guard: (s: State): boolean => s.carLight === 'yellow',
      effect: (s: State): State => ({ ...s, carLight: 'red' }),
    },
    {
      name: 'grant walk',
      guard: grantWalkGuard,
      effect: (s: State): State => ({ ...s, walkSignal: 'walk', requested: false }),
    },
    {
      name: 'end walk',
      guard: (s: State): boolean => s.walkSignal === 'walk',
      effect: (s: State): State => ({ ...s, walkSignal: 'dontwalk' }),
    },
    {
      name: 'car turns green',
      guard: (s: State): boolean => s.carLight === 'red' && s.walkSignal === 'dontwalk',
      effect: (s: State): State => ({ ...s, carLight: 'green' }),
    },
  ];
}

export const INVARIANTS: Invariant<State>[] = [
  {
    name: 'pedestrians only get a walk signal while car traffic is stopped',
    check: (s: State): boolean => s.walkSignal !== 'walk' || s.carLight === 'red',
  },
];

// The bug: grants a walk the moment one is requested and no walk is already
// showing. It never checks that the car light has actually turned red.
export const buggySpec: Spec<State> = {
  init: newState,
  actions: actions((s: State): boolean => s.requested && s.walkSignal === 'dontwalk'),
  invariants: INVARIANTS,
};

// The fix: also require the car light to be red before granting a walk.
export const fixedSpec: Spec<State> = {
  init: newState,
  actions: actions(
    (s: State): boolean => s.requested && s.walkSignal === 'dontwalk' && s.carLight === 'red',
  ),
  invariants: INVARIANTS,
};
