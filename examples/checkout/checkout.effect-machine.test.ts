import { describe, expect, it } from '@effect/vitest';
import { Machine } from '@typeonce/effect-machine';
import { MachineTest } from '@typeonce/effect-machine/testing';
import { Effect, Option, Schema } from 'effect';

const price = 10;

const States = Machine.state({
  fields: { items: Schema.Number },
  states: {
    Cart: {},
    PaymentPending: { fields: { amount: Schema.Number } },
    Paid: { fields: { amount: Schema.Number } },
    Failed: {},
  },
});
const targets = Machine.targets(States);

const Events = Machine.events({
  AddItem: {},
  RemoveItem: {},
  Checkout: {},
  Back: {},
  PaymentSucceeded: { amount: Schema.Number },
  PaymentFailed: { amount: Schema.Number },
});

const cart = {
  on: {
    AddItem: { update: targets.root, data: ({ root }: { root: { items: number } }) => ({ items: root.items + 1 }) },
    RemoveItem: {
      update: targets.root,
      data: ({ root }: { root: { items: number } }) => ({ items: root.items - 1 }),
    },
    Checkout: {
      target: targets.root.PaymentPending,
      data: ({ root }: { root: { items: number } }) => ({ amount: root.items * price }),
    },
  },
} as const;

const invokeMachine = Machine.make({
  root: States,
  events: Events,
  effects: { charge: (amount: number) => Effect.succeed(amount) },
}).handle({
  root: () => ({ items: 1 }),
  initial: { target: targets.root.Cart },
  states: {
    Cart: cart,
    PaymentPending: {
      invoke: {
        src: 'charge',
        input: ({ state }) => state.amount,
        onDone: { target: targets.root.Paid, data: ({ output }) => ({ amount: output }) },
      },
      on: { Back: { target: targets.root.Cart } },
    },
    Paid: {},
    Failed: {},
  },
});

const buggyMachine = Machine.make({ root: States, events: Events }).handle({
  root: () => ({ items: 1 }),
  initial: { target: targets.root.Cart },
  states: {
    Cart: cart,
    PaymentPending: {
      on: {
        Back: { target: targets.root.Cart },
        PaymentSucceeded: { target: targets.root.Paid, data: ({ event }) => ({ amount: event.amount }) },
        PaymentFailed: { target: targets.root.Failed },
      },
    },
    Paid: {},
    Failed: {},
  },
});

const fixedMachine = Machine.make({ root: States, events: Events }).handle({
  root: () => ({ items: 1 }),
  initial: { target: targets.root.Cart },
  states: {
    Cart: cart,
    PaymentPending: {
      on: {
        PaymentSucceeded: { target: targets.root.Paid, data: ({ event }) => ({ amount: event.amount }) },
        PaymentFailed: { target: targets.root.Failed },
      },
    },
    Paid: {},
    Failed: {},
  },
});

type Snapshot = Machine.Snapshot<typeof States>;
type Event = Machine.Machine.InputEvent<typeof buggyMachine>;

interface Step {
  readonly event: Event;
  readonly before: Snapshot;
}

function paidMatchesCart(snapshot: Snapshot): true | string {
  const total = snapshot.value.items * price;
  return States.get(snapshot, 'Paid').pipe(
    Option.match({
      onNone: () => true,
      onSome: ({ amount }) => amount === total || `paid ${amount} for a cart of ${total}`,
    }),
  );
}

function userEvents(snapshot: Snapshot): Event[] {
  if (States.matches(snapshot, 'Cart')) {
    const events: Event[] = [{ _tag: 'Checkout' }];
    if (snapshot.value.items < 2) {
      events.push({ _tag: 'AddItem' });
    }
    if (snapshot.value.items > 1) {
      events.push({ _tag: 'RemoveItem' });
    }
    return events;
  }
  return States.matches(snapshot, 'PaymentPending') ? [{ _tag: 'Back' }] : [];
}

function currentReply(snapshot: Snapshot): Event[] {
  return States.get(snapshot, 'PaymentPending').pipe(
    Option.match({
      onNone: () => [],
      onSome: ({ amount }) => [{ _tag: 'PaymentSucceeded', amount }, { _tag: 'PaymentFailed', amount }],
    }),
  );
}

function inFlight(steps: readonly Step[]): number[] {
  const amounts = new Set<number>();
  for (const { event, before } of steps) {
    if (event._tag === 'Checkout' && States.matches(before, 'Cart')) {
      amounts.add(before.value.items * price);
    }
    if (event._tag === 'PaymentSucceeded' || event._tag === 'PaymentFailed') {
      amounts.delete(event.amount);
    }
  }
  return [...amounts].sort((a, b) => a - b);
}

function inFlightReplies(steps: readonly Step[]): Event[] {
  return inFlight(steps).flatMap((amount) => [{ _tag: 'PaymentSucceeded', amount }, { _tag: 'PaymentFailed', amount }]);
}

const invokeInvariant = MachineTest.invariants(invokeMachine).state('the paid amount matches the cart', ({ snapshot }) =>
  paidMatchesCart(snapshot),
);
const buggyInvariant = MachineTest.invariants(buggyMachine).state('the paid amount matches the cart', ({ snapshot }) =>
  paidMatchesCart(snapshot),
);
const fixedInvariant = MachineTest.invariants(fixedMachine).state('the paid amount matches the cart', ({ snapshot }) =>
  paidMatchesCart(snapshot),
);

describe('checkout under effect-machine', () => {
  it.effect('explores the invoke version without running the payment', () =>
    Effect.gen(function* () {
      const explored = yield* MachineTest.explore(invokeMachine, {
        events: ({ snapshot }) => userEvents(snapshot),
        stateKey: ({ snapshot }) => JSON.stringify(snapshot),
        invariants: [invokeInvariant],
      });
      console.log(explored.stats, explored.completeness._tag);
      console.log(
        explored.transitionCoverage.definitions.misses.map((miss) => ({ source: miss.source, trigger: miss.trigger })),
      );
      expect(explored.completeness._tag).toBe('Complete');
      expect(explored.stats.states).toBe(4);
      expect(explored.nodes.some((node) => States.matches(node.snapshot, 'Paid'))).toBe(false);
    }),
  );

  it.effect('passes when only the reply to the current request is sent', () =>
    Effect.gen(function* () {
      const explored = yield* MachineTest.explore(buggyMachine, {
        events: ({ snapshot }) => [...userEvents(snapshot), ...currentReply(snapshot)],
        stateKey: ({ snapshot }) => JSON.stringify(snapshot),
        invariants: [buggyInvariant],
      });
      console.log(explored.stats, explored.completeness._tag);
      console.log(explored.transitionCoverage.definitions.hit, '/', explored.transitionCoverage.definitions.total);
      expect(explored.completeness._tag).toBe('Complete');
      expect(explored.stats.states).toBe(8);
    }),
  );

  it.effect('finds the stale reply when every reply still in flight is sent', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        MachineTest.explore(buggyMachine, {
          events: ({ snapshot, trace }) => [...userEvents(snapshot), ...inFlightReplies(trace.steps)],
          stateKey: ({ snapshot, trace }) => JSON.stringify([snapshot, inFlight(trace.steps)]),
          invariants: [buggyInvariant],
        }),
      );
      expect(error._tag).toBe('MachineTestInvariantError');
      if (error._tag !== 'MachineTestInvariantError') {
        return;
      }
      console.log(MachineTest.formatTrace(error.trace));
      console.log(error.violations.map((violation) => violation.message));
      expect(error.trace.steps.map((step) => step.event._tag)).toEqual([
        'Checkout',
        'Back',
        'AddItem',
        'Checkout',
        'PaymentSucceeded',
      ]);
    }),
  );

  it.effect('holds on the fixed machine with every reply still in flight', () =>
    Effect.gen(function* () {
      const explored = yield* MachineTest.explore(fixedMachine, {
        events: ({ snapshot, trace }) => [...userEvents(snapshot), ...inFlightReplies(trace.steps)],
        stateKey: ({ snapshot, trace }) => JSON.stringify([snapshot, inFlight(trace.steps)]),
        invariants: [fixedInvariant],
      });
      console.log(explored.stats, explored.completeness._tag);
      expect(explored.completeness._tag).toBe('Complete');
      expect(explored.stats.states).toBe(8);
    }),
  );
});
