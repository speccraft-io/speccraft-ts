import { describe, expect, it } from 'vitest';
import { explore } from '../../src/index.js';
import { markThenPublish, publishThenMark, publishThenMarkWithKey } from './outbox.js';
import { outboxSpec } from './speccraft-model.js';

const faults = { crashes: 2, retries: 2 };

describe('outbox spec', () => {
  it('finds the lost event when the relay marks before publishing', () => {
    const lost = explore(outboxSpec(markThenPublish, faults));
    expect(lost.visitedCount).toBe(27);
    expect(lost.invariants[0]).toEqual({ name: 'the order is applied at most once', holds: true });
    expect(lost.invariants[1]).toEqual({
      name: 'a row marked sent was published or is still held by the relay',
      holds: false,
      counterexample: ['order service commits order and outbox row', 'relay reads row', 'relay marks row sent', 'relay crashes'],
    });
    expect(lost.stuck).toEqual([
      { outbox: 'sent', relay: 'idle', applied: 0, crashes: 1, retries: 0 },
      { outbox: 'sent', relay: 'idle', applied: 0, crashes: 2, retries: 0 },
    ]);
  });

  it('finds the duplicate when the consumer has no idempotency key', () => {
    const duplicate = explore(outboxSpec(publishThenMark, faults));
    expect(duplicate.visitedCount).toBe(71);
    expect(duplicate.invariants[0]?.counterexample).toEqual([
      'order service commits order and outbox row',
      'relay reads row',
      'broker times out after delivery',
      'relay publishes',
    ]);
    expect(duplicate.invariants[1]).toEqual({
      name: 'a row marked sent was published or is still held by the relay',
      holds: true,
    });
  });

  it('finds the duplicate after a crash when retries are not allowed', () => {
    const result = explore(outboxSpec(publishThenMark, { crashes: 2, retries: 0 }));
    expect(result.invariants[0]?.counterexample).toEqual([
      'order service commits order and outbox row',
      'relay reads row',
      'relay publishes',
      'relay crashes',
      'relay reads row',
      'relay publishes',
    ]);
  });

  it('holds in every reachable state of the fixed relay within the fault bounds', () => {
    const fixed = explore(outboxSpec(publishThenMarkWithKey, faults));
    expect(fixed.visitedCount).toBe(39);
    expect(fixed.invariants.every((invariant) => invariant.holds)).toBe(true);
    expect(fixed.stuck).toEqual([]);
  });
});
