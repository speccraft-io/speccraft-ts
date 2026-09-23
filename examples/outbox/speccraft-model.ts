import type { Spec } from '../../src/index.js';
import { consume, initial, marking, publishing } from './outbox.js';
import type { State, Variant } from './outbox.js';

export interface Bounded extends State {
  readonly crashes: number;
  readonly retries: number;
}

export interface Faults {
  readonly crashes: number;
  readonly retries: number;
}

export function outboxSpec(v: Variant, max: Faults): Spec<Bounded> {
  return {
    init: () => ({ ...initial, crashes: 0, retries: 0 }),
    actions: [
      {
        name: 'order service commits order and outbox row',
        guard: (s) => s.outbox === 'none',
        effect: (s) => ({ ...s, outbox: 'pending' }),
      },
      {
        name: 'relay reads row',
        guard: (s) => s.relay === 'idle' && s.outbox === 'pending',
        effect: (s) => ({ ...s, relay: 'read' }),
      },
      {
        name: 'relay publishes',
        guard: (s) => publishing(v, s),
        effect: (s) => ({
          ...s,
          relay: v.order === 'publish-then-mark' ? 'published' : 'idle',
          applied: consume(v, s.applied),
        }),
      },
      {
        name: 'relay marks row sent',
        guard: (s) => marking(v, s),
        effect: (s) => ({ ...s, outbox: 'sent', relay: v.order === 'publish-then-mark' ? 'idle' : 'marked' }),
      },
      {
        name: 'broker times out after delivery',
        guard: (s) => publishing(v, s) && s.retries < max.retries,
        effect: (s) => ({ ...s, applied: consume(v, s.applied), retries: s.retries + 1 }),
      },
      {
        name: 'relay crashes',
        guard: (s) => s.relay !== 'idle' && s.crashes < max.crashes,
        effect: (s) => ({ ...s, relay: 'idle', crashes: s.crashes + 1 }),
      },
    ],
    invariants: [
      { name: 'the order is applied at most once', check: (s) => s.applied <= 1 },
      {
        name: 'a row marked sent was published or is still held by the relay',
        check: (s) => s.outbox !== 'sent' || s.applied > 0 || s.relay === 'marked',
      },
    ],
    stuck: (s) => s.applied === 0,
  };
}
