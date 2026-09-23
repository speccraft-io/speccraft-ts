import type { Action, Spec } from '../../src/index.js';
import type { OrderStatus } from './webhook.js';

type Worker = 'w1' | 'w2';
type Phase = 'queued' | 'read' | 'claimed' | 'charged' | 'done';

export interface State {
  readonly status: OrderStatus;
  readonly charges: number;
  readonly phase: Readonly<Record<Worker, Phase>>;
  readonly seen: Readonly<Record<Worker, OrderStatus | null>>;
}

const workers: readonly Worker[] = ['w1', 'w2'];

function init(): State {
  return {
    status: 'unpaid',
    charges: 0,
    phase: { w1: 'queued', w2: 'queued' },
    seen: { w1: null, w2: null },
  };
}

function moved(s: State, w: Worker, phase: Phase): State {
  return { ...s, phase: { ...s.phase, [w]: phase } };
}

function readThenCharge(w: Worker): Action<State>[] {
  return [
    {
      name: `${w} reads status`,
      guard: (s) => s.phase[w] === 'queued',
      effect: (s) => ({ ...moved(s, w, 'read'), seen: { ...s.seen, [w]: s.status } }),
    },
    {
      name: `${w} skips`,
      guard: (s) => s.phase[w] === 'read' && s.seen[w] !== 'unpaid',
      effect: (s) => moved(s, w, 'done'),
    },
    {
      name: `${w} charges card`,
      guard: (s) => s.phase[w] === 'read' && s.seen[w] === 'unpaid',
      effect: (s) => ({ ...moved(s, w, 'charged'), charges: s.charges + 1 }),
    },
  ];
}

function claimThenCharge(w: Worker): Action<State>[] {
  return [
    {
      name: `${w} claims order`,
      guard: (s) => s.phase[w] === 'queued',
      effect: (s) =>
        s.status === 'unpaid' ? { ...moved(s, w, 'claimed'), status: 'charging' } : moved(s, w, 'done'),
    },
    {
      name: `${w} charges card`,
      guard: (s) => s.phase[w] === 'claimed',
      effect: (s) => ({ ...moved(s, w, 'charged'), charges: s.charges + 1 }),
    },
  ];
}

function marksPaid(w: Worker): Action<State> {
  return {
    name: `${w} marks paid`,
    guard: (s) => s.phase[w] === 'charged',
    effect: (s) => ({ ...moved(s, w, 'done'), status: 'paid' }),
  };
}

function webhookSpec(steps: (w: Worker) => Action<State>[]): Spec<State> {
  return {
    init,
    actions: workers.flatMap((w) => [...steps(w), marksPaid(w)]),
    invariants: [{ name: 'the card is charged at most once', check: (s) => s.charges <= 1 }],
  };
}

export const buggySpec: Spec<State> = webhookSpec(readThenCharge);
export const fixedSpec: Spec<State> = webhookSpec(claimThenCharge);
