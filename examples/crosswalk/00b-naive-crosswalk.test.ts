import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrosswalkController } from './00b-naive-crosswalk.js';

const INTERVAL_MS = 1000;

describe('step 0b: adding a pedestrian button to the shipped light controller', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('looks right: pressed while the light is yellow, right before it turns red', () => {
    vi.useFakeTimers();
    const controller = new CrosswalkController();
    controller.start(INTERVAL_MS);

    vi.advanceTimersByTime(INTERVAL_MS); // green -> yellow, on its own
    controller.pressButton();
    vi.advanceTimersByTime(INTERVAL_MS); // this tick turns the light red and grants the walk

    expect(controller.walkSignal).toBe('walk');
    expect(controller.carLight).toBe('red');
    controller.stop();
  });

  it('bug: pressed while the light is still green, the very next tick grants the walk anyway', () => {
    vi.useFakeTimers();
    const controller = new CrosswalkController();
    controller.start(INTERVAL_MS);

    controller.pressButton(); // pressed immediately, before the light has moved at all
    vi.advanceTimersByTime(INTERVAL_MS); // this tick only gets the light as far as yellow

    expect(controller.walkSignal).toBe('walk');
    expect(controller.carLight).toBe('yellow');
    controller.stop();
  });
});
