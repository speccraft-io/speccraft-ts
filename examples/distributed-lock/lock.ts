export type Phase = 'idle' | 'holding' | 'wrote';

export interface Node {
  readonly phase: Phase;
  readonly lease: boolean;
  readonly token: number | null;
}

export interface State {
  readonly nodes: readonly Node[];
  readonly epoch: number;
  readonly newest: number;
  readonly stale: boolean;
}

export type Store = 'accepts any write' | 'fencing';

export function init(n: number): State {
  return {
    nodes: Array.from({ length: n }, (): Node => ({ phase: 'idle', lease: false, token: null })),
    epoch: 0,
    newest: 0,
    stale: false,
  };
}

export function renumber(s: State): State {
  const used = [s.epoch, s.newest, ...s.nodes.flatMap((node) => (node.token === null ? [] : [node.token]))];
  const ranks = [...new Set(used)].sort((a, b) => a - b);
  const rank = (value: number): number => ranks.indexOf(value);
  return {
    ...s,
    epoch: rank(s.epoch),
    newest: rank(s.newest),
    nodes: s.nodes.map((node) => (node.token === null ? node : { ...node, token: rank(node.token) })),
  };
}

function withNode(s: State, i: number, node: Node): State {
  return renumber({ ...s, nodes: s.nodes.map((other, j) => (j === i ? node : other)) });
}

export function acquire(s: State, i: number): State | null {
  const node = s.nodes[i];
  if (node?.phase !== 'idle' || s.nodes.some((other) => other.lease)) {
    return null;
  }
  return withNode({ ...s, epoch: s.epoch + 1 }, i, { phase: 'holding', lease: true, token: s.epoch + 1 });
}

export function expire(s: State, i: number): State | null {
  const node = s.nodes[i];
  if (node?.lease !== true) {
    return null;
  }
  return withNode(s, i, { ...node, lease: false });
}

export function write(s: State, i: number, store: Store): State | null {
  const node = s.nodes[i];
  if (node?.phase !== 'holding' || node.token === null) {
    return null;
  }
  if (store === 'fencing' && node.token < s.newest) {
    return withNode(s, i, { phase: 'idle', lease: false, token: null });
  }
  const accepted = {
    ...s,
    newest: Math.max(s.newest, node.token),
    stale: s.stale || node.token < s.newest,
  };
  return withNode(accepted, i, { ...node, phase: 'wrote' });
}

export function release(s: State, i: number): State | null {
  const node = s.nodes[i];
  if (node?.phase !== 'wrote') {
    return null;
  }
  return withNode(s, i, { phase: 'idle', lease: false, token: null });
}
