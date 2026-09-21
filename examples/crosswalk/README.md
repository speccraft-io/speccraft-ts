# Crosswalk example

A small, self-contained walkthrough of the whole method: write a spec, find a bug in it, fix it, then check that a real
implementation actually does what the proven-correct spec says. Read the files in order, `00a` through `04` - each one
is a single step and builds on the last.

Run the whole story: `npx tsx run.ts` (from this folder). Each step also has its own test file, run with `pnpm test`
from the package root.

## Product requirements

A pedestrian crossing sits next to a set of car traffic lights. A pedestrian can press a button to request to cross. The
car light cycles green, yellow, red, and back to green on its own. Once a crossing has been requested, the walk signal
turns on as soon as it safely can, and turns off again once the pedestrian has had their turn. Car traffic only goes
green again once nobody currently has the walk signal.

**The one requirement that actually matters:** a pedestrian is only ever shown a walk signal while car traffic is
stopped. Getting this wrong is not a cosmetic bug.

## Step 0a: a plain car-light controller, already in production (`00a-naive-lights.ts`, `00a-naive-lights.test.ts`)

Before there is any pedestrian feature, there is just a car light: `start()` kicks off a `setInterval` that cycles it
green -> yellow -> red -> green, forever, on its own clock. This ships. It works. There is no pedestrian yet, so
there is no invariant for it to violate - `00a-naive-lights.test.ts` just confirms the cycle advances correctly.

## Step 0b: adding a pedestrian button to it (`00b-naive-crosswalk.ts`, `00b-naive-crosswalk.test.ts`)

Now a pedestrian crossing gets added to the light controller that is already running in production. This is the
feature that is hard to get right: a `pressButton()` call has to interact correctly with a light cycle that already
exists, runs on its own clock, and was never designed with a pedestrian in mind. The natural way to bolt it on is
another timer callback that advances the light and, while it's at it, checks whether a walk can now be granted - a
genuinely separate, external `pressButton()` call with no coordination between the two:

```
every tick (on its own timer):
  advanceLight()          // green -> yellow -> red -> green
  grantWalkIfRequested()  // if requested and no walk showing, turn the walk signal on

pressButton() (whenever a pedestrian happens to press it):
  requested = true
```

That reads fine, and a quick manual check - press the button while the light happens to be yellow, watch it turn
red just as the walk signal comes on - looks correct. The bug is that `grantWalkIfRequested()` only checks
"requested" and "no walk already showing"; it never checks that `advanceLight()` actually got the light to red
first. It only looked right because the tick that turned the light red is the same tick that granted the walk.
Press the button earlier instead - while the light is still green - and the very next tick grants the walk before
the light is anywhere close to red:

```
pressButton()   -> pressed immediately, while the light is still green
(next tick)     -> advanceLight() moves green -> yellow, grantWalkIfRequested() turns the walk signal on anyway
```

`00b-naive-crosswalk.test.ts` has both cases side by side: press the button while the light is yellow, one tick from
turning red, and it looks correct; press it right when the cycle starts, and the same code shows a walk signal next
to a yellow light. That is the real shape of the bug this kind of code invites - it is not one line you can point to
and say "wrong," it is a guard that only happens to be correct for some of the relative timings between an internal
clock and an external command, and nothing about reading the code up front tells you which timings those are.

## Step 1: the spec, as first written (`01-spec.ts`, `01-spec.test.ts`)

The first draft's "grant walk" action fires as soon as a crossing has been requested and no walk signal is already
showing:

- guard: a crossing is requested, and the walk signal is currently off
- effect: turn the walk signal on, clear the request

That reads fine on its own. It is also missing a clause: nothing here checks that the car light is actually red.
`explore()` finds this in two steps from the starting state (car light green, walk signal off, nothing requested):

```
press button   -> a crossing is now requested
grant walk     -> the guard is satisfied; walk signal turns on while the car light is still green
```

## Step 1b: checking the real, shipped implementation against that same buggy spec (`01b-naive-conformance.ts`,
`01b-naive-conformance.test.ts`)

Finding a hole in the spec is one thing - does the real, running code actually have it? `01b-naive-conformance.ts`
re-expresses `00b-naive-crosswalk.ts`'s actual logic action by action (same guards, same effects, bug included) and
checks it with `checkConformance()` against the *buggy* spec from step 1, not the fixed one. It walks all 12 of that
spec's reachable states and finds zero mismatches: the real controller conforms to this spec exactly, missing
red-light check and all. Combined with step 1's counterexample, that is a proof, not a guess, that the actual
production code shows a walk signal after nothing but `press button` -> `grant walk` - the same trace, in the real
system.

Checking the real implementation against the *fixed* spec instead would not have shown this: `checkConformance()`
only exercises actions the reference spec's own guards say are legal at each state, so with the fixed spec's guard
already requiring a red light, it would never even ask the real system what happens when the light isn't red yet -
and would report a clean, misleading conformance.

## Step 2: the fixed spec (`02-spec-fixed.ts`, `02-spec-fixed.test.ts`)

Same spec, one added clause: a crossing is requested, the walk signal is off, **and the car light is red**. `explore()`
walks all 8 reachable states and confirms the invariant holds in every one of them. This is the point of step 1 and 2
together: the bug is a single missing `&&`, the kind of thing that is easy to write and easy to read past in review. The
checker does not read past it.

## Step 3: a real implementation, checked against the proven-correct spec (`03-implementation.ts`,
`03-conformance.test.ts`)

A spec being proven correct says nothing about whether the code that is supposed to implement it actually does.
`03-implementation.ts` is a small, independently-written controller - it even keeps its own state differently (a numeric
light phase instead of the spec's `'green' | 'yellow' | 'red'` strings), which is normal for real code.

It has a bug the spec never had: granting the walk signal correctly turns it on, but forgets to clear the pending
request. `checkConformance()` drives the real implementation through every transition the spec says is legal and
compares the result at each step:

```
MISMATCH on "grant walk"
trace: press button -> car turns yellow -> car turns red -> grant walk
expected: {"carLight":"red","walkSignal":"walk","requested":false}
actual:   {"carLight":"red","walkSignal":"walk","requested":true}
```

## Step 4: the fixed implementation (`04-implementation-fixed.ts`, `04-conformance.test.ts`)

Same implementation, one added line: clear `requested` when granting the walk. `checkConformance()` now walks all 8
reachable states with no mismatch - the real code and the proven-correct spec agree everywhere.
