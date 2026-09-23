import { stateKey } from '@botiroff/pnueli';
import type { Action, Invariant, Spec } from '@botiroff/pnueli';
import { acquire, expire, init, release, write } from './lock.js';
import type { State, Store } from './lock.js';

function step(next: State | null): State[] {
  return next === null ? [] : [next];
}

function nodeActions(i: number, n: number, store: Store): Action<State>[] {
  return [
    {
      name: `n${i} acquires lock`,
      process: i,
      reads: ['nodes', 'epoch'],
      writes: ['nodes', 'epoch'],
      step: (s) => step(acquire(s, i)),
    },
    {
      name: `n${i} writes`,
      process: i,
      reads: ['nodes', 'newest', 'stale'],
      writes: ['nodes', 'newest', 'stale'],
      step: (s) => step(write(s, i, store)),
    },
    {
      name: `n${i} releases lock`,
      process: i,
      reads: ['nodes'],
      writes: ['nodes'],
      step: (s) => step(release(s, i)),
    },
    {
      name: `lease of n${i} expires`,
      process: n,
      reads: ['nodes'],
      writes: ['nodes'],
      step: (s) => step(expire(s, i)),
    },
  ];
}

function sortNodes(s: State): State {
  return { ...s, nodes: [...s.nodes].sort((a, b) => stateKey(a).localeCompare(stateKey(b))) };
}

export const noStaleWrite: Invariant<State> = {
  name: 'the store never takes a write older than one it already took',
  reads: ['stale'],
  holds: (s) => !s.stale,
};

export const n0Writes: Invariant<State> = {
  name: 'n0 gets a write in',
  reads: ['nodes'],
  holds: (s) => s.nodes[0]?.phase === 'wrote',
};

export const someNodeWrites: Invariant<State> = {
  name: 'some node gets a write in',
  reads: ['nodes'],
  holds: (s) => s.nodes.some((node) => node.phase === 'wrote'),
};

export function lockSpec(n: number, store: Store, symmetry: boolean): Spec<State> {
  return {
    name: `lock, ${n} nodes, store ${store}${symmetry ? ', symmetry' : ''}`,
    processes: n + 1,
    init: [init(n)],
    actions: Array.from({ length: n }, (_, i) => nodeActions(i, n, store)).flat(),
    invariants: [noStaleWrite],
    ...(symmetry ? { symmetry: sortNodes } : {}),
  };
}
