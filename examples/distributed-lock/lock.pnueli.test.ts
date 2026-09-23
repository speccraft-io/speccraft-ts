import { checkExhaustive, checkLiveness, checkReduced } from '@botiroff/pnueli';
import type { Result, Step } from '@botiroff/pnueli';
import { describe, expect, it } from 'vitest';
import type { State } from './lock.js';
import { lockSpec, n0Writes, someNodeWrites } from './lock.pnueli.js';

function show(s: State): string {
  const nodes = s.nodes.map(
    (node, i) => `n${i} ${node.phase}${node.token === null ? '' : ` t${node.token}`}${node.lease ? ' lease' : ''}`,
  );
  return `${nodes.join(', ')} | store t${s.newest}${s.stale ? ' STALE' : ''}`;
}

function lines(steps: readonly Step<State>[]): string[] {
  return steps.map((step) => `${(step.action ?? '(initial)').padEnd(22)} ${show(step.state)}`);
}

function report(result: Result<State>): string {
  const head = `${result.spec} [${result.mode}]: ${result.ok ? 'ok' : 'FAILED'}, ${result.states} states`;
  const violation = result.violation;
  if (violation === null) {
    return head;
  }
  const cycle = violation.cycle === undefined ? [] : ['  then forever', ...lines(violation.cycle).map((l) => `    ${l}`)];
  return [head, `  ${violation.detail}`, ...lines(violation.trace).map((l) => `    ${l}`), ...cycle].join('\n');
}

function actions(steps: readonly Step<State>[]): (string | null)[] {
  return steps.map((step) => step.action);
}

describe('distributed lock under pnueli', () => {
  it('finds the stale write when the store accepts any write', () => {
    const plain = checkExhaustive(lockSpec(3, 'accepts any write', false));
    const symmetric = checkExhaustive(lockSpec(3, 'accepts any write', true));
    console.log(report(plain));
    console.log(report(symmetric));
    expect(plain.ok).toBe(false);
    expect(plain.states).toBe(75);
    expect(symmetric.states).toBe(18);
    expect(actions(plain.violation?.trace ?? [])).toEqual([
      null,
      'n0 acquires lock',
      'lease of n0 expires',
      'n1 acquires lock',
      'n1 writes',
      'n0 writes',
    ]);
  });

  it('proves the fenced store never takes a stale write, with and without reductions', () => {
    const rows = [2, 3, 4].map((n) => {
      const full = checkExhaustive(lockSpec(n, 'fencing', false));
      const symmetric = checkExhaustive(lockSpec(n, 'fencing', true));
      const reduced = checkReduced(lockSpec(n, 'fencing', true));
      expect([full.ok, symmetric.ok, reduced.ok]).toEqual([true, true, true]);
      return { nodes: n, none: full.states, symmetry: symmetric.states, symmetryAndPor: reduced.states };
    });
    console.table(rows);
    expect(rows).toEqual([
      { nodes: 2, none: 37, symmetry: 19, symmetryAndPor: 19 },
      { nodes: 3, none: 283, symmetry: 51, symmetryAndPor: 51 },
      { nodes: 4, none: 2521, symmetry: 119, symmetryAndPor: 119 },
    ]);
  });

  it('shows some node keeps getting writes in under weak fairness', () => {
    const result = checkLiveness(lockSpec(3, 'fencing', true), someNodeWrites);
    console.log(report(result));
    expect(result.ok).toBe(true);
    expect(result.states).toBe(51);
  });

  it('finds that n0 can be fenced out forever', () => {
    const result = checkLiveness(lockSpec(2, 'fencing', false), n0Writes);
    console.log(report(result));
    expect(result.ok).toBe(false);
    expect(result.violation?.kind).toBe('liveness');
    expect(actions(result.violation?.cycle ?? [])).toContain('n0 writes');
  });
});
