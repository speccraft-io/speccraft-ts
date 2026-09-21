export class CarLightController {
  carLight: 'green' | 'yellow' | 'red' = 'green';
  private timer?: ReturnType<typeof setInterval>;

  start(intervalMs: number): void {
    this.timer = setInterval(() => {
      this.advanceLight();
    }, intervalMs);
  }

  stop(): void {
    clearInterval(this.timer);
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
        this.carLight = 'green';
        break;
    }
  }
}
