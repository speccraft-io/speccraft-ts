export type Action<S> = {
  name: string;
  guard: (s: S) => boolean;
  effect: (s: S) => S;
};

export type Invariant<S> = {
  name: string;
  check: (s: S) => boolean;
};

export type Spec<S> = {
  init: () => S;
  actions: Array<Action<S>>;
  invariants: Array<Invariant<S>>;
};
