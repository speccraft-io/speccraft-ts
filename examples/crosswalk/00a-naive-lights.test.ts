import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarLightController } from './00a-naive-lights.js';

const INTERVAL_MS = 1000;

describe('step 0a: a plain car-light controller, already in production', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cycles green -> yellow -> red -> green on its own', () => {
    vi.useFakeTimers();
    const controller = new CarLightController();
    controller.start(INTERVAL_MS);

    expect(controller.carLight).toBe('green');
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(controller.carLight).toBe('yellow');
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(controller.carLight).toBe('red');
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(controller.carLight).toBe('green');

    controller.stop();
  });
});
