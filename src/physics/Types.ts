export interface CradleState {
  time: number;                  // الزمن التراكمي للمحاكاة بالثواني
  theta: number[];               // زوايا الانحراف لكل كرة بالراديان
  omega: number[];               // السرعات الزاوية لكل كرة بالراديان/ثانية
  alpha: number[];               // التسارعات الزاوية لكل كرة بالراديان/ثانية²
  kineticEnergy: number;         // الطاقة الحركية الكلية للجهاز
  potentialEnergy: number;       // الطاقة الكامنة الكلية للجهاز
  totalEnergy: number;           // الطاقة الميكانيكية الكلية
  initialEnergy: number;         // الطاقة الميكانيكية الابتدائية للنظام
  relativeEnergyError: number;   // الخطأ النسبي للطاقة
  lastCollisionVelocity: number; // سرعة التصادم الأخيرة (م/ث) لمزامنة الصوت
}

export interface CradleConfig {
  ballCount: number;             // عدد الكرات في البندول
  g: number;                     // تسارع الجاذبية الأرضية (m/s²)
  restitution: number;           // معامل الاسترداد للتصادم (e) من 0 إلى 1
  damping: number;               // معامل التخميد الخطي (Linear Damping)
  masses: number[];              // كتل الكرات بالكيلوغرام
  radii: number[];               // أنصاف أقطار الكرات بالمتر
  lengths: number[];             // أطوال الخيوط لكل بندول بالمتر
  pivots: { x: number; y: number; z: number }[]; // إحداثيات نقاط التعليق ثلاثية الأبعاد
}
