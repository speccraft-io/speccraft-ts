# speccraft

Write specs in TypeScript and check them exhaustively.

Part of [SpecCraft](https://speccraft.io). On npm as [`@speccraft-io/core`](https://www.npmjs.com/package/@speccraft-io/core). History of ideas and milestones: [JOURNAL.md](JOURNAL.md).

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

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

- Data nondeterminism: let an action's `effect` return multiple possible next states, not just one.
- State fingerprinting instead of `JSON.stringify` keys, so larger state spaces don't hit memory walls as fast.
- Conformance testing is in as `checkConformance`; next is checking a sampled subset of transitions for state spaces too large to walk exhaustively, and reporting more than just the first mismatch.
- Basic liveness: cycle/SCC detection over the reachable-state graph for the common "eventually P" and "P leads to Q" patterns, without taking on full LTL or fairness.
- speccraft-go: a Go port of the engine sharing the same JSON state, trace, and counterexample formats.
- A trace explorer for browsing counterexample traces instead of reading raw JSON.
