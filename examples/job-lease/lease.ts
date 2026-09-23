import { Clock, Deferred, Effect, Ref } from 'effect';
import type { Duration } from 'effect';

export interface Lease {
  readonly owner: string;
  readonly token: number;
  readonly expiresAt: number;
}

export interface LeaseTable {
  readonly lease: Lease | null;
  readonly nextToken: number;
}

export const emptyTable: LeaseTable = { lease: null, nextToken: 1 };

const ttl = 30_000;

function live(table: LeaseTable, now: number): Lease | null {
  return table.lease !== null && table.lease.expiresAt > now ? table.lease : null;
}

function acquire(table: LeaseTable, owner: string, now: number): readonly [number | null, LeaseTable] {
  if (live(table, now) !== null) {
    return [null, table];
  }
  const token = table.nextToken;
  return [token, { lease: { owner, token, expiresAt: now + ttl }, nextToken: token + 1 }];
}

export interface LeaseRules {
  readonly renew: (table: LeaseTable, owner: string, token: number, now: number) => readonly [boolean, LeaseTable];
  readonly release: (table: LeaseTable, token: number) => LeaseTable;
}

export const setAndDelete: LeaseRules = {
  renew: (table, owner, token, now) => [true, { ...table, lease: { owner, token, expiresAt: now + ttl } }],
  release: (table) => ({ ...table, lease: null }),
};

export const tokenChecked: LeaseRules = {
  renew: (table, _owner, token, now) => {
    const lease = live(table, now);
    return lease?.token === token ? [true, { ...table, lease: { ...lease, expiresAt: now + ttl } }] : [false, table];
  },
  release: (table, token) => (table.lease?.token === token ? { ...table, lease: null } : table),
};

export type Call = 'acquire' | 'renew' | 'release';

export class LeaseTaken {
  readonly _tag = 'LeaseTaken';
}

export class LeaseLost {
  readonly _tag = 'LeaseLost';
}

export interface LeaseClient {
  readonly acquire: (owner: string) => Effect.Effect<number, LeaseTaken>;
  readonly renew: (owner: string, token: number) => Effect.Effect<boolean>;
  readonly release: (token: number) => Effect.Effect<void>;
}

export function leaseClient(
  table: Ref.Ref<LeaseTable>,
  rules: LeaseRules,
  latency: (call: Call) => Duration.Input,
): LeaseClient {
  const send = <A>(call: Call, handle: (t: LeaseTable, now: number) => readonly [A, LeaseTable]): Effect.Effect<A> =>
    Effect.gen(function* () {
      const reply = yield* Deferred.make<A>();
      const delivery = Effect.gen(function* () {
        yield* Effect.sleep(latency(call));
        const now = yield* Clock.currentTimeMillis;
        const answer = yield* Ref.modify(table, (t) => handle(t, now));
        yield* Deferred.succeed(reply, answer);
      });
      yield* Effect.forkDetach(delivery);
      return yield* Deferred.await(reply);
    });

  return {
    acquire: (owner) =>
      send('acquire', (t, now) => acquire(t, owner, now)).pipe(
        Effect.flatMap((token) => (token === null ? Effect.fail(new LeaseTaken()) : Effect.succeed(token))),
      ),
    renew: (owner, token) => send('renew', (t, now) => rules.renew(t, owner, token, now)),
    release: (token) => send('release', (t) => [undefined, rules.release(t, token)]),
  };
}

export function runJob(
  client: LeaseClient,
  owner: string,
  work: Effect.Effect<void>,
): Effect.Effect<void, LeaseTaken | LeaseLost> {
  return Effect.scoped(
    Effect.gen(function* () {
      const token = yield* Effect.acquireRelease(client.acquire(owner), (t) => client.release(t));
      const renewal = client.renew(owner, token).pipe(
        Effect.delay('10 seconds'),
        Effect.flatMap((held) => (held ? Effect.void : Effect.fail(new LeaseLost()))),
        Effect.forever,
      );
      yield* Effect.raceFirst(work, renewal);
    }),
  );
}
