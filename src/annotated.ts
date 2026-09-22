import { explore } from './index.js';
import type { ConformanceMismatch, ExploreResult, Spec } from './index.js';

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const symbolCtor = Symbol as unknown as { metadata: symbol | undefined };
const metadataKey = (symbolCtor.metadata ??= Symbol.for('Symbol.metadata'));

export interface ActionOptions<S, A extends readonly unknown[] = []> {
  name: string;
  args?: readonly A[];
  guard: (s: S, ...args: A) => boolean;
  effect: (s: S, ...args: A) => S;
  delivers?: string;
  requestAs?: (request: never) => unknown;
  maxPending?: number;
}

export interface StateOptions<T, V = T> {
  as?: (value: T) => V;
  bound?: (value: V) => boolean;
}

export interface ModelOptions<S> {
  invariants?: Record<string, (s: S) => boolean>;
}

export type AnyActionOptions = ActionOptions<unknown, readonly unknown[]>;
type AnyModelOptions = ModelOptions<unknown>;

interface ActionEntry {
  key: PropertyKey;
  options: AnyActionOptions;
}

interface StateEntry {
  key: string;
  get: (instance: object) => unknown;
  bound?: (value: unknown) => boolean;
}

type AnyStateOptions = StateOptions<unknown, unknown>;

interface AnnotatedMetadata {
  model?: AnyModelOptions;
  state: StateEntry[];
  actions: ActionEntry[];
}

function annotatedMetadataOf(target: DecoratorMetadata): AnnotatedMetadata {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const store = target as Partial<AnnotatedMetadata> & DecoratorMetadataObject;
  store.state ??= [];
  store.actions ??= [];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return store as AnnotatedMetadata;
}

export function action<S, A extends readonly unknown[] = []>(options: ActionOptions<S, A>): AnyActionOptions {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return options as unknown as AnyActionOptions;
}

function eraseModel<S>(options: ModelOptions<S>): AnyModelOptions {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return options as unknown as AnyModelOptions;
}

function readProperty(instance: object, key: PropertyKey): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return (instance as Record<PropertyKey, unknown>)[key];
}

export function Model<S>(options: ModelOptions<S> = {}): (value: unknown, context: ClassDecoratorContext) => void {
  return function (_value: unknown, context: ClassDecoratorContext): void {
    annotatedMetadataOf(context.metadata).model = eraseModel(options);
  };
}

function stateEntry(key: string, read: (instance: object) => unknown, options: object): StateEntry {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const { as, bound } = options as unknown as AnyStateOptions;
  const get = as === undefined ? read : (instance: object): unknown => as(read(instance));
  return bound === undefined ? { key, get } : { key, get, bound };
}

function recordState(context: ClassFieldDecoratorContext, options: object): void {
  const { access } = context;
  annotatedMetadataOf(context.metadata).state.push(
    stateEntry(String(context.name), (instance: object): unknown => access.get(instance), options),
  );
}

export function State(value: undefined, context: ClassFieldDecoratorContext): void;
export function State<T, V = T>(
  options: StateOptions<T, V> | ((value: T) => V),
): (value: undefined, context: ClassFieldDecoratorContext<unknown, T>) => void;
export function State<T, V = T>(
  valueOrOptions: StateOptions<T, V> | ((value: T) => V) | undefined,
  context?: ClassFieldDecoratorContext,
): void | ((value: undefined, context: ClassFieldDecoratorContext<unknown, T>) => void) {
  if (context !== undefined) {
    recordState(context, {});
    return undefined;
  }
  const options = typeof valueOrOptions === 'function' ? { as: valueOrOptions } : (valueOrOptions ?? {});
  return function (_value: undefined, fieldContext: ClassFieldDecoratorContext<unknown, T>): void {
    recordState(fieldContext, options);
  };
}

export function Action<S, A extends readonly unknown[] = []>(
  options: ActionOptions<S, A>,
): (value: unknown, context: ClassMethodDecoratorContext) => void {
  return function (_value: unknown, context: ClassMethodDecoratorContext): void {
    annotatedMetadataOf(context.metadata).actions.push({
      key: context.name,
      options: action(options),
    });
  };
}

interface Constructable {
  readonly prototype: object;
  readonly name: string;
}

export interface AnnotateSpec<S> {
  model?: ModelOptions<S>;
  state: Record<string, { as?: (value: never) => unknown; bound?: (value: never) => boolean }>;
  actions: Record<string, AnyActionOptions>;
}

function metadataStore(ctor: Constructable): Record<symbol, DecoratorMetadata | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return ctor as unknown as Record<symbol, DecoratorMetadata | undefined>;
}

function assertIsMethod(ctor: Constructable, key: PropertyKey): void {
  if (typeof readProperty(ctor.prototype, key) !== 'function') {
    throw new Error(`${ctor.name}.${String(key)} is not a method - check the key passed to annotate()`);
  }
}

export function annotate<T extends Constructable, S>(ctor: T, spec: AnnotateSpec<S>): T {
  const store = metadataStore(ctor);
  store[metadataKey] ??= {} as DecoratorMetadataObject;
  const metadata = annotatedMetadataOf(store[metadataKey]);
  metadata.model = eraseModel(spec.model ?? {});
  for (const [key, options] of Object.entries(spec.state)) {
    metadata.state.push(stateEntry(key, (instance: object): unknown => readProperty(instance, key), options));
  }
  for (const [key, options] of Object.entries(spec.actions)) {
    assertIsMethod(ctor, key);
    metadata.actions.push({ key, options });
  }
  return ctor;
}

interface PendingCall {
  request: unknown;
  resolve: (response: unknown) => void;
}

export class Environment {
  private readonly pending = new Map<string, PendingCall[]>();

  channel<Res>(name: string): (request: unknown) => Promise<Res> {
    return async (request: unknown): Promise<Res> =>
      await new Promise<Res>((resolve) => {
        const calls = this.pending.get(name) ?? [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        calls.push({ request, resolve: resolve as (response: unknown) => void });
        this.pending.set(name, calls);
      });
  }

  requests(name: string): unknown[] {
    return (this.pending.get(name) ?? []).map((pendingCall): unknown => pendingCall.request);
  }

  deliver(name: string, index: number, response: unknown): boolean {
    const calls = this.pending.get(name) ?? [];
    const pendingCall = calls[index];
    if (pendingCall === undefined) {
      return false;
    }
    calls.splice(index, 1);
    pendingCall.resolve(response);
    return true;
  }
}

interface Step {
  label: string;
  entry: ActionEntry;
  args: readonly unknown[];
}

export interface AnnotatedExploreResult {
  spec: ExploreResult<unknown>;
  conformance: {
    visitedCount: number;
    mismatch?: ConformanceMismatch<unknown>;
  };
}

interface CompleteMetadata {
  model: AnyModelOptions;
  state: StateEntry[];
  actions: ActionEntry[];
}

function metadataOfClass(ctor: Constructable): CompleteMetadata {
  const metadata = metadataStore(ctor)[metadataKey];
  if (metadata === undefined) {
    throw new Error(`${ctor.name} has no metadata - did you forget @Model/@State/@Action, or a call to annotate()?`);
  }
  const { model, state, actions } = annotatedMetadataOf(metadata);
  if (model === undefined) {
    throw new Error(`${ctor.name} has no @Model`);
  }
  if (state.length === 0) {
    throw new Error(`${ctor.name} has no @State fields`);
  }
  if (state.some((entry) => entry.key === 'pending')) {
    throw new Error(`${ctor.name}: "pending" is reserved for async calls in flight and cannot be a @State field`);
  }
  if (actions.length === 0) {
    throw new Error(`${ctor.name} has no @Action methods to explore`);
  }
  return { model, state, actions };
}

function labelOf(name: string, args: readonly unknown[]): string {
  return args.length === 0 ? name : `${name}(${args.map((a): string => JSON.stringify(a)).join(', ')})`;
}

function stepsOf(actions: ActionEntry[]): Step[] {
  return actions.flatMap((entry): Step[] =>
    (entry.options.args ?? [[]]).map((args): Step => ({
      label: labelOf(entry.options.name, args),
      entry,
      args,
    })),
  );
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]): [string, unknown] => [key, sortKeys(inner)]),
    );
  }
  return value;
}

function normalize(value: unknown): unknown {
  return sortKeys(JSON.parse(JSON.stringify(value)));
}

function readRecord(value: unknown): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function call(instance: object, key: PropertyKey, args: readonly unknown[]): unknown {
  const method = readProperty(instance, key);
  if (typeof method !== 'function') {
    throw new Error(`${instance.constructor.name}.${String(key)} is not a method`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return (method as (this: unknown, ...a: readonly unknown[]) => unknown).call(instance, ...args);
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function exploreAnnotated(
  ctor: Constructable,
  create: (env: Environment) => object,
): Promise<AnnotatedExploreResult> {
  const { model, state, actions } = metadataOfClass(ctor);
  const steps = stepsOf(actions);
  const channels = [
    ...new Set(
      actions.flatMap((entry): string[] => (entry.options.delivers === undefined ? [] : [entry.options.delivers])),
    ),
  ];
  const requestMappings = new Map(
    actions.flatMap(({ options }): [string, (request: unknown) => unknown][] =>
      options.delivers === undefined || options.requestAs === undefined
        ? []
        : // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          [[options.delivers, options.requestAs as (request: unknown) => unknown]],
    ),
  );
  const pendingLimits = actions.flatMap(({ options }): [string, number][] =>
    options.delivers === undefined || options.maxPending === undefined ? [] : [[options.delivers, options.maxPending]],
  );

  function inBounds(s: unknown): boolean {
    const record = readRecord(s);
    const pending = readRecord(record['pending']);
    return (
      state.every((entry) => entry.bound?.(record[entry.key]) ?? true) &&
      pendingLimits.every(([name, max]) => {
        const calls = pending[name];
        return Array.isArray(calls) && calls.length <= max;
      })
    );
  }

  function enabled(step: Step, s: unknown): boolean {
    return step.entry.options.guard(s, ...step.args) && inBounds(step.entry.options.effect(s, ...step.args));
  }

  function snapshot(instance: object, env: Environment): unknown {
    const fields = Object.fromEntries(state.map((entry): [string, unknown] => [entry.key, entry.get(instance)]));
    const pending = Object.fromEntries(
      channels.map((name): [string, unknown] => {
        const requestAs = requestMappings.get(name);
        const requests = env.requests(name);
        return [name, requestAs === undefined ? requests : requests.map((request) => requestAs(request))];
      }),
    );
    return normalize({ ...fields, pending });
  }

  async function replay(trace: readonly Step[]): Promise<unknown> {
    const env = new Environment();
    const instance = create(env);
    for (const step of trace) {
      const { delivers } = step.entry.options;
      if (delivers === undefined) {
        call(instance, step.entry.key, step.args);
      } else {
        const [index, response] = step.args;
        if (typeof index !== 'number' || !env.deliver(delivers, index, response)) {
          throw new Error(
            `"${step.label}": no pending "${delivers}" call #${String(index)} ` +
              `(trace: ${trace.map((t): string => t.label).join(' -> ')})`,
          );
        }
      }
      await settle();
    }
    return snapshot(instance, env);
  }

  const seed = await replay([]);

  const spec: Spec<unknown> = {
    init: (): unknown => seed,
    actions: steps.map((step) => ({
      name: step.label,
      guard: (s: unknown): boolean => enabled(step, s),
      effect: (s: unknown): unknown => normalize(step.entry.options.effect(s, ...step.args)),
    })),
    invariants: Object.entries(model.invariants ?? {}).map(([name, check]) => ({
      name,
      check,
    })),
  };
  const specResult = explore(spec);

  const queue: { s: unknown; trace: Step[] }[] = [{ s: seed, trace: [] }];
  const visited = new Set<string>([JSON.stringify(seed)]);

  for (const { s, trace } of queue) {
    for (const step of steps) {
      if (!enabled(step, s)) {
        continue;
      }
      const expected = normalize(step.entry.options.effect(s, ...step.args));
      const nextTrace = [...trace, step];
      const actual = await replay(nextTrace);
      const nextKey = JSON.stringify(expected);
      if (JSON.stringify(actual) !== nextKey) {
        return {
          spec: specResult,
          conformance: {
            visitedCount: visited.size,
            mismatch: {
              trace: nextTrace.map((t): string => t.label),
              action: step.label,
              expected,
              actual,
            },
          },
        };
      }
      if (!visited.has(nextKey)) {
        visited.add(nextKey);
        queue.push({ s: expected, trace: nextTrace });
      }
    }
  }

  return { spec: specResult, conformance: { visitedCount: visited.size } };
}
