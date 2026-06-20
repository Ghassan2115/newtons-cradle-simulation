import type { CradleConfig, CradleState } from './Types';
import type { Integrator } from './integrators/Integrator';
import { RK4Integrator } from './integrators/RK4';

export class CradleEngine {
  private state: CradleState;
  private config: CradleConfig;
  private integrator: Integrator;

  constructor(initialTheta: number[], config: CradleConfig, integrator?: Integrator) {
    this.config = { ...config };
    this.integrator = integrator || new RK4Integrator();

    const n = this.config.ballCount;
    const theta = [...initialTheta];
    while (theta.length < n) theta.push(0);
    const omega = new Array<number>(n).fill(0);
    const alpha = new Array<number>(n).fill(0);

    // حساب الطاقة الابتدائية
    const pe = this.calculatePotentialEnergy(theta);
    const ke = 0; // السرعات الابتدائية صفر
    const initialEnergy = pe + ke;

    this.state = {
      time: 0,
      theta,
      omega,
      alpha,
      kineticEnergy: ke,
      potentialEnergy: pe,
      totalEnergy: initialEnergy,
      initialEnergy: initialEnergy,
      relativeEnergyError: 0,
      lastCollisionVelocity: 0,
    };
  }

  public getState(): CradleState {
    return { ...this.state };
  }

  public getConfig(): CradleConfig {
    return { ...this.config };
  }

  public setIntegrator(integrator: Integrator): void {
    this.integrator = integrator;
  }

  public getIntegrator(): Integrator {
    return this.integrator;
  }

  public updateConfig(newConfig: Partial<CradleConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // إعادة ضبط الطاقة الابتدائية لتتناسب مع التعديل الجديد (الكتل أو الأطوال)
    const pe = this.calculatePotentialEnergy(this.state.theta);
    const ke = this.calculateKineticEnergy(this.state.omega);
    this.state.initialEnergy = pe + ke;
    this.state.kineticEnergy = ke;
    this.state.potentialEnergy = pe;
    this.state.totalEnergy = pe + ke;
    this.state.relativeEnergyError = 0;
    this.state.lastCollisionVelocity = 0;
  }

  /**
   * تنفيذ خطوة فيزيائية واحدة ثابتة dt
   */
  public step(dt: number): void {
    // 1. حساب التسارع الزاوي الصافي (الجاذبية والتخميد اللزج)
    const getAlpha = (t: number, w: number, i: number): number => {
      const g = this.config.g;
      const L = this.config.lengths[i];
      const m = this.config.masses[i];
      const b = this.config.damping;

      // θ'' = -(g/L) * sin(θ) - (b/m) * θ'
      return -(g / L) * Math.sin(t) - (b / m) * w;
    };

    // 2. دمج حركة التأرجح الحر باستخدام المكامل المختار
    const integrationResult = this.integrator.step(
      this.state.theta,
      this.state.omega,
      this.config,
      dt,
      getAlpha
    );

    let nextTheta = integrationResult.theta;
    let nextOmega = integrationResult.omega;
    let nextAlpha = integrationResult.alpha;

    // 3. معالجة التصادمات الحتمية (النبضية المتكررة)
    const collisionResult = this.resolveCollisions(nextTheta, nextOmega);
    nextOmega = collisionResult.omega;
    const collisionOccurred = collisionResult.occurred;
    const lastCollisionVelocity = collisionResult.maxRelativeVelocity;

    // إعادة حساب التسارعات بعد تعديل السرعات بفعل التصادم
    if (collisionOccurred) {
      for (let i = 0; i < this.config.ballCount; i++) {
        nextAlpha[i] = getAlpha(nextTheta[i], nextOmega[i], i);
      }
    }

    // 4. حساب الطاقات والخطأ النسبي
    const ke = this.calculateKineticEnergy(nextOmega);
    const pe = this.calculatePotentialEnergy(nextTheta);
    const totalEnergy = ke + pe;

    let relativeEnergyError = 0;
    if (this.state.initialEnergy !== 0) {
      relativeEnergyError = Math.abs(totalEnergy - this.state.initialEnergy) / this.state.initialEnergy;
    }

    // 5. تحديث الحالة الكلية
    this.state = {
      time: this.state.time + dt,
      theta: nextTheta,
      omega: nextOmega,
      alpha: nextAlpha,
      kineticEnergy: ke,
      potentialEnergy: pe,
      totalEnergy: totalEnergy,
      initialEnergy: this.state.initialEnergy,
      relativeEnergyError: relativeEnergyError,
      lastCollisionVelocity: lastCollisionVelocity,
    };
  }

  /**
   * حساب الطاقة الكامنة للنظام
   * Ep = sum( m_i * g * L_i * (1 - cos(theta_i)) )
   */
  private calculatePotentialEnergy(theta: number[]): number {
    let pe = 0;
    for (let i = 0; i < this.config.ballCount; i++) {
      const m = this.config.masses[i];
      const L = this.config.lengths[i];
      pe += m * this.config.g * L * (1 - Math.cos(theta[i]));
    }
    return pe;
  }

  /**
   * حساب الطاقة الحركية للنظام
   * Ek = sum( 0.5 * m_i * (L_i * omega_i)^2 )
   */
  private calculateKineticEnergy(omega: number[]): number {
    let ke = 0;
    for (let i = 0; i < this.config.ballCount; i++) {
      const m = this.config.masses[i];
      const L = this.config.lengths[i];
      const v = L * omega[i]; // السرعة المماسية
      ke += 0.5 * m * v * v;
    }
    return ke;
  }

  /**
   * حل تصادمات الكرات المتعددة بشكل حتمي ومتكرر (Iterative Impulse Resolution)
   */
  private resolveCollisions(theta: number[], omega: number[]): { omega: number[]; occurred: boolean; maxRelativeVelocity: number } {
    const nextOmega = [...omega];
    const n = this.config.ballCount;
    let collided = true;
    let occurred = false;
    let maxRelativeVelocity = 0;
    let iterations = 0;
    const maxIterations = 30; // حد أقصى للنبضات المتسلسلة لضمان انتهاء الحلقة

    // حساب المواضع الأفقية التقديرية للكرات للتحقق من التداخل
    // بما أن الكرات معلقة بجانب بعضها، فإن المسافة الأفقية الفعالة تعتمد على زاوية الخيط ونقاط التعليق
    const getX = (idx: number, t: number): number => {
      return this.config.pivots[idx].x + this.config.lengths[idx] * Math.sin(t);
    };

    const getY = (idx: number, t: number): number => {
      return this.config.pivots[idx].y - this.config.lengths[idx] * Math.cos(t);
    };

    while (collided && iterations < maxIterations) {
      collided = false;

      for (let i = 0; i < n - 1; i++) {
        const rA = this.config.radii[i];
        const rB = this.config.radii[i + 1];

        // المسافة الفعلية ثلاثية الأبعاد بين مركزي الكرتين المتجاورتين
        const xA = getX(i, theta[i]);
        const yA = getY(i, theta[i]);
        const xB = getX(i + 1, theta[i + 1]);
        const yB = getY(i + 1, theta[i + 1]);

        const dx = xB - xA;
        const dy = yB - yA;
        const d = Math.sqrt(dx * dx + dy * dy);

        const overlap = rA + rB - d;

        if (overlap > 0) {
          // السرعات المماسية على طول مسار التأرجح
          const uA = this.config.lengths[i] * nextOmega[i];
          const uB = this.config.lengths[i + 1] * nextOmega[i + 1];

          // شرط الحركة التقاربية: يجب أن تتحرك الكرة اليسرى بسرعة أكبر نحو اليمين مقارنة بالكرة اليمنى
          // أو يتحركان نحو بعضهما البعض
          const relVel = uA - uB;

          if (relVel > 1e-6) {
            collided = true;
            occurred = true;
            maxRelativeVelocity = Math.max(maxRelativeVelocity, relVel);

            const mA = this.config.masses[i];
            const mB = this.config.masses[i + 1];
            const e = this.config.restitution;

            // حل معادلات التصادم الثنائي المرن/غير المرن وحساب السرعات المماسية النهائية
            // vA+ = (mA*uA + mB*uB - mB*e*(uA - uB)) / (mA + mB)
            // vB+ = (mA*uA + mB*uB + mA*e*(uA - uB)) / (mA + mB)
            const vA = (mA * uA + mB * uB - mB * e * relVel) / (mA + mB);
            const vB = (mA * uA + mB * uB + mA * e * relVel) / (mA + mB);

            // تحويل السرعات المماسية إلى سرعات زاوية
            nextOmega[i] = vA / this.config.lengths[i];
            nextOmega[i + 1] = vB / this.config.lengths[i + 1];
          }
        }
      }

      iterations++;
    }

    return { omega: nextOmega, occurred, maxRelativeVelocity };
  }
}
