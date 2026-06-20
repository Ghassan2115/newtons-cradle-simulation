import type { CradleConfig } from '../Types';
import type { Integrator } from './Integrator';

export class RK4Integrator implements Integrator {
  public name = 'RK4';

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

      // k1
      const dTheta1 = w0;
      const dOmega1 = getAlpha(t0, w0, i);

      // k2
      const t1 = t0 + 0.5 * dt * dTheta1;
      const w1 = w0 + 0.5 * dt * dOmega1;
      const dTheta2 = w1;
      const dOmega2 = getAlpha(t1, w1, i);

      // k3
      const t2 = t0 + 0.5 * dt * dTheta2;
      const w2 = w0 + 0.5 * dt * dOmega2;
      const dTheta3 = w2;
      const dOmega3 = getAlpha(t2, w2, i);

      // k4
      const t3 = t0 + dt * dTheta3;
      const w3 = w0 + dt * dOmega3;
      const dTheta4 = w3;
      const dOmega4 = getAlpha(t3, w3, i);

      // تجميع الخطوة الإجمالية
      nextTheta[i] = t0 + (dt / 6) * (dTheta1 + 2 * dTheta2 + 2 * dTheta3 + dTheta4);
      nextOmega[i] = w0 + (dt / 6) * (dOmega1 + 2 * dOmega2 + 2 * dOmega3 + dOmega4);
      nextAlpha[i] = getAlpha(nextTheta[i], nextOmega[i], i);
    }

    return { theta: nextTheta, omega: nextOmega, alpha: nextAlpha };
  }
}
