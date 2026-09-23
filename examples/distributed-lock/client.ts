export class Clock {
  now = 0;

  advance(ms: number): void {
    this.now += ms;
  }
}

export class LeaseLock {
  private readonly clock: Clock;
  private readonly ttlMs: number;
  private holder: string | null = null;
  private expiresAt = 0;
  private counter = 0;

  constructor(clock: Clock, ttlMs: number) {
    this.clock = clock;
    this.ttlMs = ttlMs;
  }

  tryAcquire(owner: string): number | null {
    if (this.holder !== null && this.clock.now < this.expiresAt) {
      return null;
    }
    this.holder = owner;
    this.expiresAt = this.clock.now + this.ttlMs;
    this.counter += 1;
    return this.counter;
  }

  release(owner: string, token: number): void {
    if (this.holder === owner && this.counter === token) {
      this.holder = null;
    }
  }

  leaseHolder(): string | null {
    return this.holder !== null && this.clock.now < this.expiresAt ? this.holder : null;
  }

  lastToken(): number {
    return this.counter;
  }

  msLeft(): number {
    return this.expiresAt - this.clock.now;
  }
}

export interface Storage {
  write: (token: number, value: string) => boolean;
  readonly log: readonly number[];
}

export class PlainStorage implements Storage {
  readonly log: number[] = [];

  write(token: number, _value: string): boolean {
    this.log.push(token);
    return true;
  }
}

export class FencedStorage implements Storage {
  readonly log: number[] = [];
  private highest = 0;

  write(token: number, _value: string): boolean {
    if (token < this.highest) {
      return false;
    }
    this.highest = token;
    this.log.push(token);
    return true;
  }
}

export class Worker {
  readonly name: string;
  private readonly lock: LeaseLock;
  private readonly storage: Storage;
  token: number | null = null;
  wrote = false;

  constructor(name: string, lock: LeaseLock, storage: Storage) {
    this.name = name;
    this.lock = lock;
    this.storage = storage;
  }

  acquire(): boolean {
    this.token = this.lock.tryAcquire(this.name);
    return this.token !== null;
  }

  write(value: string): void {
    if (this.token === null) {
      return;
    }
    if (this.storage.write(this.token, value)) {
      this.wrote = true;
    } else {
      this.token = null;
    }
  }

  release(): void {
    if (this.token !== null) {
      this.lock.release(this.name, this.token);
    }
    this.token = null;
    this.wrote = false;
  }
}
