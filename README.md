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

A spec being proven correct says nothing about whether the code that's supposed to implement it actually does. `checkConformance` walks the same reachable-state graph, but drives a real implementation through it alongside the spec and checks that they agree at every step:

```ts
import { checkConformance } from 'speccraft';

const result = checkConformance(spec, {
  init: () => realImplementation.newInstance(),
  apply: (r, actionName) => realImplementation.run(r, actionName),
  project: (r) => realImplementation.toSpecShape(r),
});
// result.visitedCount
// result.mismatch?: { trace, action, expected, actual }
```

`apply` must return a new state rather than mutate its input - the same state gets replayed against every action whose guard holds there, not just the first one tried. `project` maps the real implementation's own state shape down to the spec's, so the real system doesn't have to mirror the spec's representation.

Part of [SpecCraft](https://speccraft.io).

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Both examples are numbered step by step - write the spec, find a bug with `explore()`, fix it, write a real implementation, catch a bug in *that* with `checkConformance()`, fix it - so the files read top to bottom like a workbook.

`examples/crosswalk/` is the small one: a one-clause guard bug, then an implementation bug conformance testing catches that the spec never had.

`examples/document-model/` ports a real spec (from a case study, not a toy) with a known-correct answer (283,951 reachable states, 15 invariants holding, 4 refuted beliefs staying false), then checks an independently-written implementation against it.

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

## Roadmap

- Ship `speccraft@0.1.0` to npm. Blocked: the bare name has a prior unrelated publish/unpublish history on the registry, which needs resolving before the `workflow_dispatch` publish can just be retried.
- Data nondeterminism: let an action's `effect` return multiple possible next states, not just one.
- State fingerprinting instead of `JSON.stringify` keys, so larger state spaces don't hit memory walls as fast.
- Conformance testing is in as `checkConformance`; next is checking a sampled subset of transitions for state spaces too large to walk exhaustively, and reporting more than just the first mismatch.
- Basic liveness: cycle/SCC detection over the reachable-state graph for the common "eventually P" and "P leads to Q" patterns, without taking on full LTL or fairness.
- speccraft-go: a Go port of the engine sharing the same JSON state, trace, and counterexample formats.
- A trace explorer for browsing counterexample traces instead of reading raw JSON.
