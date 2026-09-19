# speccraft-ts

Model checker as a TypeScript library. A spec is plain TS: initial state, actions with guard + effect, invariants. The engine explores every reachable state exhaustively and reports counterexample traces.

## Toolchain

- pnpm, Node 24, TypeScript strict, ESM only.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- TS strictness and eslint rules are copied from the strictest project across the author's other repos, minus its `functional`-plugin model/ boundary rules, which are specific to that project's architecture.
- `tsconfig.base.json` holds the shared strict/module-hygiene flags; `tsconfig.json` (typecheck, includes `src` + `examples`) and `tsconfig.build.json` (emits `dist` from `src` only, excludes `*.test.ts`) both extend it.
- `examples/` holds runnable specs that exercise the library end to end; not part of the published package.
- npm package name is `speccraft` (bare, no suffix); repo name carries the `-ts`.

## Git

- Commit messages are one plain sentence, nothing else.
- Never add Claude co-author lines, session links, or "Generated with" footers to commits or PRs.
- Commits are authored by the maintainer's configured git identity only.

## Conventions

- No em dashes anywhere (code, docs, README) - plain hyphens only.
- Demo/example code stays bare: no teaching comments, no lesson-style log lines.
- Never `void somePromise()` - async functions handle failure inside, then call bare.
- Trace, state, and counterexample serialization formats must stay language-neutral JSON - future ports (speccraft-go) will share them.
