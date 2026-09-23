import type { Action, Spec } from '../../src/index.js';

type Screen = 'cart' | 'pending' | 'paid' | 'failed';

export interface State {
  readonly screen: Screen;
  readonly items: number;
  readonly paid: number | null;
  readonly inFlight: readonly number[];
}

const price = 10;
const amounts = [10, 20];

function init(): State {
  return { screen: 'cart', items: 1, paid: null, inFlight: [] };
}

function without(inFlight: readonly number[], amount: number): number[] {
  return inFlight.filter((a) => a !== amount);
}

const cartActions: Action<State>[] = [
  {
    name: 'add item',
    guard: (s) => s.screen === 'cart' && s.items < 2,
    effect: (s) => ({ ...s, items: s.items + 1 }),
  },
  {
    name: 'remove item',
    guard: (s) => s.screen === 'cart' && s.items > 1,
    effect: (s) => ({ ...s, items: s.items - 1 }),
  },
  {
    name: 'checkout',
    guard: (s) => s.screen === 'cart',
    effect: (s) => ({
      ...s,
      screen: 'pending',
      inFlight: [...without(s.inFlight, s.items * price), s.items * price].sort((a, b) => a - b),
    }),
  },
];

const back: Action<State> = {
  name: 'back',
  guard: (s) => s.screen === 'pending',
  effect: (s) => ({ ...s, screen: 'cart' }),
};

const replies: Action<State>[] = amounts.flatMap((amount): Action<State>[] => [
  {
    name: `payment of ${amount} succeeds`,
    guard: (s) => s.inFlight.includes(amount),
    effect: (s) => ({
      ...s,
      inFlight: without(s.inFlight, amount),
      ...(s.screen === 'pending' ? { screen: 'paid', paid: amount } : {}),
    }),
  },
  {
    name: `payment of ${amount} fails`,
    guard: (s) => s.inFlight.includes(amount),
    effect: (s) => ({
      ...s,
      inFlight: without(s.inFlight, amount),
      ...(s.screen === 'pending' ? { screen: 'failed' } : {}),
    }),
  },
]);

function checkoutSpec(actions: Action<State>[]): Spec<State> {
  return {
    init,
    actions: [...actions, ...replies],
    invariants: [
      { name: 'the paid amount matches the cart', check: (s) => s.screen !== 'paid' || s.paid === s.items * price },
    ],
  };
}

export const buggySpec: Spec<State> = checkoutSpec([...cartActions, back]);
export const fixedSpec: Spec<State> = checkoutSpec(cartActions);
