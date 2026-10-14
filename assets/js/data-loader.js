async function loadWafraData() {
  const CACHE_KEY = 'wafra_offline_data_v1';
  
  try {
    // محاولة جلب البيانات من الشبكة أو الخادم
    const manifestRes = await fetch('./data/manifest.json?v=' + Date.now());
    if (!manifestRes.ok) throw new Error('فشل الاتصال بالخادم');
    const manifest = await manifestRes.json();
    
    const loadJson = async (filename) => {
      const res = await fetch(`./data/${filename}?v=${manifest.dataVersion}`);
      if (!res.ok) throw new Error(filename);
      return res.json();
    };

    const data = {
      manifest,
      locations: await loadJson(manifest.files.locations),
      categories: await loadJson(manifest.files.categories),
      products: await loadJson(manifest.files.products),
      stores: await loadJson(manifest.files.stores),
      branches: await loadJson(manifest.files.branches),
      prices: await loadJson(manifest.files.prices),
      offers: await loadJson(manifest.files.offers),
      // جلب الإعلانات بأمان (مع التحقق لضمان عدم توقف التطبيق لو لم تُضاف في المانفست بعد)
      ads: (manifest.files && manifest.files.ads) ? await loadJson(manifest.files.ads) : []
    };

    // حفظ البيانات بنجاح في الذاكرة المحلية للجهاز لاستخدامها عند انقطاع الإنترنت
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return data;

  } catch (error) {
    console.warn('لا توجد إنترنت، جاري استرجاع البيانات المخزنة محلياً...', error);
    
    // التحقق مما إذا كانت البيانات مخزنة مسبقاً
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      console.log('يتم عرض النسخة المخزنة محلياً');
      return JSON.parse(cachedData);
    }

    // في حال عدم وجود إنترنت وعدم وجود تخزين محلي سابق
    const resultsContainer = document.getElementById('results-container');
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