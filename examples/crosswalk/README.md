# Crosswalk example

A small, self-contained walkthrough of the whole method: write a spec, find a bug in it, fix it, then check that a real implementation actually does what the proven-correct spec says. Read the files in order, `01` through `04` - each one is a single step and builds on the last.

Run the whole story: `npx tsx run.ts` (from this folder). Each step also has its own test file, run with `pnpm test` from the package root.

## Product requirements

A pedestrian crossing sits next to a set of car traffic lights. A pedestrian can press a button to request to cross. The car light cycles green, yellow, red, and back to green on its own. Once a crossing has been requested, the walk signal turns on as soon as it safely can, and turns off again once the pedestrian has had their turn. Car traffic only goes green again once nobody currently has the walk signal.

**The one requirement that actually matters:** a pedestrian is only ever shown a walk signal while car traffic is stopped. Getting this wrong is not a cosmetic bug.

## Step 1: the spec, as first written (`01-spec.ts`, `01-spec.test.ts`)

The first draft's "grant walk" action fires as soon as a crossing has been requested and no walk signal is already showing:

- guard: a crossing is requested, and the walk signal is currently off
- effect: turn the walk signal on, clear the request

That reads fine on its own. It is also missing a clause: nothing here checks that the car light is actually red. `explore()` finds this in two steps from the starting state (car light green, walk signal off, nothing requested):

```
press button   -> a crossing is now requested
grant walk     -> the guard is satisfied; walk signal turns on while the car light is still green
```

## Step 2: the fixed spec (`02-spec-fixed.ts`, `02-spec-fixed.test.ts`)

Same spec, one added clause: a crossing is requested, the walk signal is off, **and the car light is red**. `explore()` walks all 8 reachable states and confirms the invariant holds in every one of them. This is the point of step 1 and 2 together: the bug is a single missing `&&`, the kind of thing that is easy to write and easy to read past in review. The checker does not read past it.

## Step 3: a real implementation, checked against the proven-correct spec (`03-implementation.ts`, `03-conformance.test.ts`)

A spec being proven correct says nothing about whether the code that is supposed to implement it actually does. `03-implementation.ts` is a small, independently-written controller - it even keeps its own state differently (a numeric light phase instead of the spec's `'green' | 'yellow' | 'red'` strings), which is normal for real code.

It has a bug the spec never had: granting the walk signal correctly turns it on, but forgets to clear the pending request. `checkConformance()` drives the real implementation through every transition the spec says is legal and compares the result at each step:

```
MISMATCH on "grant walk"
trace: press button -> car turns yellow -> car turns red -> grant walk
expected: {"carLight":"red","walkSignal":"walk","requested":false}
actual:   {"carLight":"red","walkSignal":"walk","requested":true}
```

## Step 4: the fixed implementation (`04-implementation-fixed.ts`, `04-conformance.test.ts`)

Same implementation, one added line: clear `requested` when granting the walk. `checkConformance()` now walks all 8 reachable states with no mismatch - the real code and the proven-correct spec agree everywhere.
