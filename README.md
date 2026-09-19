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
