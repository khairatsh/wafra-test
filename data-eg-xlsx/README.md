# نسخ Excel — مصر

هذه المجلدات تحتوي نسخاً قابلة للتعديل من ملفات JSON. كل ملف JSON له Workbook مستقل.

## الملفات

- `locations.xlsx`
- `departments.xlsx`
- `categories.xlsx`
- `products.xlsx`
- `stores.xlsx`
- `branches.xlsx`
- `prices.xlsx`
- `offers.xlsx`
- `ads.xlsx`
- `manifest.xlsx`

## قبل التعديل

- لا تغيّر أسماء الأوراق أو الأعمدة.
- الأوراق التي تبدأ بـ `_` مساعدة ولا تُصدّر إلى JSON.
- الأسعار بالقروش: 1500 = 15.00.
- التواريخ بصيغة `YYYY-MM-DD`.
- راجع `DATA_REFERENCE_AR.md` في جذر المشروع.

## بعد التعديل

شغّل سكربت التحويل الدائم:

```powershell
python scripts/import_xlsx.py --country sa
python scripts/import_xlsx.py --country eg
```

سيُنشئ نسخة احتياطية تلقائياً قبل الكتابة، ثم راجع قائمة التحقق في `DATA_REFERENCE_AR.md`.
