import { describe, expect, it } from 'vitest';
import { explore } from '../../src/index.js';
import { buggySpec, fixedSpec } from './model.js';

describe('job lease spec', () => {
  it('finds both late renewals with the shortest traces', () => {
    const result = explore(buggySpec);
    expect(result.visitedCount).toBe(29);
    expect(result.invariants).toEqual([
      {
        name: 'a released lease stays released',
        holds: false,
        counterexample: ['w1 sends renew', 'job is cancelled', 'release lands', 'renew lands'],
      },
      {
        name: 'only the last worker to take the job holds the lease',
        holds: false,
        counterexample: ['w1 sends renew', 'w1 lease expires', 'w2 takes the job', 'renew lands'],
      },
    ]);
  });

  it('holds in every reachable state once renew and release check the token', () => {
    const result = explore(fixedSpec);
    expect(result.visitedCount).toBe(28);
    expect(result.endings).toHaveLength(4);
    expect(result.stuck).toHaveLength(0);
    expect(result.invariants.every((invariant) => invariant.holds)).toBe(true);
  });
});
