import type { RealSystem } from '../../src/index.js';
import { Clock, FencedStorage, LeaseLock, PlainStorage, Worker } from './client.js';
import type { Storage } from './client.js';
import { renumber } from './lock.js';
import type { Phase, State } from './lock.js';

interface World {
  readonly lock: LeaseLock;
  readonly storage: Storage;
  readonly workers: readonly Worker[];
  readonly clock: Clock;
}

function newWorld(n: number, storage: Storage): World {
  const clock = new Clock();
  const lock = new LeaseLock(clock, 10_000);
  const workers = Array.from({ length: n }, (_, i) => new Worker(`n${i}`, lock, storage));
  return { lock, storage, workers, clock };
}

function perform(world: World, actionName: string): void {
  world.workers.forEach((worker, i) => {
    switch (actionName) {
      case `n${i} acquires lock`:
        worker.acquire();
        break;
      case `n${i} writes`:
        worker.write(`from n${i}`);
        break;
      case `n${i} releases lock`:
        worker.release();
        break;
      case `lease of n${i} expires`:
        world.clock.advance(world.lock.msLeft());
        break;
      default:
        break;
    }
  });
}

function phaseOf(worker: Worker): Phase {
  if (worker.token === null) {
    return 'idle';
  }
  return worker.wrote ? 'wrote' : 'holding';
}

function project(world: World): State {
  const log = world.storage.log;
  return renumber({
    nodes: world.workers.map((worker) => ({
      phase: phaseOf(worker),
      lease: world.lock.leaseHolder() === worker.name,
      token: worker.token,
    })),
    epoch: world.lock.lastToken(),
    newest: Math.max(0, ...log),
    stale: log.some((token, k) => token < Math.max(0, ...log.slice(0, k))),
  });
}

export function realLock(n: number, storage: () => Storage): RealSystem<State, readonly string[]> {
  const replay = (actions: readonly string[]): World => {
    const world = newWorld(n, storage());
    for (const actionName of actions) {
      perform(world, actionName);
    }
    return world;
  };
  return {
    init: () => [],
    apply: (actions, actionName) => [...actions, actionName],
    project: (actions) => project(replay(actions)),
  };
}

export const plainStorage = (): Storage => new PlainStorage();
export const fencedStorage = (): Storage => new FencedStorage();
