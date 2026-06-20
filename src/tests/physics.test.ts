import { describe, it, expect } from 'vitest';
import type { CradleConfig } from '../physics/Types';
import { CradleEngine } from '../physics/Engine';
import { RK4Integrator } from '../physics/integrators/RK4';
import { VelocityVerletIntegrator } from '../physics/integrators/VelocityVerlet';

// دالة مساعدة لإنشاء تكوين افتراضي لـ 5 كرات متساوية الكتلة
function createDefaultConfig(ballCount = 5): CradleConfig {
  const radii = new Array<number>(ballCount).fill(0.02); // 2 cm
  const lengths = new Array<number>(ballCount).fill(0.3); // 30 cm
  const masses = new Array<number>(ballCount).fill(0.05); // 50 g
  const pivots = [];

  // نقاط تعليق متلاصقة بناءً على القطر
  let currentX = -(ballCount - 1) * 0.02; // لتكون متمركزة حول الصفر
  for (let i = 0; i < ballCount; i++) {
    pivots.push({ x: currentX, y: 0.3, z: 0 });
    currentX += 0.04; // القطر = 2 * r = 0.04
  }

  return {
    ballCount,
    g: 9.81,
    restitution: 1.0, // مرن تماماً للتجربة
    damping: 0.0,     // لا يوجد تخميد
    masses,
    radii,
    lengths,
    pivots,
  };
}

describe("Newton's Cradle Physics Engine Tests", () => {
  it('يجب أن يتحرك بندول مفرد حركة اهتزازية صحيحة مع المكاملين', () => {
    const config = createDefaultConfig(1);
    const initialTheta = [0.2]; // إزاحة ابتدائية بالراديان

    const rk4Engine = new CradleEngine(initialTheta, config, new RK4Integrator());
    const verletEngine = new CradleEngine(initialTheta, config, new VelocityVerletIntegrator());

    // تشغيل خطوة محاكاة لـ 0.1 ثانية بتردد 1000 هرتز
    const dt = 0.001;
    for (let i = 0; i < 100; i++) {
      rk4Engine.step(dt);
      verletEngine.step(dt);
    }

    const rk4State = rk4Engine.getState();
    const verletState = verletEngine.getState();

    // يجب أن تكون الزاوية قد تغيرت وتتحرك نحو المركز (أقل من القيمة الابتدائية 0.2)
    expect(rk4State.theta[0]).toBeLessThan(0.2);
    expect(verletState.theta[0]).toBeLessThan(0.2);

    // يجب أن تكون طاقة النظام محفوظة تماماً في حالة عدم وجود تخميد
    expect(rk4State.relativeEnergyError).toBeLessThan(1e-4);
    expect(verletState.relativeEnergyError).toBeLessThan(1e-4);
  });

  it('يجب أن يحفظ الطاقة والزخم عند التصادم المرن لكرات متطابقة', () => {
    const config = createDefaultConfig(5);
    // نرفع الكرة الأولى فقط بزاوية -0.3 راديان (إلى اليسار)
    const initialTheta = [-0.3, 0, 0, 0, 0];
    const engine = new CradleEngine(initialTheta, config, new RK4Integrator());

    const dt = 0.001;
    let maxAngleLastBall = 0;

    // تشغيل المحاكاة لـ 0.5 ثانية (يكفي لحدوث التصادم الأول وارتفاع الكرة الأخيرة)
    for (let i = 0; i < 500; i++) {
      engine.step(dt);
      const state = engine.getState();
      
      // تسجيل أقصى زاوية تصل إليها الكرة الأخيرة
      if (state.theta[4] > maxAngleLastBall) {
        maxAngleLastBall = state.theta[4];
      }

      // التحقق الفوري من حفظ الطاقة في كل خطوة
      expect(state.relativeEnergyError).toBeLessThan(1e-3);
    }

    // يجب أن ترتفع الكرة الأخيرة بزاوية قريبة جداً من زاوية إطلاق الكرة الأولى (0.3) بفعل نقل الزخم
    expect(maxAngleLastBall).toBeGreaterThan(0.25);
  });

  it('يجب أن يدعم تصادم الكتل غير المتساوية وفق المعادلات النظرية', () => {
    // إعداد كرتين بكتل متفاوتة (الأولى 0.1 كجم والثانية 0.2 كجم)
    const config = createDefaultConfig(2);
    config.masses = [0.1, 0.2];
    config.restitution = 1.0;

    // الكرة الأولى تمتلك سرعة زاوية ابتدائية قبل التصادم مباشرة
    // لتسهيل الفحص، نقوم ببدء المحاكاة بزاوية صفر مع منح الكرة الأولى سرعة مماسية 1.0 م/ث
    // أي سرعة زاوية = v/L = 1.0 / 0.3 = 3.333 راديان/ث
    const initialTheta = [0, 0];
    const engine = new CradleEngine(initialTheta, config, new RK4Integrator());
    
    // حقن السرعة الابتدائية يدوياً للكرة الأولى
    // @ts-ignore
    engine.state.omega[0] = 1.0 / config.lengths[0];
    // @ts-ignore
    engine.state.initialEnergy = engine.calculateKineticEnergy(engine.state.omega);

    const dt = 0.001;
    
    // تشغيل خطوة واحدة لحل التصادم مباشرة لأن الكرتين متداخلتين وتتحركان نحو بعضهما
    engine.step(dt);
    
    const state = engine.getState();
    const v0_post = state.omega[0] * config.lengths[0];
    const v1_post = state.omega[1] * config.lengths[1];

    // نظرياً، للسرعات بعد التصادم لكتل متفاوتة (m1=0.1, m2=0.2, u1=1.0, u2=0):
    // v1 = (m1 - m2)/(m1 + m2) * u1 = (0.1 - 0.2)/0.3 * 1.0 = -0.333 m/s
    // v2 = 2*m1 / (m1+m2) * u1 = 0.2/0.3 * 1.0 = 0.667 m/s
    expect(v0_post).toBeCloseTo(-0.333, 2);
    expect(v1_post).toBeCloseTo(0.667, 2);
  });
});
