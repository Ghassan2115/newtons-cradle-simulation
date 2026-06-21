import type { CradleConfig } from '../Types';
import type { Integrator } from './Integrator';

export class VelocityVerletIntegrator implements Integrator {
  public name = 'Velocity Verlet';

  public step(
    theta: number[],
    omega: number[],
    _config: CradleConfig,
    dt: number,
    getAlpha: (theta: number, omega: number, index: number) => number
  ): { theta: number[]; omega: number[]; alpha: number[] } {
    const n = theta.length;
    const nextTheta = new Array<number>(n);
    const nextOmega = new Array<number>(n);
    const nextAlpha = new Array<number>(n);

    for (let i = 0; i < n; i++) {
      const t0 = theta[i];
      const w0 = omega[i];
      const a0 = getAlpha(t0, w0, i);

      const t1 = t0 + w0 * dt + 0.5 * a0 * dt * dt;
      nextTheta[i] = t1;

      const wPred = w0 + a0 * dt;

      const a1 = getAlpha(t1, wPred, i);
      nextAlpha[i] = a1;

      nextOmega[i] = w0 + 0.5 * (a0 + a1) * dt;
    }

    return { theta: nextTheta, omega: nextOmega, alpha: nextAlpha };
  }
}
