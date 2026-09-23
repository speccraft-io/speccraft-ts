import type { Action, Spec } from '../../src/index.js';
import { acquire, expire, init, release, write } from './lock.js';
import type { State, Store } from './lock.js';

function action(name: string, next: (s: State) => State | null): Action<State> {
  return {
    name,
    guard: (s) => next(s) !== null,
    effect: (s) => next(s) ?? s,
  };
}

function nodeActions(i: number, store: Store): Action<State>[] {
  return [
    action(`n${i} acquires lock`, (s) => acquire(s, i)),
    action(`n${i} writes`, (s) => write(s, i, store)),
    action(`n${i} releases lock`, (s) => release(s, i)),
    action(`lease of n${i} expires`, (s) => expire(s, i)),
  ];
}

export function lockSpec(n: number, store: Store): Spec<State> {
  return {
    init: () => init(n),
    actions: Array.from({ length: n }, (_, i) => nodeActions(i, store)).flat(),
    invariants: [
      { name: 'the store never takes a write older than one it already took', check: (s) => !s.stale },
    ],
  };
}
