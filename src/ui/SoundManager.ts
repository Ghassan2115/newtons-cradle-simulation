export class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {}

  private init(): void {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      } catch (e) {
        console.warn("Web Audio API is not supported in this browser.");
      }
    }
  }

  /**
   * تشغيل صوت نقرة تصادم معدنية واقعية
   * @param intensity سرعة التصادم النسبية بالمتر/ثانية لتحديد شدة الصوت
   */
  public playClick(intensity: number): void {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // تفعيل السياق الصوتي إذا كان معلقاً (بسبب سياسات المتصفح تجاه التشغيل التلقائي)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
      if (this.ctx.state === 'suspended') return;
    }

    const now = this.ctx.currentTime;
    
    // معادلة تحديد شدة الصوت بناءً على شدة التصادم
    // السرعة النسبية تتراوح عادة بين 0.05 و 1.5 م/ث
    const volume = Math.min(0.8, Math.max(0.01, intensity * 0.5));

    // 1. عقدة التحكم بمستوى الصوت والغلاف الزمني (Gain Node & Envelope)
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    // هجوم حاد جداً ولحظي (Attack)
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.001);
    // اضمحلال أسي سريع لمحاكاة اصطدام الأجسام الصلبة المعدنية (Exponential Decay)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    gainNode.connect(this.ctx.destination);

    // 2. المذبذب الأول: موجة مثلثية لإعطاء طنين الرنين المعدني الأساسي
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(2000, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.035);
    osc1.connect(gainNode);

    // 3. المذبذب الثاني: موجة جيبية بتردد عالٍ لإعطاء صوت النقرة الحادة (Click)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3800, now);
    osc2.frequency.exponentialRampToValueAtTime(2500, now + 0.015);
    osc2.connect(gainNode);

    // بدء وإيقاف لحظي
    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + 0.045);
    osc2.stop(now + 0.045);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}
