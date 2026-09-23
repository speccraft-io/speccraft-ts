import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { handleOrderConfirmed, handleOrderConfirmedFixed } from './webhook.js';
import type { Deps, FixedDeps, OrderStatus } from './webhook.js';

interface Db {
  status: OrderStatus;
  charges: number;
}

function scheduledDeps(s: fc.Scheduler, db: Db): Deps {
  return {
    getStatus: s.scheduleFunction(async (_orderId: string) => await Promise.resolve(db.status)),
    chargeCard: s.scheduleFunction(async (_orderId: string) => {
      db.charges += 1;
      await Promise.resolve();
    }),
    setStatus: s.scheduleFunction(async (_orderId: string, status: OrderStatus) => {
      db.status = status;
      await Promise.resolve();
    }),
  };
}

function scheduledFixedDeps(s: fc.Scheduler, db: Db): FixedDeps {
  return {
    claimOrder: s.scheduleFunction(async (_orderId: string) => {
      const claimed = db.status === 'unpaid';
      if (claimed) {
        db.status = 'charging';
      }
      return await Promise.resolve(claimed);
    }),
    chargeCard: s.scheduleFunction(async (_orderId: string) => {
      db.charges += 1;
      await Promise.resolve();
    }),
    setStatus: s.scheduleFunction(async (_orderId: string, status: OrderStatus) => {
      db.status = status;
      await Promise.resolve();
    }),
  };
}

describe('webhook under fast-check', () => {
  it('a retried delivery handled one after the other charges once', async () => {
    const db: Db = { status: 'unpaid', charges: 0 };
    const deps: Deps = {
      getStatus: async () => await Promise.resolve(db.status),
      chargeCard: async () => {
        db.charges += 1;
        await Promise.resolve();
      },
      setStatus: async (_orderId, status) => {
        db.status = status;
        await Promise.resolve();
      },
    };
    await handleOrderConfirmed('o1', deps);
    await handleOrderConfirmed('o1', deps);
    expect(db.charges).toBe(1);
  });

  it('finds the double charge when two workers race', async () => {
    const property = fc.asyncProperty(fc.scheduler(), async (s) => {
      const db: Db = { status: 'unpaid', charges: 0 };
      const deps = scheduledDeps(s, db);
      const run = Promise.all([handleOrderConfirmed('o1', deps), handleOrderConfirmed('o1', deps)]);
      await s.waitIdle();
      await run;
      expect(db.charges).toBe(1);
    });
    const details = await fc.check(property, { seed: 1 });
    expect(details.failed).toBe(true);
    console.log(fc.defaultReportMessage(details));
  });

  it('holds for every sampled order once the claim is atomic', async () => {
    await fc.assert(
      fc.asyncProperty(fc.scheduler(), async (s) => {
        const db: Db = { status: 'unpaid', charges: 0 };
        const deps = scheduledFixedDeps(s, db);
        const run = Promise.all([handleOrderConfirmedFixed('o1', deps), handleOrderConfirmedFixed('o1', deps)]);
        await s.waitIdle();
        await run;
        expect(db.charges).toBe(1);
      }),
      { seed: 1 },
    );
  });
});
