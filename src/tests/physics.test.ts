import { describe, it, expect } from 'vitest';
import type { CradleConfig } from '../physics/Types';
import { CradleEngine } from '../physics/Engine';
import { RK4Integrator } from '../physics/integrators/RK4';
import { VelocityVerletIntegrator } from '../physics/integrators/VelocityVerlet';

function createDefaultConfig(ballCount = 5): CradleConfig {
  const radii = new Array<number>(ballCount).fill(0.02);
  const lengths = new Array<number>(ballCount).fill(0.3);
  const masses = new Array<number>(ballCount).fill(0.05);
  const pivots = [];

  let currentX = -(ballCount - 1) * 0.02;
  for (let i = 0; i < ballCount; i++) {
    pivots.push({ x: currentX, y: 0.3, z: 0 });
    currentX += 0.04;
  }

  return {
    ballCount,
    g: 9.81,
    restitution: 1.0,
    damping: 0.0,
    masses,
    radii,
    lengths,
    pivots,
  };
}

describe("Newton's Cradle Physics Engine Tests", () => {
  it('يجب أن يتحرك بندول مفرد حركة اهتزازية صحيحة مع المكاملين', () => {
    const config = createDefaultConfig(1);
    const initialTheta = [0.2];

    const rk4Engine = new CradleEngine(initialTheta, config, new RK4Integrator());
    const verletEngine = new CradleEngine(initialTheta, config, new VelocityVerletIntegrator());

    const dt = 0.001;
    for (let i = 0; i < 100; i++) {
      rk4Engine.step(dt);
      verletEngine.step(dt);
    }

    const rk4State = rk4Engine.getState();
    const verletState = verletEngine.getState();

    expect(rk4State.theta[0]).toBeLessThan(0.2);
    expect(verletState.theta[0]).toBeLessThan(0.2);

    expect(rk4State.relativeEnergyError).toBeLessThan(1e-4);
    expect(verletState.relativeEnergyError).toBeLessThan(1e-4);
  });

  it('يجب أن يحفظ الطاقة والزخم عند التصادم المرن لكرات متطابقة', () => {
    const config = createDefaultConfig(5);

    const initialTheta = [-0.3, 0, 0, 0, 0];
    const engine = new CradleEngine(initialTheta, config, new RK4Integrator());

    const dt = 0.001;
    let maxAngleLastBall = 0;

    for (let i = 0; i < 500; i++) {
      engine.step(dt);
      const state = engine.getState();

      if (state.theta[4] > maxAngleLastBall) {
        maxAngleLastBall = state.theta[4];
      }

      expect(state.relativeEnergyError).toBeLessThan(1e-3);
    }

    expect(maxAngleLastBall).toBeGreaterThan(0.25);
  });

  it('يجب أن يدعم تصادم الكتل غير المتساوية وفق المعادلات النظرية', () => {

    const config = createDefaultConfig(2);
    config.masses = [0.1, 0.2];
    config.restitution = 1.0;

    const initialTheta = [0, 0];
    const engine = new CradleEngine(initialTheta, config, new RK4Integrator());

    engine.setAngularVelocities([1.0 / config.lengths[0], 0]);

    const dt = 0.001;

    engine.step(dt);
    
    const state = engine.getState();
    const v0_post = state.omega[0] * config.lengths[0];
    const v1_post = state.omega[1] * config.lengths[1];

    expect(v0_post).toBeCloseTo(-0.333, 2);
    expect(v1_post).toBeCloseTo(0.667, 2);
  });
});
