import { describe, expect, it } from '@effect/vitest';
import { Effect, Fiber, Ref } from 'effect';
import type { Duration } from 'effect';
import { TestClock } from 'effect/testing';
import { emptyTable, leaseClient, runJob, setAndDelete, tokenChecked } from './lease.js';
import type { Call, Lease, LeaseRules } from './lease.js';

function leaseAfterCancel(
  rules: LeaseRules,
  latency: (call: Call) => Duration.Input,
  cancelAt: Duration.Input,
): Effect.Effect<Lease | null> {
  return Effect.gen(function* () {
    const table = yield* Ref.make(emptyTable);
    const client = leaseClient(table, rules, latency);
    const worker = yield* Effect.forkChild(runJob(client, 'w1', Effect.sleep('5 minutes')));
    yield* TestClock.adjust(cancelAt);
    yield* Effect.forkChild(Fiber.interrupt(worker));
    yield* TestClock.adjust('5 seconds');
    return (yield* Ref.get(table)).lease;
  });
}

const sameLatency = (): Duration.Input => '100 millis';
const slowRenewal = (call: Call): Duration.Input => (call === 'renew' ? '2 seconds' : '100 millis');

describe('job lease under Effect', () => {
  it.effect('cancelling the job releases its lease', () =>
    Effect.gen(function* () {
      expect(yield* leaseAfterCancel(setAndDelete, sameLatency, '25 seconds')).toBeNull();
    }),
  );

  it.effect('cancelling while a renewal is in flight releases the lease', () =>
    Effect.gen(function* () {
      expect(yield* leaseAfterCancel(setAndDelete, sameLatency, '20250 millis')).toBeNull();
    }),
  );

  it.effect('a renewal slower than the release revives the lease', () =>
    Effect.gen(function* () {
      expect(yield* leaseAfterCancel(setAndDelete, slowRenewal, '23 seconds')).toEqual({
        owner: 'w1',
        token: 1,
        expiresAt: 54_100,
      });
    }),
  );

  it.effect('with token checks the slow renewal is rejected', () =>
    Effect.gen(function* () {
      expect(yield* leaseAfterCancel(tokenChecked, slowRenewal, '23 seconds')).toBeNull();
    }),
  );
});
