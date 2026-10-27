import {
  FIXED_STEP_SECONDS,
  MAX_FIXED_STEPS_PER_FRAME,
} from '../core/BattleConfig';

export interface FixedStepTarget {
  step(deltaSeconds: number): void;
}

export class FixedStepRunner {
  private accumulator = 0;
  private paused = false;

  public constructor(private readonly target: FixedStepTarget) {}

  public advance(frameDeltaSeconds: number): number {
    if (this.paused) {
      return 0;
    }

    this.accumulator += Math.min(Math.max(frameDeltaSeconds, 0), 0.25);
    let steps = 0;
    while (this.accumulator >= FIXED_STEP_SECONDS && steps < MAX_FIXED_STEPS_PER_FRAME) {
      this.target.step(FIXED_STEP_SECONDS);
      this.accumulator -= FIXED_STEP_SECONDS;
      steps += 1;
    }

    if (steps === MAX_FIXED_STEPS_PER_FRAME && this.accumulator >= FIXED_STEP_SECONDS) {
      this.accumulator = 0;
    }
    return this.accumulator / FIXED_STEP_SECONDS;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.accumulator = 0;
  }
}
