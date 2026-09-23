import type { Action, Spec } from '../../src/index.js';

type Worker = 'w1' | 'w2';
type Message = 'renew' | 'release';

export interface State {
  readonly job: 'open' | 'cancelled';
  readonly lease: Worker | null;
  readonly lastTaken: Worker;
  readonly w1: 'running' | 'stopped';
  readonly w2: 'waiting' | 'running' | 'stopped';
  readonly wire: readonly Message[];
  readonly renewSent: boolean;
  readonly released: boolean;
}

function init(): State {
  return {
    job: 'open',
    lease: 'w1',
    lastTaken: 'w1',
    w1: 'running',
    w2: 'waiting',
    wire: [],
    renewSent: false,
    released: false,
  };
}

function delivered(s: State, m: Message): State {
  return { ...s, wire: s.wire.filter((x) => x !== m) };
}

function stopW2(s: State): State {
  return s.w2 === 'running' ? { ...s, w2: 'stopped', lease: s.lease === 'w2' ? null : s.lease } : s;
}

function stopW1(s: State): State {
  return s.w1 === 'running' ? { ...s, w1: 'stopped', wire: [...s.wire, 'release'] } : s;
}

const common: Action<State>[] = [
  {
    name: 'w1 sends renew',
    guard: (s) => s.w1 === 'running' && !s.renewSent,
    effect: (s) => ({ ...s, renewSent: true, wire: [...s.wire, 'renew'] }),
  },
  {
    name: 'job is cancelled',
    guard: (s) => s.job === 'open',
    effect: (s) => stopW1(stopW2({ ...s, job: 'cancelled' })),
  },
  {
    name: 'w1 lease expires',
    guard: (s) => s.lease === 'w1',
    effect: (s) => ({ ...s, lease: null }),
  },
  {
    name: 'w2 takes the job',
    guard: (s) => s.job === 'open' && s.lease === null && s.w2 === 'waiting',
    effect: (s) => ({ ...s, lease: 'w2', lastTaken: 'w2', w2: 'running' }),
  },
];

const setAndDelete: Action<State>[] = [
  {
    name: 'renew lands',
    guard: (s) => s.wire.includes('renew'),
    effect: (s) => ({ ...delivered(s, 'renew'), lease: 'w1' }),
  },
  {
    name: 'release lands',
    guard: (s) => s.wire.includes('release'),
    effect: (s) => ({ ...delivered(s, 'release'), lease: null, released: true }),
  },
];

const tokenChecked: Action<State>[] = [
  {
    name: 'renew lands',
    guard: (s) => s.wire.includes('renew'),
    effect: (s) => (s.lease === 'w1' ? delivered(s, 'renew') : stopW1(delivered(s, 'renew'))),
  },
  {
    name: 'release lands',
    guard: (s) => s.wire.includes('release'),
    effect: (s) => ({ ...delivered(s, 'release'), lease: s.lease === 'w1' ? null : s.lease, released: true }),
  },
];

function leaseSpec(server: Action<State>[]): Spec<State> {
  return {
    init,
    actions: [...common, ...server],
    invariants: [
      { name: 'a released lease stays released', check: (s) => !(s.released && s.lease === 'w1') },
      { name: 'only the last worker to take the job holds the lease', check: (s) => s.lease === null || s.lease === s.lastTaken },
    ],
  };
}

export const buggySpec: Spec<State> = leaseSpec(setAndDelete);
export const fixedSpec: Spec<State> = leaseSpec(tokenChecked);
