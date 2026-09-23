import { exploreIteratively } from 'stifinder';
import { describe, expect, it } from 'vitest';
import { markThenPublish, publishThenMark, publishThenMarkWithKey } from './outbox.js';
import { outboxModel } from './stifinder-model.js';

const faults = { crash: 2, retry: 2 };

describe('outbox under stifinder', () => {
  it('finds the lost event with one crash when the relay marks before publishing', async () => {
    const space = await exploreIteratively(outboxModel(markThenPublish), { baseBudget: faults });
    expect(space.violation?.error).toEqual(new Error('the committed order was never published'));
    expect(space.violation?.steps.map((s) => [s.event, s.index])).toEqual([
      ['order service commits order and outbox row', 0],
      ['relay reads row', 0],
      ['relay marks row sent', 0],
      ['relay crashes', 2],
    ]);
    expect(Object.fromEntries(space.violation?.cost ?? [])).toEqual({ crash: 1, __deviations__: 1 });
    expect(space.violation?.badState).toEqual({ outbox: 'sent', relay: 'idle', applied: 0 });
    expect(space.maxDeviationsReached).toBe(1);
    expect(space.exhaustive).toBe(false);
  });

  it('finds the duplicate with one retry when the consumer has no idempotency key', async () => {
    const duplicate = await exploreIteratively(outboxModel(publishThenMark), { baseBudget: faults });
    expect(duplicate.violation?.error).toEqual(new Error('the order was applied twice'));
    expect(duplicate.violation?.steps.map((s) => [s.event, s.index])).toEqual([
      ['order service commits order and outbox row', 0],
      ['relay reads row', 0],
      ['broker times out after delivery', 1],
      ['relay publishes', 0],
    ]);
    expect(Object.fromEntries(duplicate.violation?.cost ?? [])).toEqual({ retry: 1, __deviations__: 1 });
    expect(duplicate.maxDeviationsReached).toBe(1);
  });

  it('finds the duplicate with one crash when retries are not allowed', async () => {
    const space = await exploreIteratively(outboxModel(publishThenMark), { baseBudget: { crash: 2 } });
    expect(space.violation?.steps.map((s) => s.event)).toEqual([
      'order service commits order and outbox row',
      'relay reads row',
      'relay publishes',
      'relay crashes',
      'relay reads row',
      'relay publishes',
    ]);
    expect(Object.fromEntries(space.violation?.cost ?? [])).toEqual({ crash: 1, __deviations__: 1 });
  });

  it('clears the fault-free budget without calling it a proof', async () => {
    const space = await exploreIteratively(outboxModel(publishThenMark), {});
    expect(space.violation).toBeNull();
    expect(space.completed).toBe(true);
    expect(space.exhaustive).toBe(false);
  });

  it('does not call one crash and one retry exhaustive for the fixed relay', async () => {
    const space = await exploreIteratively(outboxModel(publishThenMarkWithKey), { baseBudget: { crash: 1, retry: 1 } });
    expect(space.violation).toBeNull();
    expect(space.exhaustive).toBe(false);
  });

  it('proves the fixed relay for every reachable state', async () => {
    const fixed = await exploreIteratively(outboxModel(publishThenMarkWithKey), { baseBudget: faults });
    expect(fixed.violation).toBeNull();
    expect(fixed.exhaustive).toBe(true);
    expect(fixed.costs.size).toBe(7);
    expect(fixed.edgesComputed).toBe(11);
  });
});
