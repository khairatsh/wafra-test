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

function formatPiastres(piastres) {
  const egp = (piastres / 100).toFixed(2);
  return `${egp} جنيه`;
}