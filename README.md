# speccraft

Write specs in TypeScript and check them exhaustively - guarded actions, invariants, counterexample traces.

No new language: the spec is plain TypeScript, the checker explores every reachable state and hands you the exact step-by-step trace when an invariant breaks.

```ts
import { explore } from 'speccraft';

const spec = {
  init: () => ({ count: 0 }),
  actions: [
    { name: 'inc', guard: (s) => s.count < 5, effect: (s) => ({ count: s.count + 1 }) },
  ],
  invariants: [
    { name: 'bounded', check: (s) => s.count <= 5 },
  ],
};

const result = explore(spec);
// result.visitedCount, result.endings, result.stuck
// result.invariants: [{ name, holds, counterexample? }]
```

`explore` does a breadth-first search over every reachable state. Each invariant is checked in every state, and the first violation comes back with the shortest action trace from `init()` to the failing state. A dead end (no action's guard holds) lands in `endings`, or in `stuck` if you pass a `stuck(s)` predicate on the spec to flag dead ends that mean something is waiting forever.

Part of [SpecCraft](https://speccraft.io).

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

`examples/crosswalk/` is the small demo: a one-clause bug that lets a pedestrian get a walk signal while cars still have the green light, found in two steps.

`examples/document-model/` ports a real spec (from a case study, not a toy) through `explore()` end to end: `run.ts` prints the same stats a hand-rolled checker would, and `model.test.ts` pins the exact numbers (283,951 reachable states, every invariant holding, every refuted belief still false) as a regression test.

## Example ideas

- Token bucket / rate limiter - refill vs. consume actions, invariant that tokens never exceed capacity or go negative.
- Elevator dispatcher - floor requests, up/down state, door open/close; invariant that doors never open while moving.
- Bank transfer / ledger - two accounts, transfer action with a balance guard; invariant that total money is conserved.
- Vending machine - insert coin, select item, dispense, refund; invariant that dispensed count never exceeds paid amount.
- Traffic light intersection (two directions) - invariant that both directions are never green at once.
- Optimistic-lock / version counter - two writers reading a version, writing only if it's unchanged; invariant no lost update.
- Distributed lock with lease/timeout - acquire, renew, expire, release; invariant only one holder at a time.
- Idempotency key cache - request arrives, checks cache, processes, stores result; invariant duplicate requests never double-process.
- Shopping cart checkout with inventory reservation - reserve on add-to-cart, release on timeout/cancel, commit on pay; invariant reserved plus available never exceeds stock.
- Simple saga / two-phase workflow with compensation - step A, step B, compensate A if B fails; invariant no state where B succeeded and A's compensation also ran.
