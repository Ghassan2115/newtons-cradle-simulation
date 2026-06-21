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
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        this.resizeCanvas();
        this.drawChart();
      });
    });
    resizeObserver.observe(this.chartCanvas.parentElement!);
  }

  public resizeCanvas(): void {
    const parent = this.chartCanvas.parentElement;
    if (!parent) return;
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
    const canvasW = this.chartCanvas.width / window.devicePixelRatio;
    const canvasH = this.chartCanvas.height / window.devicePixelRatio;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // هوامش محور الرسم لتظهر الحدود بوضوح
    const padLeft = 45;
    const padRight = 10;
    const padTop = 10;
    const padBottom = 20;
    const width = canvasW - padLeft - padRight;
    const height = canvasH - padTop - padBottom;

    if (width <= 0 || height <= 0) return;

    // 1. رسم إطار المحاور بوضوح تام
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // خط المحور السفلي (X-axis)
    ctx.moveTo(padLeft, padTop + height);
    ctx.lineTo(padLeft + width, padTop + height);
    // خط المحور الأيسر (Y-axis)
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + height);
    ctx.stroke();

    if (this.historyKE.length === 0) return;

    // 2. حساب أقصى قيمة طاقة لتوسيع المحور الصادي تلقائياً
    let maxEnergy = 1e-5;
    for (let i = 0; i < this.historyKE.length; i++) {
      maxEnergy = Math.max(maxEnergy, this.historyKE[i], this.historyPE[i], this.historyTE[i]);
    }
    maxEnergy *= 1.15; // هامش علوي

    // 3. رسم شبكة الخلفية وتسميات المحور Y
    ctx.font = '10px Tajawal, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const gridLines = 4;
    for (let g = 0; g <= gridLines; g++) {
      const yFrac = g / gridLines;
      const yPos = padTop + height * (1 - yFrac);
      const energyVal = maxEnergy * yFrac;

      // خط شبكة أفقي
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(padLeft + width, yPos);
      ctx.stroke();

      // تسمية القيمة
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      if (energyVal < 0.001) {
        ctx.fillText(energyVal.toExponential(0), padLeft - 5, yPos);
      } else {
        ctx.fillText(energyVal.toFixed(4), padLeft - 5, yPos);
      }
    }

    // تسمية "0" على المحور السفلي
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.textAlign = 'right';
    ctx.fillText('0', padLeft - 5, padTop + height);

    // 4. رسم منحنيات الطاقة
    const drawPath = (data: number[], color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      const stepX = width / (this.historyMaxSamples - 1);
      const startIdx = this.historyMaxSamples - data.length;

      for (let i = 0; i < data.length; i++) {
        const x = padLeft + (startIdx + i) * stepX;
        const y = padTop + height - (data[i] / maxEnergy) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    // طاقة كامنة (سماوي)
    drawPath(this.historyPE, '#00e5ff');
    // طاقة حركية (وردي)
    drawPath(this.historyKE, '#ff00aa');
    // طاقة ميكانيكية كلية (أخضر)
    drawPath(this.historyTE, '#00ff66');
  }
}
