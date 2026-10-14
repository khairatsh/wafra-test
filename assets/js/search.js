function normalizeArabic(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064b-\u0652]/g, '');
}

function searchProducts(products, query) {
  if (!query || !query.trim()) return products;
  const q = normalizeArabic(query.trim());
  return products.filter(p => {
    const nameMatch = normalizeArabic(p.productNameAr).includes(q);
    const brandMatch = normalizeArabic(p.brandAr || '').includes(q);
    const categoryMatch = normalizeArabic(p.categoryId || '').includes(q);
    return nameMatch || brandMatch || categoryMatch;
  });
}