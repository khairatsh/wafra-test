function calculateFreshness(observationDateStr) {
  const obsDate = new Date(observationDateStr);
  const now = new Date();
  const diffDays = Math.floor((now - obsDate) / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    return { status: 'fresh', label: 'حديث (أقل من 7 أيام)', class: 'badge-fresh' };
  } else if (diffDays <= 30) {
    return { status: 'aging', label: 'مقبول (7-30 يوم)', class: 'badge-aging' };
  } else if (diffDays <= 90) {
    return { status: 'stale', label: 'قديم (31-90 يوم)', class: 'badge-stale' };
  } else {
    return { status: 'unusable', label: 'غير صالح للمقارنة (>90 يوم)', class: 'badge-unusable' };
  }
}

// ==========================================
// 🌟 دالة تنسيق وعرض الأسعار والعملة حسب الدولة
// ==========================================
function formatPiastres(piastres) {
  // التحقق هل نحن في صفحة السعودية أو تم اختيارها في التخزين المحلي
  const isSaudiPage = window.location.pathname.includes('saudi.html') || localStorage.getItem('wafra_user_country') === 'sa';
  
  // اختيار العملة المناسبة (ريال سعودي للمملكة، جنيه مصري لمصر)
  const currencySymbol = isSaudiPage ? 'ر.س' : 'ج.م';
  
  const amount = (piastres / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  return `${amount} ${currencySymbol}`;
}