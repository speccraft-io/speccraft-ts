# speccraft

Write specs in TypeScript and check them exhaustively - guarded actions, invariants, counterexample traces.

No new language: the spec is plain TypeScript, the checker explores every reachable state and hands you the exact step-by-step trace when an invariant breaks.

```ts
// API sketch - under development, not published yet
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
```

Part of [SpecCraft](https://speccraft.io).

## Development

```sh
pnpm install
pnpm typecheck
pnpm build
```
