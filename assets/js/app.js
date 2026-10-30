// 🌟 التوجيه المباشر للدولة المخزنة عند فتح WebView
(function checkSavedCountryRedirect() {
  const savedCountry = localStorage.getItem('wafra_user_country');
  const currentPath = window.location.pathname;

  if (savedCountry === 'sa' && !currentPath.includes('saudi.html')) {
    window.location.replace('saudi.html');
    return;
  }
  if (savedCountry === 'eg' && currentPath.includes('saudi.html')) {
    window.location.replace('index.html');
    return;
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  const data = await loadWafraData();
  if (!data) return;

  // ================== فصل العروض عن الأسعار ==================
  // prices.json هو المصدر الوحيد لسعر القطعة الفعلي اليوم (عادي أو مخفض أسبوعياً).
  // offers.json مخصص للباكدجات وعروض الكميات والقيمة المضافة فقط.
  // لذلك لا يتم دمج أي عرض داخل جدول الأسعار، والمقارنة تعتمد على prices فقط.

  // App States
  let currentTab = 'home';
  let selectedStoreId = null;
  let heroAdsInterval = null; 
  let selectedCategoryId = null;
  let selectedDepartmentId = null;
  let selectedVariantIdForComparison = null;
  let comparisonMode = 'brand'; // 🌟 متغير للتحكم في وضع المقارنة (براند واحد أو كافة البدائل المتشابهة)
  let previousTabBeforeComparison = 'home';
  let currentLocation = { governorateId: '', cityId: '' };
  let currentSearchQuery = '';
  let selectedCategoryIdForStores = null;
  const trackedAdImpressions = new Set();
  
  // Elements
  const navHomeBtn = document.getElementById('nav-home-btn');
  const navStoresBtn = document.getElementById('nav-stores-btn');
  const navOffersBtn = document.getElementById('nav-offers-btn');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const searchSuggestions = document.getElementById('search-suggestions');
  
  const storeHeaderBar = document.getElementById('store-header-bar');
  const backToHomeBtn = document.getElementById('back-to-home-btn');
  const selectedStoreTitle = document.getElementById('selected-store-title');
  
  const productComparisonHeader = document.getElementById('product-comparison-header');
  const backFromComparisonBtn = document.getElementById('back-from-comparison-btn');
  const comparisonProductTitle = document.getElementById('comparison-product-title');
  
  const searchSectionWrapper = document.getElementById('search-section-wrapper');
  const dynamicContentArea = document.getElementById('dynamic-content-area');
  
  const categoryBtn = document.getElementById('nav-category-btn');
  const categoryMenu = document.getElementById('category-dropdown-menu');

  const savedCountry = localStorage.getItem('wafra_user_country');
  const welcomeModal = document.getElementById('welcome-country-modal');

  if (!savedCountry && welcomeModal) {
    welcomeModal.classList.add('show');
  }

  window.selectCountry = function(countryCode) {
    localStorage.setItem('wafra_user_country', countryCode);
    if (welcomeModal) welcomeModal.classList.remove('show');

    if (countryCode === 'sa') {
      window.location.href = 'saudi.html';
    } else {
      window.location.href = 'index.html';
    }
  };

  const flagImg = document.querySelector('.country-btn .flag-img');
  const isSaudiPage = window.location.pathname.includes('saudi.html');

  if (flagImg) {
    if (isSaudiPage) {
      flagImg.src = 'https://flagcdn.com/w40/sa.png';
      flagImg.alt = 'السعودية';
      localStorage.setItem('wafra_user_country', 'sa');
    } else {
      flagImg.src = 'https://flagcdn.com/w40/eg.png';
      flagImg.alt = 'مصر';
      localStorage.setItem('wafra_user_country', 'eg');
    }
  }

  // ================== Location Popup Logic ==================
  const locationModal = document.getElementById('location-modal');
  const openLocationModalBtn = document.getElementById('open-location-modal');
  const closeLocationModalBtn = document.getElementById('close-location-modal');
  const modalGovSelect = document.getElementById('modal-gov-select');
  const modalCitySelect = document.getElementById('modal-city-select');
  const confirmLocationBtn = document.getElementById('confirm-location-btn');
  const currentLocationLabel = document.getElementById('current-location-label');

  let tempSelectedGovId = '';
  let tempSelectedCityId = '';

  if (openLocationModalBtn) {
    openLocationModalBtn.addEventListener('click', () => {
      populateModalGovs();
      if (locationModal) locationModal.classList.add('show');
    });
  }

  // أزرار "تحديد الموقع" داخل الحالات الفارغة (تفويض حدث واحد لكل الصفحات)
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-location-modal]');
    if (!trigger) return;
    populateModalGovs();
    if (locationModal) locationModal.classList.add('show');
  });

  if (closeLocationModalBtn) {
    closeLocationModalBtn.addEventListener('click', () => {
      if (locationModal) locationModal.classList.remove('show');
    });
  }

  function populateModalGovs() {
    if (!modalGovSelect) return;
    modalGovSelect.innerHTML = '<option value="" disabled selected>اختر المحافظة...</option>';
    if (data.locations) {
      data.locations.forEach(gov => {
        const option = document.createElement('option');
        option.value = gov.governorateId;
        option.textContent = gov.governorateNameAr;
        modalGovSelect.appendChild(option);
      });
    }
  }

  if (modalGovSelect) {
    modalGovSelect.addEventListener('change', (e) => {
      tempSelectedGovId = e.target.value;
      tempSelectedCityId = '';
      if (modalCitySelect) {
        modalCitySelect.innerHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        modalCitySelect.disabled = false;
      }
      const govData = data.locations.find(gov => gov.governorateId === tempSelectedGovId);
      if (govData && govData.cities) {
        govData.cities.forEach(city => {
          const option = document.createElement('option');
          option.value = city.cityId;
          option.textContent = city.cityNameAr;
          modalCitySelect.appendChild(option);
        });
      }
      if (confirmLocationBtn) confirmLocationBtn.disabled = true;
    });
  }

  if (modalCitySelect) {
    modalCitySelect.addEventListener('change', (e) => {
      tempSelectedCityId = e.target.value;
      if (confirmLocationBtn) confirmLocationBtn.disabled = false;
    });
  }

  if (confirmLocationBtn) {
    confirmLocationBtn.addEventListener('click', () => {
      if (tempSelectedGovId && tempSelectedCityId) {
        const govObj = data.locations.find(g => g.governorateId === tempSelectedGovId);
        const cityObj = govObj?.cities.find(c => c.cityId === tempSelectedCityId);
        if (govObj && cityObj) {
          currentLocation = {
            governorateId: tempSelectedGovId,
            cityId: tempSelectedCityId
          };
          const locationText = `${cityObj.cityNameAr}`;
          if (currentLocationLabel) {
            currentLocationLabel.textContent = locationText;
          }
          localStorage.setItem('wafra_user_location', JSON.stringify(currentLocation));
          localStorage.setItem('wafra_user_location_text', locationText);

          if (locationModal) locationModal.classList.remove('show');
          renderApp();
        }
      }
    });
  }

  const savedLocationJson = localStorage.getItem('wafra_user_location');
  const savedLocationText = localStorage.getItem('wafra_user_location_text');
  const forceOpenModal = localStorage.getItem('force_open_location_modal');

  if (savedLocationJson && savedLocationText && !forceOpenModal) {
    try {
      currentLocation = JSON.parse(savedLocationJson);
      if (currentLocationLabel) {
        currentLocationLabel.textContent = savedLocationText;
      }
    } catch (e) {
      console.error("Error parsing saved location", e);
    }
  } else {
    localStorage.removeItem('force_open_location_modal');
    setTimeout(() => {
      populateModalGovs();
      if (locationModal) locationModal.classList.add('show');
    }, 400);
  }

  window.switchCountry = function(countryCode, targetUrl) {
    localStorage.removeItem('wafra_user_location');
    localStorage.removeItem('wafra_user_location_text');
    localStorage.setItem('wafra_user_country', countryCode);
    localStorage.setItem('force_open_location_modal', 'true');
    window.location.href = targetUrl;
  };

  function populateCategoriesMenu() {
    if (!categoryMenu) return;
    categoryMenu.innerHTML = '';

    const availableDepartments = getAvailableDepartments();
    if (availableDepartments.length === 0) {
      const item = document.createElement('div');
      item.className = 'dropdown-item is-disabled';
      item.textContent = currentLocation.cityId
        ? 'لا توجد أقسام متاحة في مدينتك'
        : 'اختر موقعك أولاً';
      categoryMenu.appendChild(item);
      return;
    }

    availableDepartments.forEach(department => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.innerHTML = `<span class="dropdown-item-icon" aria-hidden="true">${getDepartmentIcon(department)}</span><span>${department.departmentNameAr}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedDepartmentId = department.departmentId;
        selectedCategoryId = null;
        currentTab = 'department-products';
        setActiveNav(categoryBtn);
        categoryMenu.classList.remove('show');
        renderApp();
      });
      categoryMenu.appendChild(item);
    });
  }

  if (categoryMenu) {
    categoryMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  if (categoryBtn) {
    categoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      categoryMenu.classList.toggle('show');
    });
  }

  document.addEventListener('click', () => {
    if (categoryMenu) categoryMenu.classList.remove('show');
    if (searchSuggestions) searchSuggestions.classList.remove('show');
  });

  if (navHomeBtn) {
    navHomeBtn.addEventListener('click', () => {
      currentTab = 'home';
      selectedStoreId = null;
      selectedCategoryId = null;
      selectedDepartmentId = null;
      setActiveNav(navHomeBtn);
      renderApp();
    });
  }

  if (navStoresBtn) {
    navStoresBtn.addEventListener('click', () => {
      currentTab = 'all-stores';
      selectedStoreId = null;
      selectedCategoryId = null;
      selectedDepartmentId = null;
      setActiveNav(navStoresBtn);
      renderApp();
    });
  }

  if (navOffersBtn) {
    navOffersBtn.addEventListener('click', () => {
      currentTab = 'offers';
      selectedStoreId = null;
      selectedCategoryId = null;
      selectedDepartmentId = null;
      setActiveNav(navOffersBtn);
      renderApp();
    });
  }

  if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', () => {
      currentTab = 'home';
      selectedStoreId = null;
      renderApp();
    });
  }

  if (backFromComparisonBtn) {
    backFromComparisonBtn.addEventListener('click', () => {
      currentTab = previousTabBeforeComparison;
      renderApp();
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      currentSearchQuery = searchInput.value;
      searchSuggestions.classList.remove('show');
      renderApp();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        currentSearchQuery = searchInput.value;
        searchSuggestions.classList.remove('show');
        renderApp();
      }
    });

    searchInput.addEventListener('input', () => {
      const query = normalizeArabic(searchInput.value.trim());
      if (query.length === 0) {
        searchSuggestions.innerHTML = '';
        searchSuggestions.classList.remove('show');
        return;
      }

      let matches = [];
      data.products.forEach(product => {
        const pName = normalizeArabic(product.productNameAr);
        const pBrand = normalizeArabic(product.brandAr || '');
        if (pName.includes(query) || pBrand.includes(query)) {
          product.variants.forEach(variant => {
            matches.push({ product, variant });
          });
        }
      });

      if (matches.length === 0) {
        searchSuggestions.innerHTML = `<div class="search-suggestion-item">لا توجد نتائج مطابقة</div>`;
        searchSuggestions.classList.add('show');
        return;
      }

      let suggestionsHtml = '';
      matches.slice(0, 6).forEach(item => {
        suggestionsHtml += `
          <div class="search-suggestion-item" data-variant-id="${item.variant.variantId}">
            <span>🛒 ${item.product.productNameAr} (${item.variant.packageSize} ${item.variant.unit})</span>
            <span style="font-size: 0.8rem; color: #6B7280;">${item.product.brandAr || ''}</span>
          </div>
        `;
      });

      searchSuggestions.innerHTML = suggestionsHtml;
      searchSuggestions.classList.add('show');

      searchSuggestions.querySelectorAll('.search-suggestion-item').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const vId = el.getAttribute('data-variant-id');
          if (vId) {
            selectedVariantIdForComparison = vId;
            comparisonMode = 'brand'; // 🌟 إعادة تعيين وضع المقارنة للماركة فقط تلقائياً
            previousTabBeforeComparison = currentTab;
            currentTab = 'product-comparison';
            searchSuggestions.classList.remove('show');
            searchInput.value = '';
            renderApp();
          }
        });
      });
    });
  }

  function setActiveNav(btn) {
    [navHomeBtn, navStoresBtn, navOffersBtn, categoryBtn].forEach(b => {
      if (b) b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
  }

  function renderApp() {
    if (currentTab !== 'home' && heroAdsInterval) {
      clearInterval(heroAdsInterval);
      heroAdsInterval = null;
    }

    populateCategoriesMenu();

    // عند تغيير المدينة قد يصبح القسم المفتوح غير متاح؛ نعود للرئيسية
    // حتى لا يبقى قسم من مدينة أخرى ظاهراً في الواجهة.
    if (currentTab === 'department-products') {
      const availableDepartmentIds = new Set(getAvailableDepartments().map(department => department.departmentId));
      if (!selectedDepartmentId || !availableDepartmentIds.has(selectedDepartmentId)) {
        currentTab = 'home';
        selectedDepartmentId = null;
        selectedCategoryId = null;
        setActiveNav(navHomeBtn);
      }
    }

    if (storeHeaderBar) storeHeaderBar.style.display = 'none';
    if (productComparisonHeader) productComparisonHeader.style.display = 'none';
    if (searchSectionWrapper) searchSectionWrapper.style.display = 'flex';
    if (searchSuggestions) searchSuggestions.classList.remove('show');

    if (currentTab === 'home') {
      renderHomePage();
    } else if (currentTab === 'all-stores') {
      renderAllStores();
    } else if (currentTab === 'category-stores') {
      renderCategoryStores();
    } else if (currentTab === 'store-products') {
      renderStoreProducts();
    } else if (currentTab === 'category-products') {
      renderCategoryProducts();
    } else if (currentTab === 'department-products') {
      renderDepartmentProducts();
    } else if (currentTab === 'product-comparison') {
      renderProductComparison();
    } else if (currentTab === 'offers') {
      renderOffers();
    } else if (currentTab === 'all-products') {
      renderAllProducts();
    }
  }

  // اسم المدينة بالعربية من بيانات المواقع
  function getCityNameAr(cityId) {
    if (!cityId || !Array.isArray(data.locations)) return '';
    for (const gov of data.locations) {
      const city = (gov.cities || []).find(c => c.cityId === cityId);
      if (city) return city.cityNameAr || '';
    }
    return '';
  }

  // نجمع كل فروع المتجر داخل المدينة نفسها في فرع منطقي واحد.
  // التطبيق يقارن الأسعار والعروض، لذلك لا نعرض كل فرع كصف مستقل.
  function groupBranchesByStoreAndCity(branches) {
    const groups = new Map();

    branches.forEach(branch => {
      if (!branch) return;

      const key = branch.storeId
        ? `${branch.storeId}::${branch.cityId || ''}`
        : `branch::${branch.branchId || ''}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          ...branch,
          branchIds: [],
          branchGroupIds: [],
          branches: []
        };
        groups.set(key, group);
      }

      group.branches.push(branch);
      if (branch.branchId && !group.branchIds.includes(branch.branchId)) {
        group.branchIds.push(branch.branchId);
      }
      if (branch.branchGroupId && !group.branchGroupIds.includes(branch.branchGroupId)) {
        group.branchGroupIds.push(branch.branchGroupId);
      }
    });

    return [...groups.values()];
  }

  function getPhysicalBranchIds(branch) {
    if (Array.isArray(branch.branchIds) && branch.branchIds.length > 0) return branch.branchIds;
    return branch.branchId ? [branch.branchId] : [];
  }

  function getPhysicalBranchGroupIds(branch) {
    if (Array.isArray(branch.branchGroupIds) && branch.branchGroupIds.length > 0) return branch.branchGroupIds;
    return branch.branchGroupId ? [branch.branchGroupId] : [];
  }

  // فروع المدينة المختارة فقط، مجموعة حسب المتجر والمدينة.
  // لا نعيد أي فرع قبل اختيار المدينة، حتى لا تظهر أسعار أو عروض من مدن أخرى.
  function getSelectedCityBranches(branches = data.branches) {
    if (!currentLocation.cityId) return [];
    const cityBranches = branches.filter(b => {
      if (currentLocation.governorateId && b.governorateId !== currentLocation.governorateId) return false;
      return b.cityId === currentLocation.cityId;
    });
    return groupBranchesByStoreAndCity(cityBranches);
  }

  // يقبل معرف فرع فعلياً أو معرف الفرع المنطقي، ويعيد الفرع المنطقي داخل المدينة.
  function getSelectedCityBranch(branchId) {
    if (!branchId || !currentLocation.cityId) return null;
    return getSelectedCityBranches().find(branch =>
      branch.branchId === branchId ||
      (Array.isArray(branch.branchIds) && branch.branchIds.includes(branchId))
    ) || null;
  }

  // دالة مساعدة للحصول على السعر مع دعم نظام الوراثة:
  // سعر فرع محدد -> سعر مجموعة فروع -> السعر العام للمتجر
  // عند وجود أكثر من فرع لنفس المتجر في المدينة نأخذ أفضل سعر فعلي بينها.
  function getVariantPriceForBranch(variantId, branchId) {
    if (!currentLocation.cityId) return null;

    const branch = getSelectedCityBranch(branchId);
    if (!branch) return null;

    const physicalBranches = Array.isArray(branch.branches) && branch.branches.length > 0
      ? branch.branches
      : [branch];
    const effectivePrices = [];

    physicalBranches.forEach(physicalBranch => {
      // 1. سعر خاص بالفرع (مع التحقق من المدينة إن كان السعر مرتبطاً بمدينة)
      let priceItem = data.prices.find(p =>
        p.variantId === variantId &&
        p.branchId === physicalBranch.branchId &&
        (!p.cityId || p.cityId === physicalBranch.cityId)
      );

      // 2. سعر مجموعة الفروع
      if (!priceItem && physicalBranch.branchGroupId) {
        priceItem = data.prices.find(p =>
          p.variantId === variantId &&
          p.branchGroupId === physicalBranch.branchGroupId
        );
      }

      // 3. السعر العام للمتجر (Store-wide)
      if (!priceItem) {
        priceItem = data.prices.find(p =>
          p.variantId === variantId &&
          p.storeId === physicalBranch.storeId &&
          !p.branchId &&
          !p.branchGroupId
        );
      }

      if (priceItem) {
        effectivePrices.push({
          ...priceItem,
          branchId: branch.branchId
        });
      }
    });

    if (effectivePrices.length === 0) return null;
    sortPricesByFreshness(effectivePrices);
    return effectivePrices[0];
  }

  // إرجاع فروع العرض الموجودة داخل نطاق المدينة المختارة فقط.
  // هذا يضمن عدم ظهور أي عرض أو سعر لفرع خارج المدينة.
  function getOfferScopeBranches(offer) {
    if (!offer || !currentLocation.cityId) return [];

    // حماية إضافية: بعض العروض تحدد مدناً صريحة (مهمة عند تكرار branchId بين المدن)
    if (Array.isArray(offer.cityIds) && offer.cityIds.length > 0) {
      if (!offer.cityIds.includes(currentLocation.cityId)) {
        return [];
      }
    }

    const cityBranches = getSelectedCityBranches();

    let scoped = cityBranches;

    if (offer.storeId) {
      scoped = scoped.filter(b => b.storeId === offer.storeId);
    }

    if (Array.isArray(offer.branchGroupIds) && offer.branchGroupIds.length > 0) {
      scoped = scoped.filter(b =>
        getPhysicalBranchGroupIds(b).some(groupId => offer.branchGroupIds.includes(groupId))
      );
    }

    const targetBranchIds = getOfferBranchIds(offer);
    if (targetBranchIds.length > 0) {
      scoped = scoped.filter(b =>
        getPhysicalBranchIds(b).some(branchId => targetBranchIds.includes(branchId))
      );
    }

    return scoped;
  }

  // التحقق مما إذا كان العرض يغطي أياً من فروع النطاق الجغرافي للمستخدم
  function doesOfferMatchLocation(offer) {
    return getOfferScopeBranches(offer).length > 0;
  }

  // ================== أدوات الواجهة الحديثة ==================
  function getCategoryIcon(categoryId) {
    const icons = {
      cat_meat: '🥩',
      cat_poultary: '🍗',
      cat_fish: '🐟',
      cat_pharmacy: '🧴',
      cat_supermarket: '🛒',
      cat_dairy: '🥛'
    };
    return icons[categoryId] || '📦';
  }

  function getCategoryById(categoryId) {
    return data.categories.find(category => category.categoryId === categoryId) || null;
  }

  function getCategoryDepartmentId(categoryId) {
    return getCategoryById(categoryId)?.departmentId || null;
  }

  function getDepartmentById(departmentId) {
    return (data.departments || []).find(department => department.departmentId === departmentId) || null;
  }

  function getDepartmentIcon(department) {
    return department?.icon || '📦';
  }

  function getStoreDepartmentIds(store) {
    if (!store) return [];
    if (Array.isArray(store.departmentIds) && store.departmentIds.length > 0) {
      return store.departmentIds.filter(Boolean);
    }
    const departmentId = getCategoryDepartmentId(store.categoryId);
    return departmentId ? [departmentId] : [];
  }

  function getCityPricedVariantIds(validBranches = getSelectedCityBranches()) {
    const variantIds = new Set();
    data.products.forEach(product => {
      (product.variants || []).forEach(variant => {
        if (!variant.variantId) return;
        if (validBranches.some(branch => getVariantPriceForBranch(variant.variantId, branch.branchId))) {
          variantIds.add(variant.variantId);
        }
      });
    });
    return variantIds;
  }

  // القسم يظهر فقط إذا كان له منتج مسعّر أو متجر يعمل داخل المدينة المختارة.
  // هذا يمنع ظهور أقسام لا تخص المدينة، مع السماح بإظهار قسم متجر جديد
  // حتى قبل إدخال منتجاته (مثل متجر إلكترونيات في الرياض).
  function getAvailableDepartments() {
    if (!currentLocation.cityId) return [];

    const validBranches = getSelectedCityBranches();
    if (validBranches.length === 0) return [];

    const cityStoreIds = new Set(validBranches.map(branch => branch.storeId));
    const pricedVariantIds = getCityPricedVariantIds(validBranches);
    const availableCategoryIds = new Set();

    data.products.forEach(product => {
      if ((product.variants || []).some(variant => pricedVariantIds.has(variant.variantId))) {
        availableCategoryIds.add(product.categoryId);
      }
    });

    return (data.departments || [])
      .filter(department => department.active !== false)
      .filter(department => {
        const hasProduct = data.categories.some(category =>
          category.departmentId === department.departmentId &&
          availableCategoryIds.has(category.categoryId)
        );
        const hasStore = data.stores.some(store =>
          cityStoreIds.has(store.storeId) &&
          getStoreDepartmentIds(store).includes(department.departmentId)
        );
        return hasProduct || hasStore;
      })
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
  }

  function getDepartmentCategoryIds(departmentId) {
    return new Set(
      data.categories
        .filter(category => category.departmentId === departmentId)
        .map(category => category.categoryId)
    );
  }

  function getAvailableCategoryIdsForDepartment(departmentId) {
    const categoryIds = getDepartmentCategoryIds(departmentId);
    const pricedVariantIds = getCityPricedVariantIds();
    const availableCategoryIds = new Set();

    data.products.forEach(product => {
      if (!categoryIds.has(product.categoryId)) return;
      if ((product.variants || []).some(variant => pricedVariantIds.has(variant.variantId))) {
        availableCategoryIds.add(product.categoryId);
      }
    });

    return availableCategoryIds;
  }

  function getStoreLogoHtml(store, className = 'store-logo-tile') {
    if (store && store.imageUrl) {
      return `<div class="${className}"><img src="${store.imageUrl}" alt="${store.storeNameAr}" loading="lazy"></div>`;
    }
    return `<div class="${className}"><span class="image-placeholder">🏬</span></div>`;
  }

  function isAdActive(ad, todayStr) {
    if (!ad || ad.active === false) return false;
    if (ad.startDate && ad.startDate > todayStr) return false;
    if (ad.endDate && ad.endDate < todayStr) return false;
    return true;
  }

  function getValidAdsForPlacement(placement) {
    const today = getTodayDateStr();
    return (data.ads || [])
      .filter(ad => {
        if (!isAdActive(ad, today)) return false;
        const adPlacement = ad.placement || 'home_hero';
        if (adPlacement !== placement) return false;
        if (ad.scope === 'all' || (!ad.cityId && !ad.governorateId)) return true;
        if (ad.cityId) return Boolean(currentLocation.cityId) && ad.cityId === currentLocation.cityId;
        if (ad.governorateId) return Boolean(currentLocation.governorateId) && ad.governorateId === currentLocation.governorateId;
        return false;
      })
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  }

  function getAdLabel(ad) {
    return ad.badgeAr || 'إعلان';
  }

  function buildAdCtaHtml(ad, className) {
    const label = ad.ctaTextAr || 'اعرف المزيد';
    const dataAd = ad.adId ? ` data-ad-id="${ad.adId}"` : '';
    const target = ad.targetValue || '#';
    if (ad.targetType === 'store') {
      return `<button type="button" class="${className} ad-store-link-btn" data-store-id="${target}"${dataAd}>${label}</button>`;
    }
    if (ad.targetType === 'offers') {
      return `<button type="button" class="${className} ad-tab-link-btn" data-target-tab="offers"${dataAd}>${label}</button>`;
    }
    if (ad.targetType === 'products') {
      return `<button type="button" class="${className} ad-tab-link-btn" data-target-tab="all-products"${dataAd}>${label}</button>`;
    }
    if (ad.targetType === 'category') {
      return `<button type="button" class="${className} ad-category-link-btn" data-category-id="${target}"${dataAd}>${label}</button>`;
    }
    return `<a href="${target}" target="_blank" rel="noopener" class="${className} ad-external-link"${dataAd}>${label}</a>`;
  }

  function buildHeroAdHtml(ad, index) {
    const activeClass = index === 0 ? ' active' : '';
    const subtitle = ad.subtitleAr ? `<p class="hero-ad-subtitle">${ad.subtitleAr}</p>` : '';
    const kicker = ad.kickerAr ? `<span class="hero-ad-kicker">${ad.kickerAr}</span>` : '';
    return `
      <div class="hero-ad-card${activeClass}" data-index="${index}"${ad.adId ? ` data-ad-id="${ad.adId}"` : ''} aria-hidden="${index === 0 ? 'false' : 'true'}">
        <div class="hero-ad-media">
          <img src="${ad.imageUrl}" alt="${ad.titleAr || 'إعلان'}" class="hero-ad-image" loading="${index === 0 ? 'eager' : 'lazy'}">
          <span class="ad-label">${getAdLabel(ad)}</span>
        </div>
        <div class="hero-ad-content">
          <div class="hero-ad-copy">
            ${kicker}
            <h3 class="hero-ad-title">${ad.titleAr || ''}</h3>
            ${subtitle}
          </div>
          ${buildAdCtaHtml(ad, 'hero-ad-cta')}
        </div>
      </div>
    `;
  }

  function buildNativeAdHtml(ad) {
    return `
      <article class="native-ad-card"${ad.adId ? ` data-ad-id="${ad.adId}"` : ''}>
        <div class="native-ad-media">
          <img src="${ad.imageUrl}" alt="${ad.titleAr || 'إعلان'}" loading="lazy">
          <span class="ad-label">${getAdLabel(ad)}</span>
        </div>
        <div class="native-ad-body">
          ${ad.kickerAr ? `<span class="native-ad-kicker">${ad.kickerAr}</span>` : ''}
          <h3>${ad.titleAr || ''}</h3>
          ${ad.subtitleAr ? `<p>${ad.subtitleAr}</p>` : ''}
          ${buildAdCtaHtml(ad, 'native-ad-cta')}
        </div>
      </article>
    `;
  }

  function buildPageHeading(kicker, title, subtitle, countLabel = '') {
    return `
      <div class="page-heading">
        <div class="page-heading-copy">
          ${kicker ? `<span class="page-kicker">${kicker}</span>` : ''}
          <h1 class="page-title">${title}</h1>
          ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
        </div>
        ${countLabel ? `<span class="page-count-pill">${countLabel}</span>` : ''}
      </div>
    `;
  }

  function buildEmptyStateHtml(icon, title, subtitle) {
    if (!currentLocation.cityId) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📍</div>
          <h3>اختر موقعك أولاً</h3>
          <p>حدد المدينة من زر الموقع أعلى الصفحة لعرض الأسعار والعروض المتاحة داخل مدينتك.</p>
          <button type="button" class="btn-primary empty-state-action" data-open-location-modal>تحديد الموقع</button>
        </div>
      `;
    }

    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <h3>${title}</h3>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </div>
    `;
  }

  function buildProductCardHtml(product, variant, bestPrice, store) {
    const freshness = calculateFreshness(bestPrice.observationDate);
    const imageHtml = product.imageUrl
      ? `<img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy">`
      : `<span class="image-placeholder">📷</span>`;
    const priceExtra = getPriceExtraHtml(bestPrice);
    const promoFlag = bestPrice.priceType === 'weekly_offer'
      ? '<span class="product-promo-flag">عرض أسبوعي</span>'
      : '';

    return `
      <article class="card product-card product-card-clickable" data-variant-id="${variant.variantId}" role="button" tabindex="0">
        <div class="product-media">
          ${imageHtml}
          <span class="badge ${freshness.class} product-freshness">${freshness.label}</span>
          ${promoFlag}
        </div>
        <div class="product-body">
          <span class="product-brand">${product.brandAr || 'منتج'}</span>
          <h3 class="product-title">${product.productNameAr}</h3>
          <p class="product-size">${variant.packageSize} ${variant.unit}</p>
          <div class="product-price-row">
            <span class="price-tag">${formatPiastres(bestPrice.pricePiastres)}</span>
            ${priceExtra ? `<span class="product-price-extra">${priceExtra}</span>` : ''}
          </div>
          ${store ? `<div class="product-store"><span class="store-dot"></span><span>${store.storeNameAr}</span></div>` : ''}
        </div>
        <div class="product-footer">
          <span class="product-date">📅 ${bestPrice.observationDate}</span>
          <span class="product-compare">قارن الأسعار <span aria-hidden="true">←</span></span>
        </div>
      </article>
    `;
  }

  function buildStoreCardHtml(store, branchCount, cardClass = 'store-slider-card', options = {}) {
    return `
      <div class="${cardClass} store-card-click" data-store-id="${store.storeId}" role="button" tabindex="0">
        ${getStoreLogoHtml(store)}
        <div class="store-card-copy">
          <h4>${store.storeNameAr}</h4>
          <p>${branchCount} فرع متاح</p>
        </div>
        ${options.linkLabel ? `<span class="store-card-link">${options.linkLabel} <span aria-hidden="true">←</span></span>` : ''}
        ${options.showArrow === false ? '' : '<span class="store-card-arrow" aria-hidden="true">←</span>'}
      </div>
    `;
  }

  function trackAdEvent(adId, eventType) {
    if (!adId) return;
    try {
      const stats = JSON.parse(localStorage.getItem('wafra_ad_stats') || '{}');
      const day = getTodayDateStr();
      if (!stats[day]) stats[day] = {};
      if (!stats[day][adId]) stats[day][adId] = { impressions: 0, clicks: 0 };
      stats[day][adId][eventType] = (stats[day][adId][eventType] || 0) + 1;
      localStorage.setItem('wafra_ad_stats', JSON.stringify(stats));
    } catch (error) {
      // تجاهل أخطاء التخزين المحلي
    }
  }

  function trackAdImpression(adId) {
    if (!adId || trackedAdImpressions.has(adId)) return;
    trackedAdImpressions.add(adId);
    trackAdEvent(adId, 'impressions');
  }

  function attachAdInteractions() {
    document.querySelectorAll('.ad-store-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        trackAdEvent(btn.getAttribute('data-ad-id'), 'clicks');
        selectedStoreId = btn.getAttribute('data-store-id');
        currentTab = 'store-products';
        setActiveNav(navStoresBtn);
        renderApp();
      });
    });

    document.querySelectorAll('.ad-tab-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        trackAdEvent(btn.getAttribute('data-ad-id'), 'clicks');
        currentTab = btn.getAttribute('data-target-tab') || 'home';
        selectedStoreId = null;
        setActiveNav(currentTab === 'offers' ? navOffersBtn : null);
        renderApp();
      });
    });

    document.querySelectorAll('.ad-category-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        trackAdEvent(btn.getAttribute('data-ad-id'), 'clicks');
        selectedCategoryId = btn.getAttribute('data-category-id');
        currentTab = 'category-products';
        setActiveNav(categoryBtn);
        renderApp();
      });
    });

    document.querySelectorAll('.ad-external-link').forEach(link => {
      link.addEventListener('click', () => trackAdEvent(link.getAttribute('data-ad-id'), 'clicks'));
    });
  }

  window.wafraAdStats = function() {
    try {
      return JSON.parse(localStorage.getItem('wafra_ad_stats') || '{}');
    } catch (error) {
      return {};
    }
  };

  // بناء بطاقة عرض (باكدج / قيمة مضافة / عرض متجر) بشكل موحد لكل الشاشات
  function buildOfferCardHtml(offer, options = {}) {
    // لا نبني البطاقة إلا إذا كان للعرض فرع داخل مدينة المستخدم
    const scopeBranches = getOfferScopeBranches(offer);
    if (scopeBranches.length === 0) return '';

    const matchedBranch = scopeBranches[0];
    const store = data.stores.find(s => s.storeId === matchedBranch.storeId);
    if (!store) return '';

    const cityName = getCityNameAr(matchedBranch.cityId);
    const durationBadge = `<span class="offer-duration-badge">${getOfferDurationText(offer.endDate)}</span>`;
    const sponsoredBadge = options.sponsored ? '<span class="sponsored-badge">إعلان ممول</span>' : '';

    // عروض المتجر بدون منتج محدد (توصيل مجاني، مواقف، خدمات...)
    if (!offer.variantId) {
      if (!offer.titleAr) return '';

      const hasBranchIds = getOfferBranchIds(offer).length > 0;
      const hasBranchGroups = Array.isArray(offer.branchGroupIds) && offer.branchGroupIds.length > 0;
      let scopeLabel = 'كل الفروع';
      if (hasBranchIds || hasBranchGroups) {
        scopeLabel = cityName || 'داخل مدينتك';
      }

      return `
        <article class="card offer-card store-offer-card" data-store-id="${store.storeId}" role="button" tabindex="0">
          <div class="offer-card-media store-offer-media">
            ${getStoreLogoHtml(store, 'store-offer-logo')}
            <div class="offer-media-badges">
              <span class="offer-type-badge store">🏬 عرض متجر</span>
              ${sponsoredBadge}
            </div>
            ${durationBadge}
          </div>
          <div class="offer-card-body">
            <h3 class="offer-title">${offer.titleAr}</h3>
            <p class="offer-condition">${offer.conditionAr || 'عرض خاص'}</p>
            <p class="offer-store">🏬 ${store.storeNameAr} <span class="offer-scope">• ${scopeLabel}</span></p>
          </div>
          <div class="offer-card-footer">
            <span>ينتهي ${offer.endDate}</span>
            <span class="offer-footer-link">تصفح المتجر <span aria-hidden="true">←</span></span>
          </div>
        </article>
      `;
    }

    const variant = data.products.flatMap(p => p.variants).find(v => v.variantId === offer.variantId);
    const product = data.products.find(p => p.variants.some(v => v.variantId === offer.variantId));
    if (!variant || !product) return '';

    const matchedBId = matchedBranch.branchId;
    const quantity = getOfferQuantity(offer);
    const total = getOfferTotalPiastres(offer);
    const unitPrice = getOfferUnitPricePiastres(offer);
    const isBundle = quantity > 1;
    const isValueOffer = offer.offerType === 'value' || total === null;

    // حساب التوفير مقارنة بسعر القطعة الفعلي في نفس الفرع/المجموعة داخل المدينة
    let savingHtml = '';
    if (total !== null) {
      const unitPriceItem = getVariantPriceForBranch(offer.variantId, matchedBId);
      if (unitPriceItem) {
        const saving = unitPriceItem.pricePiastres * quantity - total;
        if (saving > 0) {
          savingHtml = `<div class="offer-saving">💸 توفير ${formatPiastres(saving)} مقارنة بسعر القطعة</div>`;
        }
      }
    }

    const imageHtml = product.imageUrl
      ? `<img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy">`
      : `<span class="image-placeholder">📷</span>`;

    const typeBadge = isValueOffer
      ? '<span class="offer-type-badge value">🎁 قيمة مضافة</span>'
      : (isBundle ? '<span class="offer-type-badge bundle">📦 باكدج</span>' : '<span class="offer-type-badge single">🏷️ عرض</span>');

    let priceHtml = '';
    if (total !== null) {
      if (isBundle) {
        priceHtml = `
          <div class="offer-price-block">
            <div class="bundle-price-row">
              <span class="bundle-total">${formatPiastres(total)}</span>
              <span class="bundle-qty-badge">${quantity} قطع</span>
            </div>
            <div class="bundle-unit-price">القطعة ${formatPiastres(unitPrice)}</div>
          </div>
        `;
      } else {
        priceHtml = `<div class="offer-price-block"><span class="bundle-total">${formatPiastres(total)}</span></div>`;
      }
    }

    return `
      <article class="card offer-card product-card-clickable ${isBundle ? 'offer-bundle' : 'offer-value'}" data-variant-id="${variant.variantId}" role="button" tabindex="0">
        <div class="offer-card-media">
          ${imageHtml}
          <div class="offer-media-badges">
            ${typeBadge}
            ${sponsoredBadge}
          </div>
          ${durationBadge}
        </div>
        <div class="offer-card-body">
          <span class="offer-product-brand">${product.brandAr || 'منتج'}</span>
          <h3 class="offer-title">${product.productNameAr}</h3>
          <p class="offer-product-meta">${variant.packageSize} ${variant.unit}</p>
          ${priceHtml}
          <p class="offer-condition">${offer.conditionAr || 'عرض خاص'}</p>
          <p class="offer-store">🏬 ${store.storeNameAr}${cityName ? ` <span class="offer-scope">• ${cityName}</span>` : ''}</p>
          ${savingHtml}
        </div>
        <div class="offer-card-footer">
          <span>ينتهي ${offer.endDate}</span>
          <span class="offer-footer-link">${isValueOffer ? 'تصفح المنتج' : 'قارن سعر القطعة'} <span aria-hidden="true">←</span></span>
        </div>
      </article>
    `;
  }

  function renderHomePage() {
    let html = '';
    const today = getTodayDateStr();

    if (heroAdsInterval) {
      clearInterval(heroAdsInterval);
      heroAdsInterval = null;
    }

    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';
    const validBranches = getSelectedCityBranches();
    const activeStoreIds = [...new Set(validBranches.map(b => b.storeId))];
    const availableDepartments = getAvailableDepartments();

    html += `
      <div class="home-greeting">
        <div class="home-greeting-copy">
          <span class="home-kicker">أهلاً بك في وفرة 👋</span>
          <h1 class="home-title">قارن الأسعار <span>ووفر أكثر</span></h1>
          <p class="home-subtitle">أسعار وعروض المتاجر ${cityName ? `داخل ${cityName}` : 'داخل مدينتك'} فقط.</p>
        </div>
        <button type="button" class="home-location-pill" id="home-location-pill">📍 ${cityName || 'حدد موقعك'}</button>
      </div>
    `;

    // ===== إعلانات الرئيسية =====
    const validAds = getValidAdsForPlacement('home_hero');
    if (validAds.length > 0) {
      html += `<div class="hero-section"><div class="hero-ads-wrapper" id="hero-ads-wrapper">`;
      if (validAds.length > 1) {
        html += `
          <button type="button" class="hero-slider-btn hero-prev-btn" aria-label="السابق">❮</button>
          <button type="button" class="hero-slider-btn hero-next-btn" aria-label="التالي">❯</button>
        `;
      }

      validAds.forEach((ad, index) => {
        html += buildHeroAdHtml(ad, index);
        trackAdImpression(ad.adId);
      });

      if (validAds.length > 1) {
        html += `<div class="hero-dots" role="tablist" aria-label="شرائح الإعلانات">`;
        validAds.forEach((_, index) => {
          html += `<button type="button" class="hero-dot${index === 0 ? ' active' : ''}" data-slide-to="${index}" aria-label="الإعلان ${index + 1}"></button>`;
        });
        html += `</div>`;
      }
      html += `</div></div>`;
    } else {
      html += `
        <div class="home-fallback-hero">
          <div class="home-fallback-copy">
            <span class="home-kicker">وفر مع وفرة</span>
            <h2>أسعار المتاجر القريبة منك في مكان واحد</h2>
            <p>اختر مدينتك وقارن أسعار المنتجات والعروض قبل ما تشتري.</p>
            <button type="button" class="btn-primary" id="fallback-offers-btn">تصفح العروض</button>
          </div>
          <div class="home-fallback-art" aria-hidden="true">🛒</div>
        </div>
      `;
    }

    // ===== الأقسام السريعة =====
    if (availableDepartments.length > 0) {
      html += `
        <div class="home-section-head">
          <h2 class="section-title">تسوق حسب القسم</h2>
          <button type="button" class="btn-text-link" id="view-all-categories-btn">كل المنتجات <span aria-hidden="true">←</span></button>
        </div>
        <div class="category-chips-row">
          <button type="button" class="category-chip all" data-category-id="" data-department-id="">
            <span class="category-chip-icon">✨</span>
            <span>الكل</span>
          </button>
      `;
      availableDepartments.forEach(department => {
        html += `
          <button type="button" class="category-chip" data-department-id="${department.departmentId}">
            <span class="category-chip-icon">${getDepartmentIcon(department)}</span>
            <span>${department.departmentNameAr}</span>
          </button>
        `;
      });
      html += `</div>`;
    }

    // ===== العروض الممولة =====
    const sponsoredOffers = (data.offers || []).filter(o =>
      isOfferActive(o, today) && o.sponsored === true && doesOfferMatchLocation(o)
    );

    if (sponsoredOffers.length > 0) {
      html += `
        <div class="sponsored-slider-wrapper">
          <div class="section-header-row">
            <div>
              <span class="section-kicker">عروض مميزة</span>
              <h2 class="section-title">⭐ عروض ممولة</h2>
            </div>
            <button type="button" class="btn-text-link view-all-offers-btn">عرض الكل <span aria-hidden="true">←</span></button>
          </div>
          <div class="offers-slider">
      `;
      sponsoredOffers.forEach(offer => {
        html += buildOfferCardHtml(offer, { sponsored: true });
      });
      html += `</div></div>`;
    }

    // ===== العروض المميزة =====
    const featuredOffers = (data.offers || []).filter(o =>
      isOfferActive(o, today) && o.homeOfferDisplay === true && o.sponsored !== true && doesOfferMatchLocation(o)
    );

    if (featuredOffers.length > 0) {
      html += `
        <div class="offers-slider-wrapper">
          <div class="section-header-row">
            <div>
              <span class="section-kicker">وفر أكثر</span>
              <h2 class="section-title">🔥 عروض وباكدجات مميزة</h2>
            </div>
            <button type="button" class="btn-text-link view-all-offers-btn">عرض الكل <span aria-hidden="true">←</span></button>
          </div>
          <div class="offers-slider">
      `;
      featuredOffers.forEach(offer => {
        html += buildOfferCardHtml(offer, { sponsored: false });
      });
      html += `</div></div>`;
    }

    // ===== المتاجر المميزة =====
    const featuredStores = data.stores.filter(s => s.homeScreenDisplay === true && activeStoreIds.includes(s.storeId));
    html += `
      <div class="stores-slider-wrapper">
        <div class="section-header-row">
          <div>
            <span class="section-kicker">تسوق محلي</span>
            <h2 class="section-title">🏬 المتاجر المميزة</h2>
          </div>
          <button type="button" id="view-all-stores-btn" class="btn-text-link">عرض المزيد <span aria-hidden="true">←</span></button>
        </div>
        <div class="stores-slider">
    `;

    if (featuredStores.length === 0) {
      html += buildEmptyStateHtml('🏬', 'لا توجد متاجر مميزة', 'لا توجد متاجر مميزة متاحة في نطاقك الجغرافي حالياً.');
    } else {
      featuredStores.forEach(store => {
        const storeBranches = validBranches.filter(b => b.storeId === store.storeId);
        html += buildStoreCardHtml(store, storeBranches.length, 'store-slider-card');
      });
    }
    html += `</div></div>`;

    // ===== منتجات مقترحة =====
    html += `
      <div class="section-header-row home-products-head">
        <div>
          <span class="section-kicker">اختيارات وفرة</span>
          <h2 class="section-title">🛒 منتجات مقترحة لك</h2>
        </div>
        <button type="button" id="view-all-products-btn" class="btn-text-link">عرض المزيد <span aria-hidden="true">←</span></button>
      </div>
      <div class="products-grid" id="home-products-grid">
    `;

    let displayedProductsCount = 0;
    data.products.forEach(product => {
      if (product.homeSuggested === true) {
        product.variants.forEach(variant => {
          if (displayedProductsCount < 8) {
            const validPrices = [];
            validBranches.forEach(branch => {
              const priceItem = getVariantPriceForBranch(variant.variantId, branch.branchId);
              if (priceItem) {
                if (!validPrices.some(p => p.pricePiastres === priceItem.pricePiastres && p.branchId === branch.branchId)) {
                  validPrices.push({ ...priceItem, branchId: branch.branchId });
                }
              }
            });

            if (validPrices.length > 0) {
              sortPricesByFreshness(validPrices);
              const bestPrice = validPrices[0];
              const branch = getSelectedCityBranch(bestPrice.branchId);
              const store = data.stores.find(s => s.storeId === branch?.storeId);
              displayedProductsCount++;
              html += buildProductCardHtml(product, variant, bestPrice, store);
            }
          }
        });
      }
    });

    if (displayedProductsCount === 0) {
      html += buildEmptyStateHtml('🛒', 'لا توجد منتجات مقترحة', 'لا توجد منتجات مقترحة محددة للشاشة الرئيسية حالياً.');
    }

    html += `</div>`;
    dynamicContentArea.innerHTML = html;

    // ===== تفعيل سلايدر الإعلانات =====
    const wrapper = document.getElementById('hero-ads-wrapper');
    if (wrapper) {
      const slides = wrapper.querySelectorAll('.hero-ad-card');
      const dots = wrapper.querySelectorAll('.hero-dot');
      let currentSlideIndex = 0;

      const showSlide = (index) => {
        currentSlideIndex = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          slide.classList.toggle('active', i === currentSlideIndex);
          slide.setAttribute('aria-hidden', i === currentSlideIndex ? 'false' : 'true');
        });
        dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlideIndex));
      };
      const nextSlide = () => showSlide(currentSlideIndex + 1);
      const prevSlide = () => showSlide(currentSlideIndex - 1);

      if (slides.length > 1) {
        heroAdsInterval = setInterval(nextSlide, 5000);
        const resetInterval = () => {
          clearInterval(heroAdsInterval);
          heroAdsInterval = setInterval(nextSlide, 5000);
        };

        const prevBtn = wrapper.querySelector('.hero-prev-btn');
        const nextBtn = wrapper.querySelector('.hero-next-btn');
        if (prevBtn) {
          prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            prevSlide();
            resetInterval();
          });
        }
        if (nextBtn) {
          nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nextSlide();
            resetInterval();
          });
        }

        dots.forEach(dot => {
          dot.addEventListener('click', (e) => {
            e.stopPropagation();
            showSlide(Number(dot.getAttribute('data-slide-to')));
            resetInterval();
          });
        });

        let touchStartX = 0;
        wrapper.addEventListener('touchstart', (e) => {
          touchStartX = e.changedTouches[0].clientX;
        }, { passive: true });
        wrapper.addEventListener('touchend', (e) => {
          const diff = e.changedTouches[0].clientX - touchStartX;
          if (Math.abs(diff) > 45) {
            if (diff > 0) prevSlide();
            else nextSlide();
            resetInterval();
          }
        }, { passive: true });
      }
    }

    // ===== المستمعون =====
    document.querySelectorAll('.store-slider-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedStoreId = card.getAttribute('data-store-id');
        currentTab = 'store-products';
        renderApp();
      });
    });

    const viewStoresBtn = document.getElementById('view-all-stores-btn');
    if (viewStoresBtn) {
      viewStoresBtn.addEventListener('click', () => {
        currentTab = 'all-stores';
        setActiveNav(navStoresBtn);
        renderApp();
      });
    }

    const viewProductsBtn = document.getElementById('view-all-products-btn');
    if (viewProductsBtn) {
      viewProductsBtn.addEventListener('click', () => {
        currentTab = 'all-products';
        renderApp();
      });
    }

    document.querySelectorAll('.view-all-offers-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = 'offers';
        setActiveNav(navOffersBtn);
        renderApp();
      });
    });

    const viewAllCategoriesBtn = document.getElementById('view-all-categories-btn');
    if (viewAllCategoriesBtn) {
      viewAllCategoriesBtn.addEventListener('click', () => {
        currentTab = 'all-products';
        setActiveNav(null);
        renderApp();
      });
    }

    attachCategoryChipListeners();

    const homeLocationPill = document.getElementById('home-location-pill');
    if (homeLocationPill && openLocationModalBtn) {
      homeLocationPill.addEventListener('click', () => openLocationModalBtn.click());
    }

    const fallbackOffersBtn = document.getElementById('fallback-offers-btn');
    if (fallbackOffersBtn) {
      fallbackOffersBtn.addEventListener('click', () => {
        currentTab = 'offers';
        setActiveNav(navOffersBtn);
        renderApp();
      });
    }

    attachProductClickListeners('home');
    attachStoreOfferListeners();
    attachAdInteractions();
  }

  function renderAllStores() {
    searchSectionWrapper.style.display = 'flex';

    const validBranches = getSelectedCityBranches();
    const availableDepartmentIds = new Set(getAvailableDepartments().map(department => department.departmentId));

    const activeStoreIds = [...new Set(validBranches.map(b => b.storeId))];
    let storesToDisplay = data.stores.filter(s => activeStoreIds.includes(s.storeId));

    if (currentSearchQuery.trim()) {
      const q = normalizeArabic(currentSearchQuery.toLowerCase().trim());
      storesToDisplay = storesToDisplay.filter(s => normalizeArabic(s.storeNameAr).includes(q));
    }

    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';

    if (storesToDisplay.length === 0) {
      dynamicContentArea.innerHTML = buildPageHeading(
        'دليل المتاجر',
        'المتاجر حسب التصنيفات',
        `تصفح المتاجر المتاحة ${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'}.`,
        '0 متجر'
      ) + buildEmptyStateHtml('🏬', 'لا توجد متاجر متاحة', 'لا توجد متاجر في هذا النطاق أو مطابقة للبحث.');
      return;
    }

    let html = buildPageHeading(
      'دليل المتاجر',
      'المتاجر حسب التصنيفات',
      `تصفح ${storesToDisplay.length} متجراً متاحاً ${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'}، مرتبة حسب الفئة.`,
      `${storesToDisplay.length} متجر`
    );

    data.categories
      .filter(category => availableDepartmentIds.has(category.departmentId))
      .forEach(category => {
      const allCategoryStores = storesToDisplay.filter(s => s.categoryId === category.categoryId);

      if (allCategoryStores.length > 0) {
        let featuredStores = allCategoryStores.filter(s => s.featuredInCat === true);
        if (featuredStores.length === 0) {
          featuredStores = allCategoryStores.slice(0, 5);
        }

        const displayStores = featuredStores.slice(0, 5);
        const hasMore = allCategoryStores.length > displayStores.length;

        html += `
          <section class="category-row-section">
            <div class="section-header-row">
              <div class="category-title-wrap">
                <span class="category-title-icon">${getCategoryIcon(category.categoryId)}</span>
                <div>
                  <span class="section-kicker">${allCategoryStores.length} متجر</span>
                  <h3 class="section-title">${category.categoryNameAr}</h3>
                </div>
              </div>
              ${hasMore ? `<button type="button" class="btn-text-link view-more-category-btn" data-category-id="${category.categoryId}">عرض المزيد (${allCategoryStores.length}) <span aria-hidden="true">←</span></button>` : ''}
            </div>
            <div class="category-row-container">
        `;

        displayStores.forEach(store => {
          const storeBranches = validBranches.filter(b => b.storeId === store.storeId);
          html += buildStoreCardHtml(store, storeBranches.length, 'category-row-card', {
            showArrow: false,
            linkLabel: 'تصفح المنتجات'
          });
        });

        html += `</div></section>`;
      }
    });

    dynamicContentArea.innerHTML = html;

    document.querySelectorAll('.store-card-click').forEach(card => {
      card.addEventListener('click', () => {
        selectedStoreId = card.getAttribute('data-store-id');
        currentTab = 'store-products';
        renderApp();
      });
    });

    document.querySelectorAll('.view-more-category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedCategoryIdForStores = btn.getAttribute('data-category-id');
        currentTab = 'category-stores';
        setActiveNav(navStoresBtn);
        renderApp();
      });
    });
  }

  function renderStoreProducts() {
    const store = data.stores.find(s => s.storeId === selectedStoreId);
    storeHeaderBar.style.display = 'flex';
    selectedStoreTitle.textContent = store ? store.storeNameAr : '';

    const storeBranches = data.branches.filter(b => b.storeId === selectedStoreId);
    const cityBranches = getSelectedCityBranches(storeBranches);
    const filteredProducts = searchProducts(data.products, currentSearchQuery);
    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';

    let html = '';
    if (store) {
      html += `
        <div class="store-page-hero">
          ${getStoreLogoHtml(store, 'store-page-logo')}
          <div class="store-page-copy">
            <span class="page-kicker">صفحة المتجر</span>
            <h1 class="page-title">${store.storeNameAr}</h1>
            <p class="page-subtitle">${cityBranches.length} فرع متاح ${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'} • أسعار محدثة داخل مدينتك فقط.</p>
          </div>
        </div>
      `;
    }

    let gridHtml = `<div class="products-grid">`;
    let productCount = 0;

    filteredProducts.forEach(product => {
      product.variants.forEach(variant => {
        const variantPrices = [];
        cityBranches.forEach(branch => {
          const priceItem = getVariantPriceForBranch(variant.variantId, branch.branchId);
          if (priceItem) {
            if (!variantPrices.some(p => p.pricePiastres === priceItem.pricePiastres && p.branchId === branch.branchId)) {
              variantPrices.push({ ...priceItem, branchId: branch.branchId });
            }
          }
        });

        if (variantPrices.length > 0) {
          sortPricesByFreshness(variantPrices);
          const bestPrice = variantPrices[0];
          const branch = getSelectedCityBranch(bestPrice.branchId);
          const cardStore = data.stores.find(s => s.storeId === branch?.storeId);
          productCount++;
          gridHtml += buildProductCardHtml(product, variant, bestPrice, cardStore);
        }
      });
    });

    if (productCount === 0) {
      gridHtml = buildEmptyStateHtml('🛒', 'لا توجد منتجات مسجلة', 'لا توجد منتجات وأسعار مسجلة لهذا المتجر داخل نطاقك حالياً.');
    } else {
      gridHtml += `</div>`;
    }

    dynamicContentArea.innerHTML = html + gridHtml;
    attachProductClickListeners('store-products');
  }

  function renderCategoryProducts() {
    const category = data.categories.find(c => c.categoryId === selectedCategoryId);
    const categoryProducts = data.products.filter(p => p.categoryId === selectedCategoryId);
    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';

    const validBranches = getSelectedCityBranches();

    let html = buildPageHeading(
      'تصفح الفئة',
      `${getCategoryIcon(selectedCategoryId)} ${category ? category.categoryNameAr : ''}`,
      `منتجات وأسعار ${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'}، مع إمكانية مقارنة الأسعار بين المتاجر.`,
      `${categoryProducts.length} منتج`
    );

    let gridHtml = `<div class="products-grid">`;
    let productCount = 0;

    categoryProducts.forEach(product => {
      product.variants.forEach(variant => {
        const validPrices = [];
        validBranches.forEach(branch => {
          const priceItem = getVariantPriceForBranch(variant.variantId, branch.branchId);
          if (priceItem) {
            if (!validPrices.some(p => p.pricePiastres === priceItem.pricePiastres && p.branchId === branch.branchId)) {
              validPrices.push({ ...priceItem, branchId: branch.branchId });
            }
          }
        });

        if (validPrices.length > 0) {
          sortPricesByFreshness(validPrices);
          const bestPrice = validPrices[0];
          const branch = getSelectedCityBranch(bestPrice.branchId);
          const store = data.stores.find(s => s.storeId === branch?.storeId);
          productCount++;
          gridHtml += buildProductCardHtml(product, variant, bestPrice, store);
        }
      });
    });

    if (productCount === 0) {
      gridHtml = buildEmptyStateHtml('🛒', 'لا توجد منتجات متاحة', 'لا توجد منتجات متاحة لهذه الفئة في نطاقك الحالي.');
    } else {
      gridHtml += `</div>`;
    }

    dynamicContentArea.innerHTML = html + gridHtml;
    const countPill = dynamicContentArea.querySelector('.page-count-pill');
    if (countPill) countPill.textContent = `${productCount} منتج`;
    attachProductClickListeners('category-products');
  }

  function renderDepartmentProducts() {
    const department = getDepartmentById(selectedDepartmentId);
    const departmentCategoryIds = getDepartmentCategoryIds(selectedDepartmentId);
    const departmentProducts = data.products.filter(product => departmentCategoryIds.has(product.categoryId));
    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';
    const validBranches = getSelectedCityBranches();

    let html = buildPageHeading(
      'تصفح القسم',
      `${getDepartmentIcon(department)} ${department ? department.departmentNameAr : ''}`,
      `منتجات وأسعار هذا القسم ${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'}، مع إمكانية مقارنة الأسعار بين المتاجر.`,
      `${departmentProducts.length} منتج`
    );

    const availableCategoryIds = getAvailableCategoryIdsForDepartment(selectedDepartmentId);
    const availableCategories = data.categories.filter(category =>
      category.departmentId === selectedDepartmentId &&
      availableCategoryIds.has(category.categoryId)
    );

    if (availableCategories.length > 1) {
      html += `<div class="category-chips-row department-subcategory-row">`;
      availableCategories.forEach(category => {
        html += `
          <button type="button" class="category-chip" data-category-id="${category.categoryId}">
            <span class="category-chip-icon">${getCategoryIcon(category.categoryId)}</span>
            <span>${category.categoryNameAr}</span>
          </button>
        `;
      });
      html += `</div>`;
    }

    let gridHtml = `<div class="products-grid">`;
    let productCount = 0;

    departmentProducts.forEach(product => {
      (product.variants || []).forEach(variant => {
        const validPrices = [];
        validBranches.forEach(branch => {
          const priceItem = getVariantPriceForBranch(variant.variantId, branch.branchId);
          if (priceItem) {
            if (!validPrices.some(price => price.pricePiastres === priceItem.pricePiastres && price.branchId === branch.branchId)) {
              validPrices.push({ ...priceItem, branchId: branch.branchId });
            }
          }
        });

        if (validPrices.length > 0) {
          sortPricesByFreshness(validPrices);
          const bestPrice = validPrices[0];
          const branch = getSelectedCityBranch(bestPrice.branchId);
          const store = data.stores.find(candidate => candidate.storeId === branch?.storeId);
          productCount++;
          gridHtml += buildProductCardHtml(product, variant, bestPrice, store);
        }
      });
    });

    if (productCount === 0) {
      const departmentStores = data.stores.filter(store =>
        validBranches.some(branch => branch.storeId === store.storeId) &&
        getStoreDepartmentIds(store).includes(selectedDepartmentId)
      );

      let emptyHtml = buildEmptyStateHtml(
        getDepartmentIcon(department),
        'لا توجد منتجات مسجّلة في هذا القسم',
        'القسم متاح في مدينتك، لكن لم تُضف منتجات وأسعار له بعد.'
      );

      if (departmentStores.length > 0) {
        emptyHtml += `
          <div class="section-header-row department-stores-head">
            <div>
              <span class="section-kicker">${departmentStores.length} متجر</span>
              <h2 class="section-title">متاجر هذا القسم</h2>
            </div>
          </div>
          <div class="category-stores-grid">
        `;
        departmentStores.forEach(store => {
          const storeBranches = validBranches.filter(branch => branch.storeId === store.storeId);
          emptyHtml += buildStoreCardHtml(store, storeBranches.length, 'compact-store-card', {
            showArrow: false,
            linkLabel: 'تصفح المنتجات'
          });
        });
        emptyHtml += `</div>`;
      }

      gridHtml = emptyHtml;
    } else {
      gridHtml += `</div>`;
    }

    dynamicContentArea.innerHTML = html + gridHtml;
    const countPill = dynamicContentArea.querySelector('.page-count-pill');
    if (countPill) countPill.textContent = `${productCount} منتج`;

    document.querySelectorAll('.store-card-click').forEach(card => {
      card.addEventListener('click', () => {
        selectedStoreId = card.getAttribute('data-store-id');
        currentTab = 'store-products';
        renderApp();
      });
    });

    attachProductClickListeners('department-products');
    attachCategoryChipListeners();
  }

  function getProductFamilyKey(product) {
    const normalizedName = (product.productNameAr || '').replace(/\s+/g, ' ').trim();
    return `${product.categoryId || ''}::${normalizedName}`;
  }

  function renderProductComparison() {
    productComparisonHeader.style.display = 'flex';
    searchSectionWrapper.style.display = 'none';

    // 1. جلب المنتج والنوع المحدد من قِبل المستخدم
    const currentVariant = data.products.flatMap(p => p.variants).find(v => v.variantId === selectedVariantIdForComparison);
    const currentProduct = data.products.find(p => p.variants.some(v => v.variantId === selectedVariantIdForComparison));

    if (!currentProduct || !currentVariant) {
      dynamicContentArea.innerHTML = buildEmptyStateHtml('🔍', 'المنتج غير موجود', 'تعذر العثور على المنتج المطلوب. جرّب البحث مرة أخرى.');
      return;
    }

    // 2. تحديد الـ Variants المطلوبة بناءً على وضع المقارنة الحالية
    let targetVariantIds = [];

    if (comparisonMode === 'brand') {
      targetVariantIds = currentProduct.variants.map(v => v.variantId);
      comparisonProductTitle.textContent = `مقارنة أسعار: ${currentProduct.productNameAr} (${currentProduct.brandAr || ''})`;
    } else {
      const familyKey = getProductFamilyKey(currentProduct);
      const relatedProducts = data.products.filter(p => getProductFamilyKey(p) === familyKey);
      targetVariantIds = relatedProducts.flatMap(p => p.variants.map(v => v.variantId));
      comparisonProductTitle.textContent = `مقارنة أسعار شاملة: ${currentProduct.productNameAr} (جميع الماركات)`;
    }

    // 3. جلب الفروع المتاحة في موقع المستخدم الجغرافي
    const validBranches = getSelectedCityBranches();

    // 4. تجميع الأسعار السارية للفروع المتاحة
    const validPrices = [];
    validBranches.forEach(branch => {
      targetVariantIds.forEach(vId => {
        const priceItem = getVariantPriceForBranch(vId, branch.branchId);
        if (priceItem) {
          if (!validPrices.some(p => p.pricePiastres === priceItem.pricePiastres && p.branchId === branch.branchId && p.variantId === vId)) {
            validPrices.push({ ...priceItem, branchId: branch.branchId, variantId: vId });
          }
        }
      });
    });

    sortPricesByFreshness(validPrices);

    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';
    const bestPrice = validPrices[0];
    const bestBranch = bestPrice ? getSelectedCityBranch(bestPrice.branchId) : null;
    const bestStore = bestBranch ? data.stores.find(s => s.storeId === bestBranch.storeId) : null;

    let html = '';

    // 5. ملخص المقارنة
    if (validPrices.length > 0) {
      html += `
        <div class="comparison-summary">
          <div class="comparison-summary-media">
            ${currentProduct.imageUrl ? `<img src="${currentProduct.imageUrl}" alt="${currentProduct.productNameAr}" loading="lazy">` : '<span class="image-placeholder">📷</span>'}
          </div>
          <div class="comparison-summary-copy">
            <span class="page-kicker">مقارنة الأسعار</span>
            <h1 class="comparison-summary-title">${currentProduct.productNameAr}</h1>
            <p class="comparison-summary-meta">${currentProduct.brandAr || ''} • ${currentVariant.packageSize} ${currentVariant.unit}</p>
            <div class="comparison-summary-chips">
              <span>${validPrices.length} عرض سعر</span>
              <span>${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'}</span>
            </div>
          </div>
          <div class="comparison-summary-best">
            <span>أفضل سعر</span>
            <strong>${formatPiastres(bestPrice.pricePiastres)}</strong>
            <small>${bestStore?.storeNameAr || ''}</small>
          </div>
        </div>
      `;
    }

    // 6. شريط الأدوات
    html += `
      <div class="comparison-toolbar">
        <div>
          <span class="section-kicker">${comparisonMode === 'brand' ? 'نفس الماركة' : 'جميع الماركات'}</span>
          <h2 class="section-title">أسعار المنتج في المتاجر</h2>
        </div>
        ${comparisonMode === 'brand' ? `
          <button type="button" id="toggle-comparison-mode-btn" class="btn-primary comparison-toggle-btn">🔄 قارن مع ماركات أخرى</button>
        ` : `
          <button type="button" id="toggle-comparison-mode-btn" class="btn-secondary comparison-toggle-btn">⬅️ العودة لماركة ${currentProduct.brandAr || ''}</button>
        `}
      </div>
      <div class="comparison-note">💡 يتم إعطاء الأولوية للأسعار الحديثة خلال 30 يوماً، وتظهر الأسعار الأقدم للمرجعية فقط.</div>
    `;

    // 7. صفوف المقارنة
    let rowsHtml = '';
    const now = new Date();
    validPrices.forEach((priceItem, index) => {
      const branch = getSelectedCityBranch(priceItem.branchId);
      const store = data.stores.find(s => s.storeId === branch?.storeId);
      const variantObj = data.products.flatMap(p => p.variants).find(v => v.variantId === priceItem.variantId);
      const prodObj = data.products.find(p => p.variants.some(v => v.variantId === priceItem.variantId));
      const obsDateStr = priceItem.observationDate;
      const freshness = calculateFreshness(obsDateStr);
      const priceDiffDays = Math.floor((now - new Date(obsDateStr)) / (1000 * 60 * 60 * 24));
      const isLowest = index === 0 && priceDiffDays <= 30;

      rowsHtml += `
        <article class="price-comparison-row${isLowest ? ' best-price-row' : ''}">
          <div class="comparison-store">
            ${getStoreLogoHtml(store, 'comparison-store-logo')}
            <div class="store-info-side">
              <h4>${store?.storeNameAr || ''}</h4>
              <p class="comparison-product-meta">${prodObj?.productNameAr || ''} <span>(${prodObj?.brandAr || ''} • ${variantObj?.packageSize || ''} ${variantObj?.unit || ''})</span></p>
              <div class="comparison-badges">
                <span class="badge ${freshness.class}">${freshness.label}</span>
                ${isLowest ? '<span class="badge best-badge">🔥 أرخص سعر</span>' : ''}
              </div>
            </div>
          </div>
          <div class="price-info-side">
            ${isLowest ? '<span class="best-price-label">أفضل اختيار</span>' : ''}
            <div class="price-tag">${formatPiastres(priceItem.pricePiastres)}</div>
            ${getPriceExtraHtml(priceItem)}
            <p class="comparison-date">📅 ${obsDateStr}</p>
          </div>
        </article>
      `;
    });

    if (validPrices.length === 0) {
      html += buildEmptyStateHtml('🔍', 'لا توجد أسعار متاحة', 'لا توجد أسعار مسجلة لهذا المنتج داخل نطاقك الحالي.');
    } else {
      html += `<div class="comparison-container">${rowsHtml}</div>`;
    }

    dynamicContentArea.innerHTML = html;

    const toggleBtn = document.getElementById('toggle-comparison-mode-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        comparisonMode = (comparisonMode === 'brand') ? 'all' : 'brand';
        renderProductComparison();
      });
    }
  }

  function renderCategoryStores() {
    searchSectionWrapper.style.display = 'flex';
    const category = data.categories.find(c => c.categoryId === selectedCategoryIdForStores);

    const validBranches = getSelectedCityBranches();

    const activeStoreIds = [...new Set(validBranches.map(b => b.storeId))];
    const categoryStores = data.stores.filter(s => s.categoryId === selectedCategoryIdForStores && activeStoreIds.includes(s.storeId));
    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';

    let html = buildPageHeading(
      'فئة المتاجر',
      `${getCategoryIcon(selectedCategoryIdForStores)} ${category ? category.categoryNameAr : ''}`,
      `كل المتاجر المتاحة في هذه الفئة ${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'}.`,
      `${categoryStores.length} متجر`
    );

    html += `
      <div class="page-actions">
        <button type="button" id="back-to-stores-main" class="btn-secondary">⬅️ العودة لكل المتاجر</button>
      </div>
    `;

    if (categoryStores.length === 0) {
      html += buildEmptyStateHtml('🏬', 'لا توجد متاجر متاحة', 'لا توجد متاجر مسجلة لهذه الفئة في نطاقك الجغرافي حالياً.');
    } else {
      html += `<div class="category-stores-grid">`;
      categoryStores.forEach(store => {
        const storeBranches = validBranches.filter(b => b.storeId === store.storeId);
        html += buildStoreCardHtml(store, storeBranches.length, 'compact-store-card', {
          showArrow: false,
          linkLabel: 'تصفح المنتجات'
        });
      });
      html += `</div>`;
    }

    dynamicContentArea.innerHTML = html;

    const backBtn = document.getElementById('back-to-stores-main');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        currentTab = 'all-stores';
        setActiveNav(navStoresBtn);
        renderApp();
      });
    }

    document.querySelectorAll('.store-card-click').forEach(card => {
      card.addEventListener('click', () => {
        selectedStoreId = card.getAttribute('data-store-id');
        currentTab = 'store-products';
        renderApp();
      });
    });
  }

  function renderOffers() {
    searchSectionWrapper.style.display = 'flex';
    const today = getTodayDateStr();
    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';

    // هذا التبويب مخصص للباكدجات وعروض القيمة المضافة فقط.
    // أسعار القطعة المفردة (العادية أو المخفضة أسبوعياً) تُعرض في المقارنة من prices.json.
    const activeOffers = (data.offers || []).filter(o =>
      isOfferActive(o, today) && doesOfferMatchLocation(o)
    );

    const offerCards = activeOffers
      .map(offer => buildOfferCardHtml(offer, { sponsored: offer.sponsored === true }))
      .filter(Boolean);

    let html = buildPageHeading(
      'وفّر أكثر',
      '🔥 عروض وباكدجات وقيمة مضافة',
      `باكدجات وشروط كمية وعروض قيمة مضافة ${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'}. اضغط على عرض المنتج لمقارنة سعر القطعة، أو على عرض المتجر لتصفح منتجاته.`,
      `${offerCards.length} عرض`
    );

    const offersAds = getValidAdsForPlacement('offers_top');
    if (offersAds.length > 0) {
      html += `<div class="offers-ad-slot">`;
      offersAds.forEach(ad => {
        html += buildNativeAdHtml(ad);
        trackAdImpression(ad.adId);
      });
      html += `</div>`;
    }

    if (offerCards.length === 0) {
      html += buildEmptyStateHtml('🏷️', 'لا تتوفر عروض حالياً', 'لا توجد عروض في نطاقك الجغرافي الآن. تصفح أسعار القطعة المفردة من تبويب المتاجر أو البحث.');
    } else {
      html += `<div class="products-grid offers-grid">${offerCards.join('')}</div>`;
    }

    dynamicContentArea.innerHTML = html;
    attachProductClickListeners('offers');
    attachStoreOfferListeners();
    attachAdInteractions();
  }

  function renderAllProducts() {
    searchSectionWrapper.style.display = 'flex';
    const filteredProducts = searchProducts(data.products, currentSearchQuery);
    const cityName = currentLocation.cityId ? getCityNameAr(currentLocation.cityId) : '';

    const validBranches = getSelectedCityBranches();

    let html = buildPageHeading(
      currentSearchQuery.trim() ? 'نتائج البحث' : 'كل المنتجات',
      currentSearchQuery.trim() ? `🔍 نتائج البحث عن: ${currentSearchQuery.trim()}` : '🛒 جميع المنتجات والأسعار',
      `أفضل الأسعار المتاحة ${cityName ? `داخل ${cityName}` : 'بعد اختيار موقعك'}، مع إمكانية فتح مقارنة كل منتج.`,
      `${filteredProducts.length} منتج`
    );

    let gridHtml = `<div class="products-grid">`;
    let productCount = 0;

    filteredProducts.forEach(product => {
      product.variants.forEach(variant => {
        const validPrices = [];
        validBranches.forEach(branch => {
          const priceItem = getVariantPriceForBranch(variant.variantId, branch.branchId);
          if (priceItem) {
            if (!validPrices.some(p => p.pricePiastres === priceItem.pricePiastres && p.branchId === branch.branchId)) {
              validPrices.push({ ...priceItem, branchId: branch.branchId });
            }
          }
        });

        if (validPrices.length > 0) {
          sortPricesByFreshness(validPrices);
          const bestPrice = validPrices[0];
          const branch = getSelectedCityBranch(bestPrice.branchId);
          const store = data.stores.find(s => s.storeId === branch?.storeId);
          productCount++;
          gridHtml += buildProductCardHtml(product, variant, bestPrice, store);
        }
      });
    });

    if (productCount === 0) {
      gridHtml = buildEmptyStateHtml('🛒', 'لا توجد منتجات مطابقة', 'لا توجد منتجات مطابقة للبحث داخل النطاق الجغرافي الحالي.');
    } else {
      gridHtml += `</div>`;
    }

    dynamicContentArea.innerHTML = html + gridHtml;
    const countPill = dynamicContentArea.querySelector('.page-count-pill');
    if (countPill) countPill.textContent = `${productCount} منتج`;
    attachProductClickListeners('all-products');
  }

  function attachCategoryChipListeners() {
    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const departmentId = chip.getAttribute('data-department-id');
        const categoryId = chip.getAttribute('data-category-id');

        if (departmentId) {
          selectedDepartmentId = departmentId;
          selectedCategoryId = null;
          currentTab = 'department-products';
          setActiveNav(categoryBtn);
        } else if (categoryId) {
          selectedCategoryId = categoryId;
          selectedDepartmentId = null;
          currentTab = 'category-products';
          setActiveNav(categoryBtn);
        } else {
          selectedCategoryId = null;
          selectedDepartmentId = null;
          currentTab = 'all-products';
          setActiveNav(null);
        }
        renderApp();
      });
    });
  }

  function attachProductClickListeners(fromTabName) {
    document.querySelectorAll('.product-card-clickable').forEach(card => {
      const openComparison = () => {
        const variantId = card.getAttribute('data-variant-id');
        if (variantId) {
          selectedVariantIdForComparison = variantId;
          comparisonMode = 'brand'; // 🌟 إعادة تعيين وضع المقارنة للماركة فقط تلقائياً
          previousTabBeforeComparison = fromTabName;
          currentTab = 'product-comparison';
          renderApp();
        }
      };
      card.addEventListener('click', openComparison);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openComparison();
        }
      });
    });
  }

  // بطاقات عروض المتاجر (بدون منتج محدد) تفتح صفحة منتجات المتجر
  function attachStoreOfferListeners() {
    document.querySelectorAll('.store-offer-card').forEach(card => {
      const openStore = () => {
        const storeId = card.getAttribute('data-store-id');
        if (storeId) {
          selectedStoreId = storeId;
          currentTab = 'store-products';
          setActiveNav(navStoresBtn);
          renderApp();
        }
      };
      card.addEventListener('click', openStore);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openStore();
        }
      });
    });
  }

  const countryBtn = document.getElementById('country-dropdown-btn');
  const countryMenu = document.getElementById('country-dropdown-menu');

  if (countryBtn && countryMenu) {
    countryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      countryMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      countryMenu.classList.remove('show');
    });
  }

  renderApp();
});

window.addEventListener('load', () => {
  const loader = document.getElementById('app-loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.style.display = 'none';
      }, 400); 
    }, 2000);
  }
});

// 🌟 دوال مساعدة لنموذج العروض الجديد (باكدجات وقيمة مضافة)
function getOfferBranchIds(offer) {
  if (Array.isArray(offer.branchIds) && offer.branchIds.length > 0) {
    return offer.branchIds;
  }
  if (offer.branchId) {
    return [offer.branchId];
  }
  return [];
}

function getOfferQuantity(offer) {
  const qty = Number(offer.bundleQuantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function getOfferTotalPiastres(offer) {
  const total = Number(offer.bundlePricePiastres);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function getOfferUnitPricePiastres(offer) {
  const total = getOfferTotalPiastres(offer);
  return total === null ? null : total / getOfferQuantity(offer);
}

// تاريخ اليوم بالتوقيت المحلي للجهاز (وليس UTC) حتى لا تختفي عروض اليوم مبكراً
function getTodayDateStr() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isOfferActive(offer, todayStr) {
  if (!offer || !offer.startDate || !offer.endDate) return false;
  return offer.startDate <= todayStr && offer.endDate >= todayStr;
}

// إظهار السعر القديم وشارة "سعر عرض أسبوعي" عند وجودها في prices.json
function getPriceExtraHtml(priceItem) {
  if (!priceItem) return '';
  let html = '';

  const regular = Number(priceItem.regularPricePiastres);
  if (Number.isFinite(regular) && regular > priceItem.pricePiastres) {
    html += `<span class="old-price">بدلاً من ${formatPiastres(regular)}</span>`;
  }

  if (priceItem.priceType === 'weekly_offer') {
    html += `<span class="badge badge-promo">🔥 سعر عرض أسبوعي</span>`;
  }

  return html;
}

// 🌟 دالة مساعدة لصياغة نص مدة العرض لغوياً بشكل دقيق
function getOfferDurationText(endDateStr) {
  const today = new Date();
  const endDate = new Date(endDateStr);
  const diffTime = endDate - today;
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft <= 1) {
    return "⏰ ينتهي اليوم";
  } else if (daysLeft === 2) {
    return "⏰ ينتهي خلال يومين";
  } else if (daysLeft > 2 && daysLeft < 11) {
    return `⏰ باقي ${daysLeft} أيام وينتهي العرض`;
  } else {
    return `⏰ باقي ${daysLeft} يوم وينتهي العرض`;
  }
}

// 🌟 دالة ترتيب الأسعار المحدثة لتقرأ حقل observationDate الموحد حصرياً
function sortPricesByFreshness(prices) {
  const now = new Date();
  prices.sort((a, b) => {
    const aDate = new Date(a.observationDate);
    const bDate = new Date(b.observationDate);

    const aDiff = Math.floor((now - aDate) / (1000 * 60 * 60 * 24));
    const bDiff = Math.floor((now - bDate) / (1000 * 60 * 60 * 24));

    const aIsFresh = aDiff <= 30;
    const bIsFresh = bDiff <= 30;

    if (aIsFresh && !bIsFresh) return -1;
    if (!aIsFresh && bIsFresh) return 1;

    return a.pricePiastres - b.pricePiastres;
  });
  return prices;
}