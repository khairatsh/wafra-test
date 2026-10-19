// تحديد مجلد البيانات بناءً على الصفحة الحالية (مصر أم السعودية)
function getDataFolder() {
  const path = window.location.pathname;
  if (path.includes('saudi.html')) {
    return 'data-sa';
  }
  return 'data-eg';
}

async function loadWafraData() {
  const dataFolder = getDataFolder();
  // مفتاح تخزين منفصل لكل دولة لمنع تداخل البيانات في الـ Cache
  const CACHE_KEY = `wafra_offline_data_${dataFolder.replace('-', '_')}_v1`;
  
  try {
    // محاولة جلب البيانات من المجلد المحدد للدولة عبر الشبكة أو الخادم
    const manifestRes = await fetch(`./${dataFolder}/manifest.json?v=` + Date.now());
    if (!manifestRes.ok) throw new Error('فشل الاتصال بالخادم');
    const manifest = await manifestRes.json();
    
    const loadJson = async (filename) => {
      const res = await fetch(`./${dataFolder}/${filename}?v=${manifest.dataVersion}`);
      if (!res.ok) throw new Error(filename);
      return res.json();
    };

    // جلب المنتجات ومعالجة الـ variants لضمان قراءتها كمصفوفة بشكل سليم
    const rawProducts = await loadJson(manifest.files.products);
    const products = rawProducts.map(product => {
      let variants = product.variants;
      if (typeof variants === 'string') {
        try {
          variants = JSON.parse(variants.replace(/'/g, '"'));
        } catch (e) {
          variants = [];
        }
      }
      return { ...product, variants };
    });

    const data = {
      manifest,
      locations: await loadJson(manifest.files.locations),
      categories: await loadJson(manifest.files.categories),
      products: products,
      stores: await loadJson(manifest.files.stores),
      branches: await loadJson(manifest.files.branches),
      prices: await loadJson(manifest.files.prices),
      offers: await loadJson(manifest.files.offers),
      // جلب الإعلانات بأمان مع التحقق لضمان عدم توقف التطبيق
      ads: (manifest.files && manifest.files.ads) ? await loadJson(manifest.files.ads) : []
    };

    // حفظ البيانات بنجاح في الذاكرة المحلية الخاصة بهذه الدولة للاستخدام عند انقطاع الإنترنت
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return data;

  } catch (error) {
    console.warn(`لا توجد إنترنت (${dataFolder})، جاري استرجاع البيانات المخزنة محلياً...`, error);
    
    // التحقق مما إذا كانت البيانات مخزنة مسبقاً لنفس الدولة
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      console.log(`يتم عرض النسخة المخزنة محلياً لـ ${dataFolder}`);
      return JSON.parse(cachedData);
    }

    // في حال عدم وجود إنترنت وعدم وجود تخزين محلي سابق
    const resultsContainer = document.getElementById('dynamic-content-area');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #EF4444;">
          <h2>لا يوجد اتصال بالإنترنت</h2>
          <p>تعذر تحميل البيانات ولا توجد نسخة مخزنة محلياً على جهازك.</p>
        </div>
      `;
    }
    return null;
  }
}