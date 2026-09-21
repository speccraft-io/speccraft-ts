export class CrosswalkController {
  carLight: 'green' | 'yellow' | 'red' = 'green';
  walkSignal: 'walk' | 'dontwalk' = 'dontwalk';
  private requested = false;
  private timer?: ReturnType<typeof setInterval>;

  // the light cycles and grants walks entirely on its own clock; a pedestrian
  // presses the button whenever they happen to, with no coordination between the two
  start(intervalMs: number): void {
    this.timer = setInterval(() => {
      this.advanceLight();
      this.grantWalkIfRequested();
    }, intervalMs);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  pressButton(): void {
    this.requested = true;
  }

  endWalk(): void {
    this.walkSignal = 'dontwalk';
  }

  private advanceLight(): void {
    switch (this.carLight) {
      case 'green':
        this.carLight = 'yellow';
        break;
      case 'yellow':
        this.carLight = 'red';
        break;
      case 'red':
        if (this.walkSignal === 'dontwalk') {
          this.carLight = 'green';
        }
        break;
    }
  }

  // bug: grants the walk the moment it's requested and none is already showing -
  // nothing here checks that advanceLight() actually got the light to red first.
  private grantWalkIfRequested(): void {
    if (this.requested && this.walkSignal === 'dontwalk') {
      this.walkSignal = 'walk';
      this.requested = false;
    }
  }
}
