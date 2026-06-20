import type { CradleConfig, CradleState } from '../physics/Types';

export class Dashboard {
  // عناصر واجهة المستخدم
  private valBallCount = document.getElementById('ball-count-val')!;
  private valRestitution = document.getElementById('restitution-val')!;
  private valDamping = document.getElementById('damping-val')!;
  private valGravity = document.getElementById('gravity-val')!;
  private valSpeed = document.getElementById('speed-val')!;
  private simTime = document.getElementById('sim-time')!;
  private energyError = document.getElementById('energy-error')!;
  private fpsVal = document.getElementById('fps-val')!;

  private slidersContainer = document.getElementById('balls-sliders-container')!;
  private chartCanvas = document.getElementById('energy-chart') as HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // تاريخ الطاقات للرسم البياني
  private historyMaxSamples = 600;
  private historyKE: number[] = [];
  private historyPE: number[] = [];
  private historyTE: number[] = [];

  constructor() {
    this.ctx = this.chartCanvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const parent = this.chartCanvas.parentElement!;
    this.chartCanvas.width = parent.clientWidth * window.devicePixelRatio;
    this.chartCanvas.height = parent.clientHeight * window.devicePixelRatio;
    this.chartCanvas.style.width = '100%';
    this.chartCanvas.style.height = '100%';
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  /**
   * تحديث القيم النصية للمعاملات في الواجهة
   */
  public updateLabels(config: CradleConfig, speed: number): void {
    this.valBallCount.textContent = config.ballCount.toString();
    this.valRestitution.textContent = config.restitution.toFixed(2);
    this.valDamping.textContent = config.damping.toFixed(3);
    this.valGravity.textContent = config.g.toFixed(2);
    this.valSpeed.textContent = speed.toFixed(2);
  }

  /**
   * تحديث لوحة البيانات الفورية (الوقت، الخطأ النسبي، الإطارات)
   */
  public updateStatus(state: CradleState, fps: number): void {
    this.simTime.textContent = state.time.toFixed(2);
    this.energyError.textContent = (state.relativeEnergyError * 100).toFixed(4) + '%';
    this.fpsVal.textContent = Math.round(fps).toString();

    // تلوين خطأ الطاقة بالأحمر إذا كان كبيراً لإنذار المستخدم بانهيار الاستقرار
    if (state.relativeEnergyError > 0.05) {
      this.energyError.style.color = '#ff00aa';
    } else {
      this.energyError.style.color = '#00ff66';
    }
  }

  /**
   * توليد عناصر التحكم بالكرات الفردية ديناميكياً (الكتلة والزاوية)
   */
  public rebuildBallControls(
    config: CradleConfig,
    initialAngles: number[],
    onBallChange: (index: number, mass: number, angle: number) => void
  ): void {
    this.slidersContainer.innerHTML = '';

    for (let i = 0; i < config.ballCount; i++) {
      const row = document.createElement('div');
      row.className = 'ball-config-row';

      row.innerHTML = `
        <h4>الكرة رقم ${i + 1}</h4>
        <div class="control-group">
          <label>الكتلة: <span id="m-${i}-val">${(config.masses[i] * 1000).toFixed(0)}</span> غرام</label>
          <input type="range" id="m-${i}-range" min="10" max="500" step="5" value="${(config.masses[i] * 1000).toFixed(0)}" />
        </div>
        <div class="control-group">
          <label>زاوية الإطلاق: <span id="a-${i}-val">${(initialAngles[i] * (180 / Math.PI)).toFixed(0)}</span>°</label>
          <input type="range" id="a-${i}-range" min="-45" max="45" step="1" value="${(initialAngles[i] * (180 / Math.PI)).toFixed(0)}" />
        </div>
      `;

      this.slidersContainer.appendChild(row);

      // ربط أحداث تغيير كتل وزوايا الكرات الفردية
      const massRange = row.querySelector(`#m-${i}-range`) as HTMLInputElement;
      const angleRange = row.querySelector(`#a-${i}-range`) as HTMLInputElement;
      const massVal = row.querySelector(`#m-${i}-val`)!;
      const angleVal = row.querySelector(`#a-${i}-val`)!;

      const triggerChange = () => {
        const mass = parseFloat(massRange.value) / 1000; // تحويل لـ كجم
        const angle = (parseFloat(angleRange.value) * Math.PI) / 180; // تحويل لـ راديان
        massVal.textContent = massRange.value;
        angleVal.textContent = angleRange.value;
        onBallChange(i, mass, angle);
      };

      massRange.addEventListener('input', triggerChange);
      angleRange.addEventListener('input', triggerChange);
    }
  }

  /**
   * إضافة عينات الطاقة الحالية للرسم البياني
   */
  public addEnergySample(ke: number, pe: number, te: number): void {
    this.historyKE.push(ke);
    this.historyPE.push(pe);
    this.historyTE.push(te);

    if (this.historyKE.length > this.historyMaxSamples) {
      this.historyKE.shift();
      this.historyPE.shift();
      this.historyTE.shift();
    }
  }

  /**
   * إعادة ضبط تاريخ الرسوم البيانية للطاقة
   */
  public resetChart(): void {
    this.historyKE = [];
    this.historyPE = [];
    this.historyTE = [];
  }

  /**
   * رسم منحنيات الطاقة الحية على الـ Canvas
   */
  public drawChart(): void {
    const width = this.chartCanvas.width / window.devicePixelRatio;
    const height = this.chartCanvas.height / window.devicePixelRatio;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    if (this.historyKE.length === 0) return;

    // 1. حساب أقصى قيمة طاقة لتوسيع المحور الصادي تلقائياً
    let maxEnergy = 1e-5; // قيمة دنيا صغيرة جداً لتمكين التوسيع الديناميكي الكامل وتجنب تسطيح المنحنيات
    for (let i = 0; i < this.historyKE.length; i++) {
      maxEnergy = Math.max(maxEnergy, this.historyKE[i], this.historyPE[i], this.historyTE[i]);
    }
    // إضافة هامش علوي بنسبة 10%
    maxEnergy *= 1.1;

    // 2. رسم شبكة الخلفية (Grid Lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. رسم منحنيات الطاقة
    const drawPath = (data: number[], color: string, glowColor: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 4;

      const stepX = width / (this.historyMaxSamples - 1);
      const startIdx = this.historyMaxSamples - data.length;

      for (let i = 0; i < data.length; i++) {
        const x = (startIdx + i) * stepX;
        const y = height - (data[i] / maxEnergy) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // تنظيف توهج الظلال
    };

    // طاقة كامنة (سماوي)
    drawPath(this.historyPE, '#00e5ff', 'rgba(0, 229, 255, 0.4)');
    // طاقة حركية (وردي)
    drawPath(this.historyKE, '#ff00aa', 'rgba(255, 0, 170, 0.4)');
    // طاقة ميكانيكية كلية (أخضر)
    drawPath(this.historyTE, '#00ff66', 'rgba(0, 255, 102, 0.4)');
  }
}
