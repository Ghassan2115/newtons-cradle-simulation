import type { CradleConfig } from '../Types';

export interface Integrator {
  name: string;
  step(
    theta: number[],
    omega: number[],
    config: CradleConfig,
    dt: number,
    getAlpha: (theta: number, omega: number, index: number) => number
  ): { theta: number[]; omega: number[]; alpha: number[] };
}
