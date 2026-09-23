export type Order = 'mark-then-publish' | 'publish-then-mark';

export interface Variant {
  readonly order: Order;
  readonly idempotencyKey: boolean;
}

export interface State {
  readonly outbox: 'none' | 'pending' | 'sent';
  readonly relay: 'idle' | 'read' | 'published' | 'marked';
  readonly applied: number;
}

export const markThenPublish: Variant = { order: 'mark-then-publish', idempotencyKey: true };
export const publishThenMark: Variant = { order: 'publish-then-mark', idempotencyKey: false };
export const publishThenMarkWithKey: Variant = { order: 'publish-then-mark', idempotencyKey: true };

export const initial: State = { outbox: 'none', relay: 'idle', applied: 0 };

export function consume(v: Variant, applied: number): number {
  return v.idempotencyKey && applied > 0 ? applied : applied + 1;
}

export function publishing(v: Variant, s: State): boolean {
  return v.order === 'publish-then-mark' ? s.relay === 'read' : s.relay === 'marked';
}

export function marking(v: Variant, s: State): boolean {
  return v.order === 'publish-then-mark' ? s.relay === 'published' : s.relay === 'read';
}
