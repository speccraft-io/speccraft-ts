# Crosswalk example

A small, self-contained demonstration of what `explore()` is for: it takes a
plausible-looking spec with a one-clause bug in it, and finds the exact two
steps that break safety, instead of that bug waiting to be found by a person
standing at the crossing.

Run it: `npx tsx run.ts` (from this folder). `model.test.ts` pins both
outcomes as a regression check, run with `pnpm test` from the package root.

## Product requirements

A pedestrian crossing sits next to a set of car traffic lights. A pedestrian
can press a button to request to cross. The car light cycles green, yellow,
red, and back to green on its own. Once a crossing has been requested, the
walk signal turns on as soon as it safely can, and turns off again once the
pedestrian has had their turn. Car traffic only goes green again once nobody
currently has the walk signal.

**The one requirement that actually matters:** a pedestrian is only ever
shown a walk signal while car traffic is stopped. Getting this wrong is not
a cosmetic bug.

## The bug

`model.ts` defines two versions of the same spec, sharing every action
except one guard.

The buggy version's "grant walk" action fires as soon as a crossing has been
requested and no walk signal is already showing:

- guard: a crossing is requested, and the walk signal is currently off
- effect: turn the walk signal on, clear the request

That reads fine on its own. It is also missing a clause: nothing here checks
that the car light is actually red. If a pedestrian presses the button while
the light is still green, the walk signal turns on immediately, while cars
still have the green light.

`explore()` finds this in two steps from the starting state (car light
green, walk signal off, nothing requested):

```
press button   -> a crossing is now requested
grant walk     -> the buggy guard is satisfied; walk signal turns on
                  while the car light is still green
```

Running `run.ts` prints exactly that:

```
buggy model: visited 12 states
  VIOLATED: pedestrians only get a walk signal while car traffic is stopped
  trace: press button -> grant walk
```

## The fix

The fixed version adds the missing clause to the same guard: a crossing is
requested, the walk signal is off, **and the car light is red**. Nothing
else about the spec changes. `explore()` walks all 8 reachable states of the
fixed version and confirms the invariant holds in every one of them:

```
fixed model: visited 8 states
  holds: pedestrians only get a walk signal while car traffic is stopped
```

This is the point of the exercise: the bug is a single missing `&&`, the
kind of thing that is easy to write and easy to read past in review. The
checker does not read past it - it tries every reachable state and reports
the shortest path to the one that breaks the rule.
