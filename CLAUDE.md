# speccraft-ts

Model checker as a TypeScript library. A spec is plain TS: initial state, actions with guard + effect, invariants. The engine explores every reachable state exhaustively and reports counterexample traces.

## Toolchain

- pnpm, Node 24, TypeScript strict, ESM only.
- `pnpm typecheck`, `pnpm build`. No test framework wired up yet.
- npm package name is `speccraft` (bare, no suffix); repo name carries the `-ts`.

## Git

- Commit messages are one plain sentence, nothing else.
- Never add Claude co-author lines, session links, or "Generated with" footers to commits or PRs.
- Commits are authored by Alex's configured git identity only.

## Conventions

- No em dashes anywhere (code, docs, README) - plain hyphens only.
- Demo/example code stays bare: no teaching comments, no lesson-style log lines.
- Never `void somePromise()` - async functions handle failure inside, then call bare.
- Trace, state, and counterexample serialization formats must stay language-neutral JSON - future ports (speccraft-go) will share them.
