# Journal

Milestones

## Stage 1: understanding the problem (2026-06-30 to 2026-09-16)

Trying to understand what happened with the workflow, put it into words, and find solutions. Result: formal methods,
a hand-built state enumerator, and Quint.

- 2026-06-30
  - The starting point: a production Temporal workflow for document drafting (uploads, file conversion, name detection,
    submit, convert) had grown past what its author could control. Weeks went into the same code, each fix added another
    flag or lock, and races kept surfacing in QA and production. A second workflow (AI signature) and a messaging app
    written ten years earlier had the same shape. The practice repo, and later SpecCraft, came out of trying to
    understand why.
  - Idea: the Temporal ecosystem lacks tools for this kind of complexity - simulation, smart monitoring, help building
    and maintaining complex workflows, formal evaluation of their correctness. Build the tool you needed yourself. First
    chats about a tool called SpecCraft.
  - Specula (an AI that translates code to TLA+ and model-checks it) tried blind on both workflows.
- 2026-07-01
  - Survey of about 35 correctness tools and approaches (Coyote, P, TLA+, Quint, Stateright, Restate, DBOS, Temporal's
    own guidance, Antithesis, and more). Main finding: hazards that live in one workflow's own bookkeeping are
    tractable; hazards across two stores are not.
- 2026-07-02
  - A catalog of how the two workflows actually went wrong, meant as the ground truth any tool gets graded against.
- 2026-07-05
  - Found property-based testing (fast-check) and Dafny's way of modeling concurrency. Property tests on both workflows
    came back green and found nothing: they confirm beliefs, they don't hunt.
- 2026-07-07
  - First product sketch for SpecCraft (open source core plus product). Felt like a rabbit hole without knowing the real
    goal.
- 2026-07-09
  - Insight: splitting code into modules abstracts the code, but these bugs are about state (who changes it) and time
    (what orders are possible). That is why cleaning up the code never gave confidence.
- 2026-07-10
  - Hands-on refactor of the draft workflow: typed shared state, owners for state, lifecycle files, locks.
- 2026-07-11 to 2026-09-08
  - Paused to learn basics: algorithms, math, the TypeScript type system, functional and object-oriented programming,
    concurrency, system design.
- 2026-09-09
  - Back on the workflow. The July refactor was reverted: it moved state behind named owners, but every decision stayed
    scattered across handlers, so understanding did not improve. A sharing-map script showed 5 of 40 handlers change the
    facts all the others act on.
- 2026-09-10
  - The decide page: the workflow as a small table of (state, event) pairs. Then an ordering explorer tried every order
    of up to 3 events and found all 5 known failure stories on its own.
  - Idea: not more effort to understand the mess, but a tool that shows it, the way a latency chart makes reading a
    latency table unnecessary.
  - Goal corrected: not understanding this one workflow, but what happened, how to describe it, how to approach it, and
    how to see it coming.
- 2026-09-11
  - Names found: the feature interaction problem (each rule correct alone, conflicts in combination), confluence,
    implicit invocation. Early signal: the second hand-made flag or lock around the same thing. Cure shape: one owner of
    the state, one place that decides.
  - Idea: the problem is triggers ("do this after that happened"), many of them, conflicting like a heater and a cooler
    in one room. A trigger map was built: every write, the conditions it feeds, and the chains they form.
  - A synthetic case study: a small document app built rule by rule. 6 events gave 54 distinct endings; 9 events gave
    23.7M reachable states and 671 endings. Exhaustive search disproved a belief checked by hand.
  - Idea: product decisions hide as guards and waits in code. A decisions ledger lists every wait and refusal the code
    enforces, each ending in "On purpose? __".
  - Idea: start from invariants - they should be the first document.
- 2026-09-12
  - The synthetic app got a settled spec, and two styles of implementation both passed all 16 invariants. Correctness
    came from the spec, not the architecture; architecture only made the state space 11.8x smaller.
  - Reframe: the checker is a tool for discovering requirements, not only for verifying them. Missed requirements live
    in combinations of rules; a head cannot list combinations, a checker can.
  - Idea: mark an undecided rule as UNDECIDED instead of guessing; the search returns every reachable state that hits
    it, with a shortest trace - a corner-case question for the product owner.
- 2026-09-13
  - Standard words adopted: variables, actions, next-state relation, state predicates. The spec-driven order: variables
    and messages first, then actions, then invariants.
- 2026-09-14
  - Rules for guards and effects: a guard reads only state; a command's guard is a refusal, an event's guard is a wait;
    a command the caller waits on is two actions; "is it needed" and "is it allowed now" are kept apart.
  - Idea: one parameterized event (conversion failed f) instead of one event per file; the checker expands it into
    concrete actions.
- 2026-09-16
  - A hand-built BFS checker: 283,951 states for the document model. The model was ported to Quint, and a liveness check
    found a real spec bug (renaming to the same name starved the summary forever). The spec was turned into code, and
    the code was proven against the model with a conformance harness. A second version on XState and Effection:
    Effection's cancel removed the generation counters.
  - Idea: one reusable test ladder that runs against every implementation version, kept visibly apart from the code of
    each version.

## Stage 2: specs on real problems (2026-09-17 to 2026-09-19)

More spec-driven experiments, this time on a new domain (an SQS-like queue). Result: the idea of a dedicated TS
package with exhaustive state enumeration.

- 2026-09-17
  - Idea: one spec file per machine instead of several pages, versioned with the code.
  - Idea: split a system into machines by the conflict rule (two activities conflict when one writes what the other
    reads); a clean package seam is one no variable crosses.
  - A change process with a human and an LLM: human edits the spec, LLM reviews it and mirrors it to the model and the
    oracle, human reads the surprises, LLM changes the code until it agrees with the oracle.
- 2026-09-18
  - The method reused on an SQS-like queue: four passes (receipt handles, long polling, changeable maxReceiveCount, DLQ
    as a second queue), each through spec, Quint, oracle, code, conformance. Lessons: negative-test every claim so it
    can actually fail; model bounds must never leak into product code.
  - Idea: editing the prose spec is slow and error-prone; check each edit right away instead, or make the checkable
    model the spec itself.
- 2026-09-19
  - Idea: the 4-model approach (a TS oracle plus an enumerator, no TLA+ at all) as a tool of its own. Is there one
    already?

## Stage 3: speccraft-ts (2026-09-19 to now)

A dedicated TS tool that lets TS developers write an abstract spec and use it seamlessly in a project. Includes
research on existing libraries, stateproof (https://github.com/HexaField/stateproof) and its downsides.

- 2026-09-19
  - Market check: no TypeScript tool combines free-form state, guarded actions, invariants, exhaustive search and
    traces. fast-check samples randomly, XState forces a machine shape, stateproof compiles a subset of TS to TLA+.
    speccraft-ts started. Position: speccraft runs your spec instead of translating it.
  - Idea: one engine per language (speccraft-go next), sharing everything else - JSON formats for states, traces and
    counterexamples, the CLI, a trace explorer.
  - Idea: rebuild the case study's checker in speccraft-ts, publish it, then use it on a real project.
  - explore(): the hand-built checker made generic. The document model reproduces its known numbers exactly. Crosswalk
    added as a small example with a one-clause bug.
  - Roadmap written: data nondeterminism (an effect with several possible next states), state fingerprinting for scale,
    conformance, basic liveness, speccraft-go, a trace explorer. Ten example ideas listed.
  - checkConformance(): walks the same state graph against a real implementation through apply and project, and reports
    the first mismatch with its trace.
  - Idea: examples as workbooks - numbered files that read top to bottom as the story, plus a runner that prints every
    stage.
- 2026-09-20
  - The original question answered: the complexity was never written down anywhere concrete. A formal spec plus its
    counterexample traces is the description. Going further: with a checker you do not need to hold the whole system in
    your head to be confident in it.
- 2026-09-21
  - Idea: pretend version 1 shipped, then add a feature that is hard to get right and ships with its own bug - the way
    it happens in real life. Start even simpler: car lights first, the button bolted on later.
- 2026-09-22
  - Crosswalk got that naive pre-spec code. Conformance proved it has the same bug as the buggy spec. Found: conformance
    only checks moves the spec allows, never what the code does where the spec says no.
  - Idea: instead of a separate spec and implementation, one annotated file - spec, implementation, and optional notes
    on what the spec means - with decorators on the real code.
  - Idea: keep both forms for users, decorators and a plain annotate() call.
  - Idea: three modes, each used where it fits - standalone spec with conformance, inline with decorators, inline with
    annotate().
  - Idea: annotate the existing state fields so guards and effects see them, instead of repeating the start state by
    hand.
  - Idea: a spec field does not copy the real type; it maps it to a small, abstract version that keeps only the idea (a
    cart list becomes { A: 'none' | 'one' | 'many' }).
  - Idea: bound an unbounded field where it is declared, so the limit is seen right there.
  - Idea: make the inline mode as fast as the standalone one (today it replays each trace on a fresh instance).
  - Inline specs built: guard and effect next to the real method (@spec.Action), real fields mapped to spec types
    (@spec.State(itemLevels)), async replies as channels the explorer delivers in every order. A cart example catches a
    stale delivery quote.
  - Published to npm as @speccraft-io/core.
- 2026-09-23
  - Idea: a CLI that checks annotated models and specs with no test file, plus a watch mode that re-explores on every
    save and prints issues.
  - Idea: spec and implementation in separate files but linked, the spec kept plain and the implementation carrying thin
    references to spec actions and state, so the conformance adapter is built from the links instead of written by hand.
  - Idea: borrow from Effect.ts and Effection. Controlled async, so the explorer decides when each reply lands and can
    cancel cleanly; swappable services instead of hand-made real and explorable dependencies.
  - This journal.
  - Found LemmaScript (https://github.com/midspiral/LemmaScript): TypeScript with contract comments, translated to Dafny
    or Lean, proofs written by an LLM. It proves functions correct for every input; SpecCraft explores orders of events.
    The two work together: LemmaScript for the pure core, SpecCraft for the coordination around it. Worth borrowing:
    contracts as comments, one file list for local runs and CI.
  - Comparison pages on speccraft.io: a "SpecCraft vs ..." group with LemmaScript and stateproof, including who builds
    stateproof (HexaField, a side project, no activity since March 2026).
  - Research on similar TypeScript tools found that corner 2 (a model checker as a library) is no longer empty in
    TypeScript since 2026. Closest: pnueli (the same engine idea plus reductions and liveness, but model only),
    Polygraph (an LLM derives the spec from code, then model-checks it), tla-precheck (a small TS DSL compiled to TLA+
    and checked against its own interpreter). Also modality-ts, quint-connect-ts, tla-checker, and seeded-schedule
    testers for Node (chronos, unflake, unluck, determined). None does all of SpecCraft's combination: a spec written
    first in full TypeScript, conformance of real code over the whole state graph, and inline specs with async replies
    in every order.
  - Worth borrowing from them: steps that return several next states and declared reads and writes (pnueli), state
    budgets and tiers (tla-precheck), grading invariants against mutated models (Polygraph).
  - speccraft.io: dedicated pages for pnueli, Polygraph and tla-precheck, the All tools page and both diagrams updated,
    a TL;DR at its top, and the "Thinking tools." banner on the home page.
  - Idea: SpecCraft as the larger thing (the spec-first method, shared JSON formats, CLI, trace explorer) and
    speccraft-ts as its first engine, with speccraft-go next. A Quint comparison page belongs to that level: one
    language-neutral spec versus specs in each language.
  - SpecCraft on Bluesky: @speccraft.bsky.social, with a 1500x500 banner. The speccraft.io header now links GitHub,
    npm, LinkedIn, Bluesky and zalizniak.com, all opening in a new tab.
  - A second, wider search for TypeScript competitors (npm, GitHub, the web, and npm's own search through a
    browser). Still nothing with the full combination. New closest finds, all from 2026: stifinder (a search core
    that reports the failure needing the fewest departures from the expected schedule; its author's kilde/testing
    runs real stream code through every pause and delivery order), effect-machine (bounded BFS over Effect
    statecharts, about 53k downloads a month, async work not run during the search), and Bombadil from Antithesis
    (TypeScript temporal properties, sampled against real web and terminal UIs). Also cloudfault, formalizr,
    deja-dst, uneffect, weavecheck, quint-refinements, and typescript-actors from the P team (2017) as prior art
    for controlling all async.
  - Worth borrowing: order the search by fewest departures from a default schedule, named cost budgets for faults
    (stifinder); a result that states whether it was complete; transition and guard coverage (effect-machine);
    small temporal operator names and default properties (Bombadil).
  - speccraft.io: pages for stifinder, effect-machine and Bombadil, the rest added to the All tools table, and the
    positioning map split into two: TypeScript tools only, and all languages.
  - fast-check had been missed, because the searches looked for model checkers. A third search started from
    popularity instead and widened the radius to every correctness tool a TypeScript team meets: property testing,
    fuzzing, static verification, runtime verification, schemas. Nothing popular searches every state. The popular
    neighbors control time (fake timers, about 250M downloads a month), prevent bugs by construction (Effect),
    sample inputs (fast-check, Hegel from the Hypothesis authors), test the tests (Stryker), or check data shape
    (zod and other schema libraries).
  - Gaps found in TypeScript: no maintained linearizability checker, LTL runtime monitor, or session-types library.
  - speccraft.io reorganized: "SpecCraft vs TS tools" (an overview plus pages for fast-check, Hegel, Effect, fake
    timers, and one page for the other TS tools) and "Non-TS tools" (a comparison page for TLA+, Quint, Stateright,
    Coyote and the rest, next to the Lean, Dafny and Quint try-it pages).
  - A last pass through Bluesky, Reddit (through Google), and Japanese, Chinese and Korean communities. No new model
    checker for TypeScript. Small new neighbors: Thales (a TypeScript subset compiled to Lean), pabst (JSDoc
    properties checked by fast-check), and mizchi's ts-fuzzing, chaosbringer and dspec.
  - Demand signals: Reddit threads asking how to test race conditions in webhooks and async code, and Japanese
    articles checking TypeScript workflows by hand with Lean, TLA+ or Quint, with no TypeScript tool for it.
