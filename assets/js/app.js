document.addEventListener('DOMContentLoaded', async () => {
  const data = await loadWafraData();
  if (!data) return;

  // App States
  let currentTab = 'home'; // 'home' | 'all-stores' | 'store-products' | 'category-products' | 'product-comparison' | 'offers' | 'all-products'
  let selectedStoreId = null;
  let heroAdsInterval = null; 
  let selectedCategoryId = null;
  let selectedVariantIdForComparison = null;
  let previousTabBeforeComparison = 'home';
  let currentLocation = { governorateId: '', cityId: '' };
  let currentSearchQuery = '';
  let selectedCategoryIdForStores = null;
  

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
      const locationText = `${govObj.governorateNameAr} - ${cityObj.cityNameAr}`;
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

  if (savedLocationJson && savedLocationText) {
    try {
      currentLocation = JSON.parse(savedLocationJson);
      if (currentLocationLabel) {
        currentLocationLabel.textContent = savedLocationText;
      }
    } catch (e) {
      console.error("Error parsing saved location", e);
    }
  } else {
    setTimeout(() => {
      populateModalGovs();
      if (locationModal) locationModal.classList.add('show');
    }, 400);
  }

  function populateCategoriesMenu() {
    if (!categoryMenu) return;
    categoryMenu.innerHTML = '';
    data.categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = cat.categoryNameAr;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedCategoryId = cat.categoryId;
        currentTab = 'category-products';
        setActiveNav(null);
        categoryMenu.classList.remove('show');
        renderApp();
      });
      categoryMenu.appendChild(item);
    });
  }
  populateCategoriesMenu();

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
      setActiveNav(navHomeBtn);
      renderApp();
    });
  }

  if (navStoresBtn) {
    navStoresBtn.addEventListener('click', () => {
      currentTab = 'all-stores';
      selectedStoreId = null;
      selectedCategoryId = null;
      setActiveNav(navStoresBtn);
      renderApp();
    });
  }

  if (navOffersBtn) {
    navOffersBtn.addEventListener('click', () => {
      currentTab = 'offers';
      selectedStoreId = null;
      selectedCategoryId = null;
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
    [navHomeBtn, navStoresBtn, navOffersBtn].forEach(b => {
      if (b) b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
  }

  function renderApp() {
    if (currentTab !== 'home' && heroAdsInterval) {
      clearInterval(heroAdsInterval);
      heroAdsInterval = null;
    }

    if (storeHeaderBar) storeHeaderBar.style.display = 'none';
    if (productComparisonHeader) productComparisonHeader.style.display = 'none';
    if (searchSectionWrapper) searchSectionWrapper.style.display = 'flex';
    if (searchSuggestions) searchSuggestions.classList.remove('show');

    if (currentTab === 'home') {
      renderHomePage();
    } else if (currentTab === 'all-stores') {
      renderAllStores();
    } else if (currentTab === 'category-stores') { // 🌟 أضف هذا السطر
      renderCategoryStores();
    } else if (currentTab === 'store-products') {
      renderStoreProducts();
    } else if (currentTab === 'category-products') {
      renderCategoryProducts();
    } else if (currentTab === 'product-comparison') {
      renderProductComparison();
    } else if (currentTab === 'offers') {
      renderOffers();
    } else if (currentTab === 'all-products') {
      renderAllProducts();
    }
  }

  function renderHomePage() {
    let html = '';
    const today = new Date().toISOString().split('T')[0];

    if (heroAdsInterval) {
      clearInterval(heroAdsInterval);
      heroAdsInterval = null;
    }

    // 🌟 نظام الفلترة الهرمي للإعلانات (عام -> منطقة -> محافظة)
    const validAds = data.ads ? data.ads.filter(ad => {
  if (ad.scope === 'all') return true;
  if (ad.cityId) {
    return currentLocation.cityId && ad.cityId === currentLocation.cityId;
  }
  if (ad.governorateId) {
    return currentLocation.governorateId && ad.governorateId === currentLocation.governorateId;
  }
  return false;
}) : [];

    if (validAds.length > 0) {
      html += `<div class="hero-ads-wrapper">`;

      if (validAds.length > 1) {
        html += `
          <button class="hero-slider-btn hero-prev-btn" aria-label="السابق">❮</button>
          <button class="hero-slider-btn hero-next-btn" aria-label="التالي">❯</button>
        `;
      }

      validAds.forEach((ad, index) => {
        const activeClass = index === 0 ? 'active' : '';
        html += `
          <div class="hero-ad-card ${activeClass}" data-index="${index}">
            <img src="${ad.imageUrl}" alt="${ad.titleAr}" class="hero-ad-image" loading="lazy">
            <div class="hero-ad-content">
              <h3 class="hero-ad-title">${ad.titleAr}</h3>
        `;

        if (ad.targetType === 'store') {
          html += `<button class="hero-slider-cta ad-store-link-btn hero-ad-cta" data-store-id="${ad.targetValue}">${ad.ctaTextAr || 'تصفح المتجر'}</button>`;
        } else {
          html += `<a href="${ad.targetValue}" target="_blank" class="hero-ad-cta">${ad.ctaTextAr || 'اعرف المزيد'}</a>`;
        }

        html += `</div></div>`;
      });
      html += `</div>`;
    }

    // 1. أ. المنتجات الممولة (Sponsored)
    const sponsoredOffers = data.offers.filter(o => {
      const isNotExpired = o.endDate >= today;
      if (!isNotExpired || o.sponsored !== true) return false;

      // 🌟 التحقق من النطاق الجغرافي للفرع بناءً على موقع المستخدم الحالي
      const branch = data.branches.find(b => b.branchId === o.branchId);
      if (!branch) return false;
      if (currentLocation.governorateId && branch.governorateId !== currentLocation.governorateId) return false;
      if (currentLocation.cityId && branch.cityId !== currentLocation.cityId) return false;

      return true;
    });

    if (sponsoredOffers.length > 0) {
      html += `
        <div class="sponsored-slider-wrapper">
          <div class="section-header-row">
            <h2 class="section-title">⭐ منتجات ممولة (Sponsored)</h2>
          </div>
          <div class="offers-slider">
      `;

      sponsoredOffers.forEach(offer => {
        const variant = data.products.flatMap(p => p.variants).find(v => v.variantId === offer.variantId);
        const product = data.products.find(p => p.variants.some(v => v.variantId === offer.variantId));
        const branch = data.branches.find(b => b.branchId === offer.branchId);
        const store = data.stores.find(s => s.storeId === branch?.storeId);

        if (product && variant) {
          const imageHtml = product.imageUrl 
            ? `<div class="card-image-container" style="height: 120px; min-height: 120px;"><img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy"></div>`
            : `<div class="card-image-container" style="height: 120px; min-height: 120px;"><span class="image-placeholder">📷</span></div>`;

          html += `
            <div class="sponsored-slider-card product-card-clickable" data-variant-id="${variant.variantId}">
              <div>
                ${imageHtml}
                <span class="sponsored-badge">إعلان ممول</span>
                <h3 style="font-size: 0.95rem; margin-top: 0.4rem; color: #111;">${product.productNameAr}</h3>
                <div class="price-tag" style="font-size: 1.1rem; margin: 0.2rem 0;">${formatPiastres(offer.offerPricePiastres)}</div>
                <p style="font-size: 0.75rem; color: #4B5563;">🏬 ${store?.storeNameAr || ''}</p>
              </div>
              <div style="font-size: 0.7rem; color: #D97706; margin-top: 0.5rem; border-top: 1px solid #FEF3C7; padding-top: 0.25rem;">
                📍 ${branch?.branchNameAr || ''}
              </div>
            </div>
          `;
        }
      });
      html += `</div></div>`;
    }

    // 1. ب. العروض المميزة (مع فلترة النطاق الجغرافي)
    const featuredOffers = data.offers.filter(o => {
      const isNotExpired = o.endDate >= today;
      if (!isNotExpired || o.homeOfferDisplay !== true) return false;

      // التحقق من أن الفرع يقع في النطاق الجغرافي الحالي للمستخدم
      const branch = data.branches.find(b => b.branchId === o.branchId);
      if (!branch) return false;
      if (currentLocation.governorateId && branch.governorateId !== currentLocation.governorateId) return false;
      if (currentLocation.cityId && branch.cityId !== currentLocation.cityId) return false;

      return true;
    });

    if (featuredOffers.length > 0) {
      html += `
        <div class="offers-slider-wrapper">
          <div class="section-header-row">
            <h2 class="section-title">🔥 أقوى العروض المميزة</h2>
          </div>
          <div class="offers-slider">
      `;

      featuredOffers.forEach(offer => {
        const variant = data.products.flatMap(p => p.variants).find(v => v.variantId === offer.variantId);
        const product = data.products.find(p => p.variants.some(v => v.variantId === offer.variantId));
        const branch = data.branches.find(b => b.branchId === offer.branchId);
        const store = data.stores.find(s => s.storeId === branch?.storeId);

        if (product && variant) {
          const imageHtml = product.imageUrl 
            ? `<div class="card-image-container" style="height: 120px; min-height: 120px;"><img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy"></div>`
            : `<div class="card-image-container" style="height: 120px; min-height: 120px;"><span class="image-placeholder">📷</span></div>`;

          html += `
            <div class="offer-slider-card product-card-clickable" data-variant-id="${variant.variantId}">
              <div>
                ${imageHtml}
                <span class="offer-badge" style="font-size:0.7rem;">خصم خاص</span>
                <h3 style="font-size: 0.95rem; margin-top: 0.4rem; color: #111;">${product.productNameAr}</h3>
                <div class="price-tag" style="font-size: 1.1rem; margin: 0.2rem 0;">${formatPiastres(offer.offerPricePiastres)}</div>
                <p style="font-size: 0.75rem; color: #4B5563;">🏬 ${store?.storeNameAr || ''}</p>
              </div>
              <div style="font-size: 0.7rem; color: #E31B23; margin-top: 0.5rem; border-top: 1px solid #E5E7EB; padding-top: 0.25rem;">
                ⏳ حتى: ${offer.endDate}
              </div>
            </div>
          `;
        }
      });
      html += `</div></div>`;
    }

    // 2. المتاجر المميزة
    const validBranches = data.branches.filter(b => {
    if (currentLocation.governorateId && b.governorateId !== currentLocation.governorateId) return false;
    if (currentLocation.cityId && b.cityId !== currentLocation.cityId) return false;
    return true;
  });

    const activeStoreIds = [...new Set(validBranches.map(b => b.storeId))];
    let featuredStores = data.stores.filter(s => s.homeScreenDisplay === true && activeStoreIds.includes(s.storeId));

    html += `
      <div class="stores-slider-wrapper">
        <div class="section-header-row">
          <h2 class="section-title">🏬 المتاجر المميزة</h2>
          <button id="view-all-stores-btn" class="btn-text-link">عرض المزيد ⬅</button>
        </div>
        <div class="stores-slider">
    `;

    if (featuredStores.length === 0) {
      html += `<p style="color: #6B7280; padding: 1rem;">لا توجد متاجر مميزة متاحة في نطاقك الجغرافي.</p>`;
    } else {
      featuredStores.forEach(store => {
        const storeBranches = validBranches.filter(b => b.storeId === store.storeId);
        const imageHtml = store.imageUrl 
          ? `<div class="store-image-container" style="aspect-ratio:3/4;"><img src="${store.imageUrl}" alt="${store.storeNameAr}" loading="lazy"></div>`
          : `<div class="store-image-container" style="aspect-ratio:3/4;"><span class="image-placeholder">📷</span></div>`;

        html += `
          <div class="store-slider-card store-card-click" data-store-id="${store.storeId}">
            ${imageHtml}
            <h3>${store.storeNameAr}</h3>
            <p>${storeBranches.length} فرع متاح</p>
          </div>
        `;
      });
    }
    html += `</div></div>`;

    // 3. المنتجات المقترحة
    html += `
      <div class="section-header-row" style="margin-top: 2rem;">
        <h2 class="section-title">🛒 منتجات مقترحة لك</h2>
        <button id="view-all-products-btn" class="btn-text-link">عرض المزيد ⬅</button>
      </div>
      <div class="products-grid" id="home-products-grid">
    `;

    let displayedProductsCount = 0;
    data.products.forEach(product => {
      if (product.homeSuggested === true) {
        product.variants.forEach(variant => {
          if (displayedProductsCount < 6) {
            const variantPrices = data.prices.filter(p => p.variantId === variant.variantId);
            const validPrices = variantPrices.filter(p => {
              const branch = data.branches.find(b => b.branchId === p.branchId);
              if (!branch) return false;
              if (currentLocation.governorateId && branch.governorateId !== currentLocation.governorateId) return false;
              if (currentLocation.cityId && branch.cityId !== currentLocation.cityId) return false;
              if (currentLocation.areaId && branch.areaId !== currentLocation.areaId) return false;
              return true;
            });

            if (validPrices.length > 0) {
              validPrices.sort((a, b) => a.pricePiastres - b.pricePiastres);
              const bestPrice = validPrices[0];
              const branch = data.branches.find(b => b.branchId === bestPrice.branchId);
              const store = data.stores.find(s => s.storeId === branch?.storeId);
              const freshness = calculateFreshness(bestPrice.observationDate);
              const imageHtml = product.imageUrl 
                ? `<div class="card-image-container"><img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy"></div>`
                : `<div class="card-image-container"><span class="image-placeholder">📷 لا توجد صورة</span></div>`;

              displayedProductsCount++;
              html += `
                <div class="card product-card-clickable" data-variant-id="${variant.variantId}" style="cursor: pointer;">
                  <div>
                    ${imageHtml}
                    <span class="badge ${freshness.class}">${freshness.label}</span>
                    <h3>${product.productNameAr}</h3>
                    <p style="font-size: 0.9rem; color: #4B5563; margin-bottom: 0.5rem;">
                      ${product.brandAr || ''} - ${variant.packageSize} ${variant.unit}
                    </p>
                    <div class="price-tag">${formatPiastres(bestPrice.pricePiastres)}</div>
                    <p style="font-size: 0.85rem; font-weight: 600; color: #111111;">
                      📍 ${store?.storeNameAr || ''} - ${branch?.branchNameAr || ''}
                    </p>
                  </div>
                  <div class="meta-info">
                    <div>📅 تاريخ الرصد: ${bestPrice.observationDate}</div>
                    <div>🔍 اضغط لمقارنة الأسعار</div>
                  </div>
                </div>
              `;
            }
          }
        });
      }
    });

    if (displayedProductsCount === 0) {
      html += `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #6B7280;"><p>لا توجد منتجات مقترحة محددة للشاشة الرئيسية حالياً.</p></div>`;
    }

    html += `</div>`;
    dynamicContentArea.innerHTML = html;

    const slides = document.querySelectorAll('.hero-ad-card');
    if (slides.length > 0) {
      let currentSlideIndex = 0;

      const showSlide = (index) => {
        slides.forEach(s => s.classList.remove('active'));
        slides[index].classList.add('active');
      };

      const nextSlide = () => {
        currentSlideIndex = (currentSlideIndex + 1) % slides.length;
        showSlide(currentSlideIndex);
      };

      const prevSlide = () => {
        currentSlideIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
        showSlide(currentSlideIndex);
      };

      if (slides.length > 1) {
        heroAdsInterval = setInterval(nextSlide, 3000);

        const resetInterval = () => {
          clearInterval(heroAdsInterval);
          heroAdsInterval = setInterval(nextSlide, 3000);
        };

        const prevBtn = document.querySelector('.hero-prev-btn');
        const nextBtn = document.querySelector('.hero-next-btn');

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
      }
    }

    document.querySelectorAll('.ad-store-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedStoreId = btn.getAttribute('data-store-id');
        currentTab = 'store-products';
        renderApp();
      });
    });

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

    attachProductClickListeners('home');
  }

  function renderAllStores() {
    searchSectionWrapper.style.display = 'flex';
    
    // 1. الفروع المتاحة حسب النطاق الجغرافي
    const validBranches = data.branches.filter(b => {
      if (currentLocation.governorateId && b.governorateId !== currentLocation.governorateId) return false;
      if (currentLocation.cityId && b.cityId !== currentLocation.cityId) return false;
      return true;
    });

    const activeStoreIds = [...new Set(validBranches.map(b => b.storeId))];
    let storesToDisplay = data.stores.filter(s => activeStoreIds.includes(s.storeId));

    if (currentSearchQuery.trim()) {
      const q = normalizeArabic(currentSearchQuery.toLowerCase().trim());
      storesToDisplay = storesToDisplay.filter(s => normalizeArabic(s.storeNameAr).includes(q));
    }

    if (storesToDisplay.length === 0) {
      dynamicContentArea.innerHTML = `<div style="text-align: center; padding: 3rem; color: #6B7280;"><h3>لا توجد متاجر متاحة في هذا النطاق أو مطابقة للبحث.</h3></div>`;
      return;
    }

    let html = `<h2 class="section-title" style="margin-bottom: 1.5rem;">🏬 المتاجر حسب التصنيفات</h2>`;

    // 2. المرور على كل فئة
    data.categories.forEach(category => {
      // كل المتاجر الخاصة بهذه الفئة (بغض النظر عن true أو false لحساب الإجمالي وزر المزيد)
      const allCategoryStores = storesToDisplay.filter(s => s.categoryId === category.categoryId);

      if (allCategoryStores.length > 0) {
        // المتاجر التي تحمل true فقط لعرضها في السطر الأفقي
        let featuredStores = allCategoryStores.filter(s => s.featuredInCat === true);
        
        // لو لم يحدد المستخدم أي متجر كـ true، نأخذ أول 5 متاجر كافتراضي لتجنب اختفاء الفئة بالكامل
        if (featuredStores.length === 0) {
          featuredStores = allCategoryStores.slice(0, 5);
        }

        // أخذ أول 5 متاجر فقط للسطر الأفقي
        const displayStores = featuredStores.slice(0, 5);
        
        // هل يوجد عدد إجمالي للمتاجر في هذه الفئة أكبر من ما يتم عرضه أفقياً؟
        const hasMore = allCategoryStores.length > displayStores.length;

        html += `
          <div class="category-row-section" style="margin-bottom: 2.5rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #E5E7EB; padding-bottom: 0.5rem; margin-bottom: 1rem;">
              <h3 style="font-size: 1.2rem; font-weight: 700; color: #111827; margin: 0;">📁 ${category.categoryNameAr}</h3>
              ${hasMore ? `<button class="btn-text-link view-more-category-btn" data-category-id="${category.categoryId}" style="font-size: 0.85rem; font-weight: 600; color: #E31B23; background:none; border:none; cursor:pointer;">عرض المزيد (${allCategoryStores.length}) ⬅</button>` : ''}
            </div>
            
            <div class="category-row-container">
        `;

        displayStores.forEach(store => {
          const storeBranches = validBranches.filter(b => b.storeId === store.storeId);
          const imageHtml = store.imageUrl 
            ? `<div class="store-image-container" style="aspect-ratio: 4/3; border-radius: 8px; overflow: hidden; margin-bottom: 0.5rem;"><img src="${store.imageUrl}" alt="${store.storeNameAr}" loading="lazy" style="width:100%; height:100%; object-fit:cover;"></div>`
            : `<div class="store-image-container" style="aspect-ratio: 4/3; background:#F3F4F6; border-radius: 8px; display:flex; align-items:center; justify-content:center; margin-bottom: 0.5rem;"><span class="image-placeholder">📷</span></div>`;

          html += `
            <div class="category-row-card store-card-click" data-store-id="${store.storeId}">
              ${imageHtml}
              <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.2rem 0; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${store.storeNameAr}</h4>
              <p style="font-size: 0.75rem; color: #6B7280; margin: 0 0 0.5rem 0;">${storeBranches.length} فرع متاح</p>
              <span style="font-size: 0.75rem; color: #E31B23; font-weight: 600; margin-top: auto;">تصفح المنتجات ⬅</span>
            </div>
          `;
        });

        html += `</div></div>`;
      }
    });

    dynamicContentArea.innerHTML = html;

    // ربط أحداث النقر على المتاجر
    document.querySelectorAll('.store-card-click').forEach(card => {
      card.addEventListener('click', () => {
        selectedStoreId = card.getAttribute('data-store-id');
        currentTab = 'store-products';
        renderApp();
      });
    });

    // زر "عرض المزيد" ينقل المستخدم إلى صفحة منتجات/متاجر الفئة لعرض الكل
    // زر "عرض المزيد" للفئة (يعرض جميع متاجر هذه الفئة حصرياً)
    document.querySelectorAll('.view-more-category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const catId = btn.getAttribute('data-category-id');
        selectedCategoryIdForStores = catId; // تخزين الفئة المطلوبة للمتاجر
        currentTab = 'category-stores'; // الانتقال لتبويب عرض متاجر الفئة
        renderApp();
      });
    });
  }

  function renderStoreProducts() {
    const store = data.stores.find(s => s.storeId === selectedStoreId);
    storeHeaderBar.style.display = 'flex';
    selectedStoreTitle.textContent = `منتجات متجر: ${store ? store.storeNameAr : ''}`;
    
    const storeBranches = data.branches.filter(b => b.storeId === selectedStoreId);
    const storeBranchIds = storeBranches.map(b => b.branchId);

    const filteredProducts = searchProducts(data.products, currentSearchQuery);
    let html = `<h2 class="section-title" style="margin-bottom: 1rem;">الأسعار والمنتجات المتاحة بالمتجر</h2><div class="products-grid">`;;
    let productCount = 0;

    filteredProducts.forEach(product => {
      const imageHtml = product.imageUrl 
        ? `<div class="card-image-container"><img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy"></div>`
        : `<div class="card-image-container"><span class="image-placeholder">📷 لا توجد صورة</span></div>`;

      product.variants.forEach(variant => {
        const variantPrices = data.prices.filter(p => p.variantId === variant.variantId && storeBranchIds.includes(p.branchId));
        if (variantPrices.length > 0) {
          variantPrices.sort((a, b) => a.pricePiastres - b.pricePiastres);
          const bestPrice = variantPrices[0];
          const branch = data.branches.find(b => b.branchId === bestPrice.branchId);
          const freshness = calculateFreshness(bestPrice.observationDate);
          productCount++;

          html += `
            <div class="card product-card-clickable" data-variant-id="${variant.variantId}" style="cursor: pointer;">
              <div>
                ${imageHtml}
                <span class="badge ${freshness.class}">${freshness.label}</span>
                <h3>${product.productNameAr}</h3>
                <p style="font-size: 0.9rem; color: #4B5563; margin-bottom: 0.5rem;">
                  ${product.brandAr || ''} - ${variant.packageSize} ${variant.unit}
                </p>
                <div class="price-tag">${formatPiastres(bestPrice.pricePiastres)}</div>
                <p style="font-size: 0.85rem; font-weight: 600; color: #111111;">📍 ${branch ? branch.branchNameAr : ''}</p>
              </div>
              <div class="meta-info">
                <div>📅 تاريخ الرصد: ${bestPrice.observationDate}</div>
                <div>🔍 اضغط لمقارنة السعر عبر المتاجر</div>
              </div>
            </div>
          `;
        }
      });
    });

    html += `</div>`;
    dynamicContentArea.innerHTML = productCount === 0 ? `<div style="text-align: center; padding: 3rem; color: #6B7280;"><h3>لا توجد منتجات مسجلة لهذا المتجر.</h3></div>` : html;
    attachProductClickListeners('store-products');
  }

  function renderCategoryProducts() {
    const category = data.categories.find(c => c.categoryId === selectedCategoryId);
    const categoryProducts = data.products.filter(p => p.categoryId === selectedCategoryId);
    let html = `<h2 class="section-title" style="margin-bottom: 1rem;">منتجات فئة: ${category ? category.categoryNameAr : ''}</h2><div class="products-grid">`;
    let productCount = 0;

    categoryProducts.forEach(product => {
      const imageHtml = product.imageUrl 
        ? `<div class="card-image-container"><img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy"></div>`
        : `<div class="card-image-container"><span class="image-placeholder">📷 لا توجد صورة</span></div>`;

      product.variants.forEach(variant => {
        const variantPrices = data.prices.filter(p => p.variantId === variant.variantId);
        const validPrices = variantPrices.filter(p => {
          const branch = data.branches.find(b => b.branchId === p.branchId);
          if (!branch) return false;
          if (currentLocation.governorateId && branch.governorateId !== currentLocation.governorateId) return false;
          if (currentLocation.cityId && branch.cityId !== currentLocation.cityId) return false;
          if (currentLocation.areaId && branch.areaId !== currentLocation.areaId) return false;
          return true;
        });

        if (validPrices.length > 0) {
          validPrices.sort((a, b) => a.pricePiastres - b.pricePiastres);
          const bestPrice = validPrices[0];
          const branch = data.branches.find(b => b.branchId === bestPrice.branchId);
          const store = data.stores.find(s => s.storeId === branch?.storeId);
          const freshness = calculateFreshness(bestPrice.observationDate);
          productCount++;

          html += `
            <div class="card product-card-clickable" data-variant-id="${variant.variantId}" style="cursor: pointer;">
              <div>
                ${imageHtml}
                <span class="badge ${freshness.class}">${freshness.label}</span>
                <h3>${product.productNameAr}</h3>
                <p style="font-size: 0.9rem; color: #4B5563; margin-bottom: 0.5rem;">
                  ${product.brandAr || ''} - ${variant.packageSize} ${variant.unit}
                </p>
                <div class="price-tag">${formatPiastres(bestPrice.pricePiastres)}</div>
                <p style="font-size: 0.85rem; font-weight: 600; color: #111111;">
                  📍 ${store?.storeNameAr || ''} - ${branch?.branchNameAr || ''}
                </p>
              </div>
              <div class="meta-info">
                <div>📅 تاريخ الرصد: ${bestPrice.observationDate}</div>
                <div>🔍 اضغط لمقارنة الأسعار</div>
              </div>
            </div>
          `;
        }
      });
    });

    html += `</div>`;
    dynamicContentArea.innerHTML = productCount === 0 ? `<div style="text-align: center; padding: 3rem; color: #6B7280;"><h3>لا توجد منتجات متاحة لهذه الفئة في نطاقك.</h3></div>` : html;
    attachProductClickListeners('category-products');
  }

  function renderProductComparison() {
    productComparisonHeader.style.display = 'flex';
    searchSectionWrapper.style.display = 'none';

    const variant = data.products.flatMap(p => p.variants).find(v => v.variantId === selectedVariantIdForComparison);
    const product = data.products.find(p => p.variants.some(v => v.variantId === selectedVariantIdForComparison));

    if (!product || !variant) {
      dynamicContentArea.innerHTML = `<p>المنتج غير موجود</p>`;
      return;
    }

    comparisonProductTitle.textContent = `مقارنة أسعار: ${product.productNameAr} (${variant.packageSize} ${variant.unit})`;
    const variantPrices = data.prices.filter(p => p.variantId === variant.variantId);
    
    const validPrices = variantPrices.filter(p => {
      const branch = data.branches.find(b => b.branchId === p.branchId);
      if (!branch) return false;
      if (currentLocation.governorateId && branch.governorateId !== currentLocation.governorateId) return false;
      if (currentLocation.cityId && branch.cityId !== currentLocation.cityId) return false;
      if (currentLocation.areaId && branch.areaId !== currentLocation.areaId) return false;
      return true;
    });

    validPrices.sort((a, b) => a.pricePiastres - b.pricePiastres);

    let html = `<h2 class="section-title" style="margin-bottom: 1rem;">أسعار المنتج في جميع المتاجر والفروع:</h2><div class="comparison-container">`;
    validPrices.forEach((priceItem, index) => {
      const branch = data.branches.find(b => b.branchId === priceItem.branchId);
      const store = data.stores.find(s => s.storeId === branch?.storeId);
      const freshness = calculateFreshness(priceItem.observationDate);
      const isLowest = index === 0;

      html += `
        <div class="price-comparison-row" style="${isLowest ? 'border-color: #10B981; background-color: #ECFDF5;' : ''}">
          <div class="store-info-side">
            <h4>🏬 ${store?.storeNameAr || ''} — ${branch?.branchNameAr || ''}</h4>
            <p>📍 ${branch?.addressAr || ''}</p>
            <span class="badge ${freshness.class}" style="margin-top: 0.5rem; display:inline-block;">${freshness.label}</span>
            ${isLowest ? '<span class="badge" style="background-color: #10B981; color: white; margin-right: 0.5rem;">🔥 أرخص سعر</span>' : ''}
          </div>
          <div class="price-info-side">
            <div class="price-tag">${formatPiastres(priceItem.pricePiastres)}</div>
            <p style="font-size: 0.8rem; color: #6B7280;">📅 رصد بتاريخ: ${priceItem.observationDate}</p>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    dynamicContentArea.innerHTML = html;
  }

  function renderCategoryStores() {
    searchSectionWrapper.style.display = 'flex';
    const category = data.categories.find(c => c.categoryId === selectedCategoryIdForStores);
    
    // الفروع المتاحة في النطاق الجغرافي للمستخدم
    const validBranches = data.branches.filter(b => {
      if (currentLocation.governorateId && b.governorateId !== currentLocation.governorateId) return false;
      if (currentLocation.cityId && b.cityId !== currentLocation.cityId) return false;
      return true;
    });

    const activeStoreIds = [...new Set(validBranches.map(b => b.storeId))];
    
    // تصفية متاجر هذه الفئة فقط والتي تمتلك فروعاً نشطة في النطاق
    let categoryStores = data.stores.filter(s => s.categoryId === selectedCategoryIdForStores && activeStoreIds.includes(s.storeId));

    let html = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
        <h2 class="section-title" style="margin: 0; font-size: 1.2rem;">🏬 متاجر فئة: ${category ? category.categoryNameAr : ''}</h2>
        <button id="back-to-stores-main" class="btn-secondary" style="font-size: 0.8rem; padding: 0.35rem 0.7rem;">⬅️ العودة</button>
      </div>
      <div class="category-stores-grid">
    `;

    if (categoryStores.length === 0) {
      html += `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #6B7280;"><h3>لا توجد متاجر متاحة لهذه الفئة في نطاقك الجغرافي حالياً.</h3></div>`;
    } else {
      categoryStores.forEach(store => {
        const storeBranches = validBranches.filter(b => b.storeId === store.storeId);
        const imageHtml = store.imageUrl 
          ? `<div class="store-image-container"><img src="${store.imageUrl}" alt="${store.storeNameAr}" loading="lazy"></div>`
          : `<div class="store-image-container" style="display:flex; align-items:center; justify-content:center;"><span class="image-placeholder">📷</span></div>`;

        html += `
          <div class="compact-store-card store-card-click" data-store-id="${store.storeId}">
            ${imageHtml}
            <h4>🏬 ${store.storeNameAr}</h4>
            <p>الفروع: ${storeBranches.length} فرع</p>
            <button class="btn-primary">تصفح المنتجات</button>
          </div>
        `;
      });
    }

    html += `</div>`;
    dynamicContentArea.innerHTML = html;

    // ربط زر العودة لصفحة المتاجر الرئيسية
    const backBtn = document.getElementById('back-to-stores-main');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        currentTab = 'all-stores';
        renderApp();
      });
    }

    // ربط النقر على المتجر لفتح منتجاته
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
    const today = new Date().toISOString().split('T')[0];
    const activeOffers = data.offers.filter(o => o.endDate >= today);
    let html = `<h2 class="section-title" style="margin-bottom: 1rem;">🔥 أقوى العروض والتخفيضات المتاحة حالياً</h2><div class="products-grid">`;
    
    let offerCount = 0;

    activeOffers.forEach(offer => {
      const variant = data.products.flatMap(p => p.variants).find(v => v.variantId === offer.variantId);
      const product = data.products.find(p => p.variants.some(v => v.variantId === offer.variantId));
      const branch = data.branches.find(b => b.branchId === offer.branchId);
      const store = data.stores.find(s => s.storeId === branch?.storeId);

      if (currentLocation.governorateId && branch?.governorateId !== currentLocation.governorateId) return;
      if (currentLocation.cityId && branch?.cityId !== currentLocation.cityId) return;
      if (currentLocation.areaId && branch?.areaId !== currentLocation.areaId) return;

      if (product && variant) {
        offerCount++;
        const imageHtml = product.imageUrl 
          ? `<div class="card-image-container"><img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy"></div>`
          : `<div class="card-image-container"><span class="image-placeholder">📷</span></div>`;

        html += `
          <div class="card product-card-clickable" data-variant-id="${variant.variantId}" style="border-color: #E31B23; cursor: pointer;">
            <div>
              ${imageHtml}
              <span class="offer-badge">خصم خاص</span>
              <h3 style="margin-top: 0.5rem;">${product.productNameAr}</h3>
              <p style="font-size: 0.9rem; color: #4B5563;">${product.brandAr || ''} - ${variant.packageSize} ${variant.unit}</p>
              <div class="price-tag">${formatPiastres(offer.offerPricePiastres)}</div>
              <p style="font-size: 0.85rem; font-weight: 600; color: #111111;">
                🏬 ${store?.storeNameAr || ''} (${branch?.branchNameAr || ''})
              </p>
              <p style="font-size: 0.8rem; color: #E31B23; margin-top: 0.25rem;">📌 ${offer.conditionAr || ''}</p>
            </div>
            <div class="meta-info">
              <div>⏳ ساري حتى: ${offer.endDate}</div>
              <div>🔍 اضغط لمقارنة الأسعار</div>
            </div>
          </div>
        `;
      }
    });

    html += `</div>`;
    dynamicContentArea.innerHTML = offerCount === 0 ? `<div style="text-align: center; padding: 3rem; color: #6B7280;"><h3>لا تتوفر عروض في نطاقك الجغرافي حالياً.</h3></div>` : html;
    attachProductClickListeners('offers');
  }

  function renderAllProducts() {
    searchSectionWrapper.style.display = 'flex';
    const filteredProducts = searchProducts(data.products, currentSearchQuery);
    let html = `<h2 class="section-title" style="margin-bottom: 1rem;">🛒 جميع المنتجات والأسعار</h2><div class="products-grid">`;
    let productCount = 0;

    filteredProducts.forEach(product => {
      const imageHtml = product.imageUrl 
        ? `<div class="card-image-container"><img src="${product.imageUrl}" alt="${product.productNameAr}" loading="lazy"></div>`
        : `<div class="card-image-container"><span class="image-placeholder">📷</span></div>`;

      product.variants.forEach(variant => {
        const variantPrices = data.prices.filter(p => p.variantId === variant.variantId);
        const validPrices = variantPrices.filter(p => {
          const branch = data.branches.find(b => b.branchId === p.branchId);
          if (!branch) return false;
          if (currentLocation.governorateId && branch.governorateId !== currentLocation.governorateId) return false;
          if (currentLocation.cityId && branch.cityId !== currentLocation.cityId) return false;
          if (currentLocation.areaId && branch.areaId !== currentLocation.areaId) return false;
          return true;
        });

        if (validPrices.length > 0) {
          validPrices.sort((a, b) => a.pricePiastres - b.pricePiastres);
          const bestPrice = validPrices[0];
          const branch = data.branches.find(b => b.branchId === bestPrice.branchId);
          const store = data.stores.find(s => s.storeId === branch?.storeId);
          const freshness = calculateFreshness(bestPrice.observationDate);
          productCount++;

          html += `
            <div class="card product-card-clickable" data-variant-id="${variant.variantId}" style="cursor: pointer;">
              <div>
                ${imageHtml}
                <span class="badge ${freshness.class}">${freshness.label}</span>
                <h3>${product.productNameAr}</h3>
                <p style="font-size: 0.9rem; color: #4B5563; margin-bottom: 0.5rem;">
                  ${product.brandAr || ''} - ${variant.packageSize} ${variant.unit}
                </p>
                <div class="price-tag">${formatPiastres(bestPrice.pricePiastres)}</div>
                <p style="font-size: 0.85rem; font-weight: 600; color: #111111;">
                  📍 ${store?.storeNameAr || ''} - ${branch?.branchNameAr || ''}
                </p>
              </div>
              <div class="meta-info">
                <div>📅 تاريخ الرصد: ${bestPrice.observationDate}</div>
                <div>🔍 اضغط لمقارنة الأسعار</div>
              </div>
            </div>
          `;
        }
      });
    });

    html += `</div>`;
    dynamicContentArea.innerHTML = productCount === 0 ? `<div style="text-align: center; padding: 3rem; color: #6B7280;"><h3>لا توجد منتجات مطابقة في النطاق الجغرافي.</h3></div>` : html;
    attachProductClickListeners('all-products');
  }

  function attachProductClickListeners(fromTabName) {
    document.querySelectorAll('.product-card-clickable').forEach(card => {
      card.addEventListener('click', () => {
        const variantId = card.getAttribute('data-variant-id');
        if (variantId) {
          selectedVariantIdForComparison = variantId;
          previousTabBeforeComparison = fromTabName;
          currentTab = 'product-comparison';
          renderApp();
        }
      });
    });
  }

  renderApp();
});


// إخفاء شاشة التحميل عند اكتمال تحميل الصفحة والبيانات
window.addEventListener('load', () => {
  const loader = document.getElementById('app-loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.style.display = 'none';
      }, 400); 
    }, 300);
  }
});