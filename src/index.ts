export interface Action<S> {
  name: string;
  guard: (s: S) => boolean;
  effect: (s: S) => S;
}

export interface Invariant<S> {
  name: string;
  check: (s: S) => boolean;
}

export interface Spec<S> {
  init: () => S;
  actions: Action<S>[];
  invariants: Invariant<S>[];
  stuck?: (s: S) => boolean;
}

export interface InvariantResult {
  name: string;
  holds: boolean;
  counterexample?: string[];
}

export interface ExploreResult<S> {
  visitedCount: number;
  endings: S[];
  stuck: S[];
  invariants: InvariantResult[];
}

export function explore<S>(spec: Spec<S>): ExploreResult<S> {
  const seed = spec.init();
  const queue: S[] = [seed];
  const visited = new Set<string>([JSON.stringify(seed)]);
  const endings: S[] = [];
  const stuck: S[] = [];
  const traces = new Map<string, { parent: string; action: string }>();
  const counterexamples = new Map<Invariant<S>, string[]>();

  // queue grows during iteration; for-of re-reads .length on every step, so
  // this walks newly pushed states too, breadth-first.
  for (const s of queue) {
    const sKey = JSON.stringify(s);
    let numActions = 0;

    for (const invariant of spec.invariants) {
      if (!invariant.check(s) && !counterexamples.has(invariant)) {
        const trace: string[] = [];
        let key = sKey;
        let step = traces.get(key);
        while (step !== undefined) {
          trace.unshift(step.action);
          key = step.parent;
          step = traces.get(key);
        }
        counterexamples.set(invariant, trace);
      }
    }

    for (const action of spec.actions) {
      if (action.guard(s)) {
        numActions++;
        const next = action.effect(s);
        const nextKey = JSON.stringify(next);
        if (!visited.has(nextKey)) {
          queue.push(next);
          visited.add(nextKey);
          traces.set(nextKey, { parent: sKey, action: action.name });
        }
      }
    }

    if (numActions === 0) {
      if (spec.stuck?.(s) === true) {
        stuck.push(s);
      } else {
        endings.push(s);
      }
    }
  }

  return {
    visitedCount: visited.size,
    endings,
    stuck,
    invariants: spec.invariants.map((invariant): InvariantResult => {
      const counterexample = counterexamples.get(invariant);
      return counterexample === undefined
        ? { name: invariant.name, holds: true }
        : { name: invariant.name, holds: false, counterexample };
    }),
  };
}
