function initLocationSelector(locations, onLocationChange) {
  const govSelect = document.getElementById('governorate-select');
  const citySelect = document.getElementById('city-select');
  const areaSelect = document.getElementById('area-select');

  if (!govSelect || !citySelect || !areaSelect) return;

  govSelect.innerHTML = '<option value="">اختر المحافظة</option>';
  locations.forEach(gov => {
    const opt = document.createElement('option');
    opt.value = gov.governorateId;
    opt.textContent = gov.governorateNameAr;
    govSelect.appendChild(opt);
  });

  govSelect.addEventListener('change', () => {
    const govId = govSelect.value;
    citySelect.innerHTML = '<option value="">اختر المدينة</option>';
    areaSelect.innerHTML = '<option value="">اختر المنطقة</option>';
    citySelect.disabled = !govId;
    areaSelect.disabled = true;

    const gov = locations.find(g => g.governorateId === govId);
    if (gov) {
      gov.cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city.cityId;
        opt.textContent = city.cityNameAr;
        citySelect.appendChild(opt);
      });
    }
    onLocationChange({ governorateId: govId, cityId: '', areaId: '' });
  });

  citySelect.addEventListener('change', () => {
    const govId = govSelect.value;
    const cityId = citySelect.value;
    areaSelect.innerHTML = '<option value="">اختر المنطقة</option>';
    areaSelect.disabled = !cityId;

    const gov = locations.find(g => g.governorateId === govId);
    if (gov) {
      const city = gov.cities.find(c => c.cityId === cityId);
      if (city) {
        city.areas.forEach(area => {
          const opt = document.createElement('option');
          opt.value = area.areaId;
          opt.textContent = area.areaNameAr;
          areaSelect.appendChild(opt);
        });
      }
    }
    onLocationChange({ governorateId: govId, cityId: cityId, areaId: '' });
  });

  areaSelect.addEventListener('change', () => {
    onLocationChange({
      governorateId: govSelect.value,
      cityId: citySelect.value,
      areaId: areaSelect.value
    });
  });
}