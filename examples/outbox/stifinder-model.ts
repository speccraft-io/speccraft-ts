import type { EventDescriptor, Model } from 'stifinder';
import { consume, initial, marking, publishing } from './outbox.js';
import type { State, Variant } from './outbox.js';

export type Event =
  | 'order service commits order and outbox row'
  | 'relay reads row'
  | 'relay publishes'
  | 'relay marks row sent'
  | 'broker times out after delivery'
  | 'relay crashes';

function expected(v: Variant, s: State): EventDescriptor<Event>[] {
  if (s.outbox === 'none') {
    return [{ event: 'order service commits order and outbox row' }];
  }
  if (s.relay === 'idle' && s.outbox === 'pending') {
    return [{ event: 'relay reads row' }];
  }
  if (publishing(v, s)) {
    return [{ event: 'relay publishes' }];
  }
  if (marking(v, s)) {
    return [{ event: 'relay marks row sent' }];
  }
  return [];
}

function faults(v: Variant, s: State): EventDescriptor<Event>[] {
  return [
    ...(publishing(v, s) ? [{ event: 'broker times out after delivery' as const, cost: ['retry'] }] : []),
    ...(s.relay === 'idle' ? [] : [{ event: 'relay crashes' as const, cost: ['crash'] }]),
  ];
}

const effects: Readonly<Record<Event, (v: Variant, s: State) => State>> = {
  'order service commits order and outbox row': (_v, s) => ({ ...s, outbox: 'pending' }),
  'relay reads row': (_v, s) => ({ ...s, relay: 'read' }),
  'relay publishes': (v, s) => ({
    ...s,
    relay: v.order === 'publish-then-mark' ? 'published' : 'idle',
    applied: consume(v, s.applied),
  }),
  'relay marks row sent': (v, s) => ({
    ...s,
    outbox: 'sent',
    relay: v.order === 'publish-then-mark' ? 'idle' : 'marked',
  }),
  'broker times out after delivery': (v, s) => ({ ...s, applied: consume(v, s.applied) }),
  'relay crashes': (_v, s) => ({ ...s, relay: 'idle' }),
};

export function outboxModel(v: Variant): Model<State, Event> {
  return {
    initialState: initial,
    getEvents: (s) => [...expected(v, s), ...faults(v, s)],
    applyEvent: (s, e) => ({ to: effects[e](v, s) }),
    invariant: (s) => (s.applied > 1 ? { error: new Error('the order was applied twice') } : undefined),
    terminalInvariant: (s) =>
      s.applied === 0 ? { error: new Error('the committed order was never published') } : undefined,
  };
}
