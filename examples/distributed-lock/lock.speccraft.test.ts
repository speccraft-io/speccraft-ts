import { describe, expect, it } from 'vitest';
import { checkConformance, explore } from '../../src/index.js';
import { fencedStorage, plainStorage, realLock } from './conformance.js';
import { lockSpec } from './lock.speccraft.js';

describe('distributed lock under SpecCraft', () => {
  it('finds the stale write when the store accepts any write', () => {
    const result = explore(lockSpec(3, 'accepts any write'));
    console.log(JSON.stringify({ visitedCount: result.visitedCount, invariants: result.invariants }, null, 2));
    expect(result.visitedCount).toBe(566);
    expect(result.invariants).toEqual([
      {
        name: 'the store never takes a write older than one it already took',
        holds: false,
        counterexample: ['n0 acquires lock', 'lease of n0 expires', 'n1 acquires lock', 'n1 writes', 'n0 writes'],
      },
    ]);
  });

  it('holds in every reachable state once the store checks fencing tokens', () => {
    const rows = [2, 3, 4].map((n) => {
      const result = explore(lockSpec(n, 'fencing'));
      expect(result.invariants.every((invariant) => invariant.holds)).toBe(true);
      return { nodes: n, visitedCount: result.visitedCount, endings: result.endings.length };
    });
    console.table(rows);
    expect(rows).toEqual([
      { nodes: 2, visitedCount: 37, endings: 0 },
      { nodes: 3, visitedCount: 283, endings: 0 },
      { nodes: 4, visitedCount: 2521, endings: 0 },
    ]);
  });

  it('the real client with a fenced store matches the spec in every reachable state', () => {
    const result = checkConformance(lockSpec(3, 'fencing'), realLock(3, fencedStorage));
    console.log(JSON.stringify(result, null, 2));
    expect(result).toEqual({ visitedCount: 283 });
  });

  it('the real client with a plain store breaks the spec at the stale write', () => {
    const result = checkConformance(lockSpec(3, 'fencing'), realLock(3, plainStorage));
    console.log(JSON.stringify(result, null, 2));
    expect(result.mismatch?.trace).toEqual([
      'n0 acquires lock',
      'lease of n0 expires',
      'n1 acquires lock',
      'n1 writes',
      'n0 writes',
    ]);
    expect(result.mismatch?.expected.nodes[0]?.phase).toBe('idle');
    expect(result.mismatch?.actual.nodes[0]?.phase).toBe('wrote');
    expect(result.mismatch?.actual.stale).toBe(true);
  });
});
