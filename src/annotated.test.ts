import { describe, expect, it } from 'vitest';
import { action, annotate, exploreAnnotated } from './annotated.js';
import type { Environment } from './annotated.js';

interface CounterState {
  count: number;
  pending: Record<string, never>;
}

function counterClass(step: number): new () => { inc: () => void } {
  class Counter {
    count = 0;

    inc(): void {
      this.count += step;
    }
  }
  annotate(Counter, {
    model: {
      invariants: {
        'count stays at most 3': (s: CounterState) => s.count <= 3,
      },
    },
    state: { count: {} },
    actions: {
      inc: action<CounterState>({
        name: 'inc',
        guard: (s) => s.count < 3,
        effect: (s) => ({ ...s, count: s.count + 1 }),
      }),
    },
  });
  return Counter;
}

describe('exploreAnnotated (annotate(), no decorators)', () => {
  it('explores the spec over the real fields and finds the real code conforms', async () => {
    const Counter = counterClass(1);
    const result = await exploreAnnotated(Counter, () => new Counter());
    expect(result.spec.visitedCount).toBe(4);
    expect(result.spec.invariants).toEqual([{ name: 'count stays at most 3', holds: true }]);
    expect(result.conformance).toEqual({ visitedCount: 4 });
  });

  it('reports the trace where the real code first disagrees with the spec', async () => {
    const Counter = counterClass(2);
    const result = await exploreAnnotated(Counter, () => new Counter());
    expect(result.conformance.mismatch).toEqual({
      trace: ['inc'],
      action: 'inc',
      expected: { count: 1, pending: {} },
      actual: { count: 2, pending: {} },
    });
  });

  it('delivers async replies in any order through the environment', async () => {
    interface EchoState {
      last: number | null;
      pending: { echo: number[] };
    }
    class Echo {
      last: number | null = null;
      private readonly send: (n: number) => Promise<number>;

      constructor(send: (n: number) => Promise<number>) {
        this.send = send;
      }

      request(n: number): void {
        this.send(n).then(
          (reply) => {
            this.receive(reply);
          },
          (error: unknown) => {
            console.error(error);
          },
        );
      }

      receive(reply: number): void {
        this.last = reply;
      }
    }
    annotate(Echo, {
      state: { last: {} },
      actions: {
        request: action<EchoState, [number]>({
          name: 'request',
          args: [[1], [2]],
          guard: (s, n) => !s.pending.echo.includes(n) && s.last === null,
          effect: (s, n) => ({
            ...s,
            pending: { echo: [...s.pending.echo, n] },
          }),
        }),
        receive: action<EchoState, [number, number]>({
          name: 'reply',
          delivers: 'echo',
          args: [
            [0, 1],
            [0, 2],
            [1, 1],
            [1, 2],
          ],
          guard: (s, index, value) => s.pending.echo[index] === value,
          effect: (s, index, value) => ({
            last: value,
            pending: { echo: s.pending.echo.filter((_, i) => i !== index) },
          }),
        }),
      },
    });
    const result = await exploreAnnotated(Echo, (env: Environment) => new Echo(env.channel<number>('echo')));
    expect(result.conformance.mismatch).toBeUndefined();
    expect(result.conformance.visitedCount).toBeGreaterThan(4);
  });

  it('rejects a method name that does not exist on the class', () => {
    class NoActions {
      readonly value = 0;
    }
    expect(() =>
      annotate(NoActions, {
        state: { value: {} },
        actions: {
          doit: action<null>({
            name: 'doit',
            guard: () => true,
            effect: () => null,
          }),
        },
      }),
    ).toThrow(/is not a method/);
  });
});
