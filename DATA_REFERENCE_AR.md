# مرجع بيانات وفرة (Wafra) — الأسعار والعروض والإعلانات

هذا الملف مرجع عملي مختصر لكل أنواع الأسعار والعروض والإعلانات المستخدمة في المشروع، مع نموذج جاهز للنسخ لكل نوع.

> القاعدة الذهبية: **لا يظهر أي سعر أو عرض خارج المدينة/المحافظة المختارة**. بيانات الأسعار والعروض التجريبية الحالية ليست أسعاراً حقيقية.

---

## 1. ملفات البيانات والعلاقات

| الملف | الوظيفة |
|---|---|
| `locations.json` | المحافظات والمدن. |
| `categories.json` | الفئات الرئيسية. |
| `products.json` | المنتجات ومتغيرات العبوة (`variants`). |
| `stores.json` | المتاجر، وقد تحتوي على `branchGroups`. |
| `branches.json` | الفروع وربطها بالمتجر والمدينة ومجموعة الفروع. |
| `prices.json` | **سعر القطعة المفردة فقط** (عادي أو عرض أسبوعي). |
| `offers.json` | الباكدجات، عروض الكميات، القيمة المضافة، وعروض المتجر. |
| `ads.json` | الإعلانات الممولة. |
| `manifest.json` | إصدار البيانات وقائمة الملفات. |

### شجرة الربط

```text
المحافظة governorateId
  └── المدينة cityId
        └── الفرع branchId
              ├── storeId        ← المتجر
              └── branchGroupId  ← مجموعة الفروع (اختياري)

المنتج productId
  └── المتغير variantId        ← هو ما يُربط به السعر أو العرض
```

### أولوية البحث عن سعر القطعة

1. سعر الفرع المحدد: `branchId`.
2. سعر مجموعة الفروع: `branchGroupId`.
3. سعر المتجر العام: `storeId` بدون `branchId` أو `branchGroupId`.

إذا تكرر `branchId` بين أكثر من مدينة، أضف `cityId` لصف السعر أو للعرض حتى لا يظهر في المدينة الخطأ. التطبيق يختار صف الفرع المطابق للمدينة عند عرض العنوان، لذا املأ `addressAr` في صف كل مدينة بشكل مستقل.

---

## 2. أنواع الأسعار في `prices.json`

`prices.json` مخصص لسعر **القطعة المفردة** فقط. لا تضع فيه باكدجاً أو هدية أو عرض كمية؛ تلك مكانها `offers.json`.

### الحقول الأساسية

| الحقل | إلزامي | الوصف |
|---|---|---|
| `priceId` | نعم | معرف فريد لصف السعر. |
| `variantId` | نعم | معرف متغير المنتج. |
| `storeId` | نعم* | معرف المتجر. مطلوب في السعر العام، ويُفضّل وجوده في كل الصفوف. |
| `branchId` | لا | سعر خاص بفرع واحد. |
| `branchGroupId` | لا | سعر لمجموعة فروع. |
| `cityId` | لا | حماية إضافية عند تكرار `branchId` بين المدن. |
| `pricePiastres` | نعم | السعر الحالي بالقروش (1500 = 15.00). |
| `priceType` | لا | `regular` أو `weekly_offer`. الافتراضي `regular`. |
| `regularPricePiastres` | لا | السعر قبل الخصم، ويُستخدم مع `weekly_offer`. |
| `observationDate` | نعم | تاريخ رصد السعر بصيغة `YYYY-MM-DD`. |
| `sourceAr` | لا | وصف مصدر السعر. |

\* في سعر مجموعة الفروع يعتمد التطبيق على `branchGroupId`، لكن وجود `storeId` يجعل الصف أوضح وأسهل في التحقق.

### 2.1 سعر عادي لفرع محدد — `regular`

```json
{
  "priceId": "price_bolti_normal",
  "variantId": "fish-bolti-normal-1kg",
  "branchId": "fish-ala-elbahr-newdamietta",
  "storeId": "fish-ala-elbahr",
  "pricePiastres": 9000,
  "priceType": "regular",
  "observationDate": "2026-10-23",
  "sourceAr": "سوق السمك - دمياط الجديدة"
}
```

### 2.2 سعر عادي لمجموعة فروع — `branchGroupId`

```json
{
  "priceId": "price_lulu_g2_sadia",
  "variantId": "sadia-broast-1kg",
  "storeId": "lulu-hypermarket",
  "branchGroupId": "lulu-g2",
  "pricePiastres": 1650,
  "priceType": "regular",
  "observationDate": "2026-10-28",
  "sourceAr": "سعر مجموعة مكة وجدة والمدينة والطائف"
}
```

### 2.3 سعر عادي لكل فروع المتجر — `storeId` فقط

```json
{
  "priceId": "price_panda_sadia",
  "variantId": "sadia-broast-1kg",
  "storeId": "panda-hypermarket",
  "pricePiastres": 2150,
  "priceType": "regular",
  "observationDate": "2026-10-28",
  "sourceAr": "سعر عام - هايبر بندة"
}
```

### 2.4 سعر عرض أسبوعي — `weekly_offer`

استخدمه عندما يكون السعر مخفضاً لفترة محدودة. أضف `regularPricePiastres` لإظهار السعر القديم وشارة «سعر عرض أسبوعي».

```json
{
  "priceId": "price_lulu_g1_sadia",
  "variantId": "sadia-broast-1kg",
  "storeId": "lulu-hypermarket",
  "branchGroupId": "lulu-g1",
  "pricePiastres": 1500,
  "regularPricePiastres": 1900,
  "priceType": "weekly_offer",
  "observationDate": "2026-10-28",
  "sourceAr": "سعر مخفض (عرض أسبوعي) - مجموعة الرياض والقصيم وحائل"
}
```

> ملاحظة: `prices.json` لا يحتوي على تاريخ بداية ونهاية للعرض الأسبوعي. إذا احتجت صلاحية زمنية دقيقة، اجعل السعر في `offers.json` كعرض سعر قطعة واحدة، أو أضف حقول تواريخ مستقبلية عند تطوير مخطط الأسعار.

### 2.5 سعر فرع مع حماية المدينة

```json
{
  "priceId": "price_branch_reused_city",
  "variantId": "cow-meat-liver-1kg",
  "branchId": "branch-reused-id",
  "cityId": "riyad",
  "storeId": "lulu-hypermarket",
  "pricePiastres": 4500,
  "priceType": "regular",
  "observationDate": "2026-10-28",
  "sourceAr": "سعر فرع الرياض"
}
```

---

## 3. أنواع العروض في `offers.json`

`offers.json` مخصص للباكدجات وعروض الكميات والقيمة المضافة وعروض المتجر. لا تضع فيه سعر القطعة المفردة العادي.

### الحقول المشتركة

| الحقل | إلزامي | الوصف |
|---|---|---|
| `offerId` | نعم | معرف فريد للعرض. |
| `offerType` | نعم | `bundle` أو `value` أو `store_value`. |
| `variantId` | نعم* | مطلوب في عروض المنتجات، ويُحذف في `store_value`. |
| `titleAr` | نعم* | مطلوب في `store_value`، واختياري في عروض المنتجات. |
| `storeId` | لا | لتقييد العرض بمتجر كامل. |
| `branchId` / `branchIds` | لا | فرع واحد أو عدة فروع. |
| `branchGroupIds` | لا | مجموعة أو عدة مجموعات فروع. |
| `cityIds` | لا | تقييد العرض بمدن محددة، خصوصاً عند تكرار معرفات الفروع. |
| `conditionAr` | نعم | شرح الشرط كما يظهر للعميل. |
| `bundleQuantity` | لا | عدد القطع في الباكدج. الافتراضي 1. |
| `bundlePricePiastres` | لا | إجمالي سعر الباكدج بالقروش. اتركه فارغاً في عروض القيمة المضافة. |
| `startDate` / `endDate` | نعم | صلاحية العرض بصيغة `YYYY-MM-DD`. |
| `homeOfferDisplay` | لا | `true` لإظهاره في قسم العروض المميزة بالرئيسية. |
| `sponsored` | لا | `true` لإظهاره كعرض ممول. |

\* `variantId` مطلوب في `bundle` و`value`، و`titleAr` مطلوب في `store_value`.

### 3.1 باكدج / عرض كمية — `bundle`

يُستخدم عند شراء أكثر من قطعة بسعر إجمالي. التطبيق يحسب سعر القطعة داخل الباكدج تلقائياً، ويقارنه بسعر القطعة الفعلي في نفس الفرع/المجموعة لحساب التوفير.

```json
{
  "offerId": "bundle_lulu_g1_sadia",
  "offerType": "bundle",
  "variantId": "sadia-broast-1kg",
  "storeId": "lulu-hypermarket",
  "branchGroupIds": ["lulu-g1"],
  "conditionAr": "اشتري قطعتين واحصل على الثالثة مجاناً",
  "bundleQuantity": 3,
  "bundlePricePiastres": 3000,
  "startDate": "2026-10-27",
  "endDate": "2026-11-22",
  "homeOfferDisplay": true,
  "sponsored": true
}
```

**مثال عرض كمية على فرع واحد:**

```json
{
  "offerId": "bundle_001",
  "offerType": "bundle",
  "variantId": "fish-bolti-green-1kg",
  "branchId": "fish-ala-elbahr-newdamietta",
  "conditionAr": "اشترِ 3 كجم بسعر 400 جنيه",
  "bundleQuantity": 3,
  "bundlePricePiastres": 40000,
  "startDate": "2026-10-27",
  "endDate": "2026-11-10",
  "homeOfferDisplay": true,
  "sponsored": true
}
```

**عرض سعر قطعة واحدة:** استخدم `bundleQuantity: 1` مع `bundlePricePiastres`، وسيظهر كعرض «قطعة» بدلاً من باكدج.

### 3.2 قيمة مضافة — `value`

يُستخدم للهدايا والإضافات التي لا تُترجم إلى سعر إجمالي مباشر. اترك `bundlePricePiastres` فارغاً أو احذفه.

```json
{
  "offerId": "value_lulu_g1_spices",
  "offerType": "value",
  "variantId": "cow-meat-liver-1kg",
  "storeId": "lulu-hypermarket",
  "branchGroupIds": ["lulu-g1"],
  "conditionAr": "هدية مجانية: بهارات مشكلة مع كل كيلوجرام كبدة",
  "startDate": "2026-10-27",
  "endDate": "2026-11-10",
  "homeOfferDisplay": false,
  "sponsored": false
}
```

### 3.3 عرض متجر بدون منتج — `store_value`

يُستخدم للتوصيل المجاني، المواقف، الخدمات، أو أي ميزة لا ترتبط بمنتج محدد. لا يحتوي على `variantId`، ويحتوي على `titleAr`.

```json
{
  "offerId": "store_lulu_g1_delivery",
  "offerType": "store_value",
  "storeId": "lulu-hypermarket",
  "branchGroupIds": ["lulu-g1"],
  "titleAr": "توصيل مجاني للطلبات فوق 100 ريال",
  "conditionAr": "الحد الأدنى 100 ريال داخل نطاق الفرع",
  "startDate": "2026-10-27",
  "endDate": "2026-11-30",
  "homeOfferDisplay": true,
  "sponsored": false
}
```

**عرض متجر لفرع محدد مع حماية المدينة:**

```json
{
  "offerId": "store_lulu_dammam_parking",
  "offerType": "store_value",
  "storeId": "lulu-hypermarket",
  "branchIds": ["lulu-hypermarket-c"],
  "cityIds": ["dammam"],
  "titleAr": "مواقف مجانية لعملاء الفرع",
  "conditionAr": "عند الشراء بأكثر من 50 ريالاً من فرع الدمام",
  "startDate": "2026-10-27",
  "endDate": "2026-11-30",
  "homeOfferDisplay": true,
  "sponsored": false
}
```

### 3.4 قواعد استهداف العرض

يمكن استخدام أكثر من محدد معاً، ويُطبّق التقاطع بينها:

```text
storeId          → كل فروع المتجر
branchGroupIds   → فروع المجموعة/المجموعات
branchId         → فرع واحد
branchIds        → عدة فروع
cityIds          → لا يظهر إلا داخل هذه المدن
```

أمثلة:

- عرض لكل فروع متجر: `storeId` فقط.
- عرض لمجموعة فروع: `storeId` + `branchGroupIds`.
- عرض لفرع واحد: `branchId` (أو `branchIds` بفرع واحد).
- عرض لعدة فروع في مدن مختلفة: `branchIds` + `cityIds` عند الحاجة.
- عرض لمدينة كاملة داخل متجر: `storeId` + `cityIds`، لكن تأكد من وجود فروع للمتجر في المدينة.

---

## 4. مجموعات الفروع `branchGroups`

المتاجر الكبيرة قد تختلف أسعارها بين المناطق. عرّف المجموعات داخل `stores.json`، ثم ضع `branchGroupId` في كل صف داخل `branches.json`.

```json
{
  "storeId": "lulu-hypermarket",
  "storeNameAr": "لولو هايبرماركت",
  "imageUrl": "https://example.com/lulu.png",
  "homeScreenDisplay": true,
  "categoryId": "cat_supermarket",
  "featuredInCat": true,
  "branchGroups": [
    { "branchGroupId": "lulu-g1", "branchGroupNameAr": "الرياض والقصيم وحائل" },
    { "branchGroupId": "lulu-g2", "branchGroupNameAr": "مكة وجدة والمدينة والطائف" },
    { "branchGroupId": "lulu-g3", "branchGroupNameAr": "المنطقة الشرقية" }
  ]
}
```

```json
{
  "branchId": "lulu-hypermarket-a",
  "storeId": "lulu-hypermarket",
  "branchNameAr": "لولو هايبرماركت",
  "governorateId": "sa-riyad",
  "cityId": "riyad",
  "addressAr": "غير متاح",
  "category": "supermarket",
  "branchGroupId": "lulu-g1"
}
```

---

## 5. الإعلانات في `ads.json`

### الحقول

| الحقل | إلزامي | الوصف |
|---|---|---|
| `adId` | نعم | معرف فريد للإعلان. |
| `imageUrl` | نعم | رابط الصورة. المقاس المفضل 900×300 أو 3:1. |
| `titleAr` | نعم | العنوان الرئيسي. |
| `subtitleAr` | لا | وصف قصير. |
| `kickerAr` | لا | كلمة صغيرة فوق العنوان. |
| `badgeAr` | لا | شارة الزاوية، الافتراضي «إعلان». |
| `ctaTextAr` | لا | نص زر الإجراء، الافتراضي «اعرف المزيد». |
| `targetType` | نعم | `external` أو `store` أو `offers` أو `products` أو `category`. |
| `targetValue` | حسب النوع | رابط خارجي، أو `storeId`، أو `categoryId`. |
| `scope` | لا | `all` أو `governorate` أو `city`. |
| `governorateId` / `cityId` | حسب النطاق | مطلوبان عند تضييق الإعلان. |
| `placement` | لا | `home_hero` أو `offers_top` أو `home_native` مستقبلاً. الافتراضي `home_hero`. |
| `priority` | لا | رقم أكبر يظهر أولاً. |
| `startDate` / `endDate` | لا | صلاحية الإعلان `YYYY-MM-DD`. |
| `sponsored` | لا | `true` لإبراز الإعلان كممول. |
| `active` | لا | `false` لإيقاف الإعلان فوراً دون حذفه. |

### 5.1 إعلان رئيسية عام — `home_hero`

```json
{
  "adId": "ad_001",
  "imageUrl": "https://iili.io/nhuW1Nn.png",
  "titleAr": "وفرة ... أقوى عروض في السعودية",
  "subtitleAr": "قارن أسعار المنتجات والعروض في مدينتك قبل ما تشتري.",
  "kickerAr": "عروض هذا الأسبوع",
  "badgeAr": "إعلان",
  "ctaTextAr": "اعرف المزيد",
  "targetType": "external",
  "targetValue": "https://khairatsh.github.io/wafra-test/",
  "scope": "all",
  "placement": "home_hero",
  "priority": 10,
  "sponsored": true,
  "active": true
}
```

### 5.2 إعلان داخل محافظة — `governorate`

```json
{
  "adId": "ad_002",
  "imageUrl": "https://iili.io/nhuWl9t.png",
  "titleAr": "قارن الأسعار",
  "subtitleAr": "أسعار المتاجر والفروع القريبة منك في مكان واحد.",
  "kickerAr": "داخل القصيم",
  "badgeAr": "إعلان",
  "ctaTextAr": "اعرف المزيد",
  "targetType": "external",
  "targetValue": "https://khairatsh.github.io/wafra-test/",
  "scope": "governorate",
  "governorateId": "sa-qassim",
  "placement": "home_hero",
  "priority": 8,
  "sponsored": true,
  "active": true
}
```

### 5.3 إعلان داخل مدينة يفتح متجراً — `city` + `store`

```json
{
  "adId": "ad_003",
  "imageUrl": "https://iili.io/nhuWaSI.png",
  "titleAr": "في كل مكان",
  "subtitleAr": "تصفح منتجات المتجر وأسعاره داخل مدينتك.",
  "kickerAr": "عرض محلي",
  "badgeAr": "إعلان",
  "ctaTextAr": "تصفح المتجر",
  "targetType": "store",
  "targetValue": "lulu-hypermarket",
  "scope": "city",
  "cityId": "unaizah",
  "placement": "home_hero",
  "priority": 6,
  "sponsored": true,
  "active": true
}
```

### 5.4 إعلان أعلى صفحة العروض — `offers_top`

```json
{
  "adId": "ad_004",
  "imageUrl": "https://iili.io/nhuW1Nn.png",
  "titleAr": "وفّر أكثر مع عروض وفرة",
  "subtitleAr": "باكدجات وعروض كمية وقيمة مضافة من متاجر مدينتك.",
  "kickerAr": "عروض مميزة",
  "badgeAr": "إعلان",
  "ctaTextAr": "تصفح العروض",
  "targetType": "offers",
  "scope": "all",
  "placement": "offers_top",
  "priority": 10,
  "sponsored": true,
  "active": true
}
```

### 5.5 أنواع الأهداف

| `targetType` | `targetValue` | السلوك |
|---|---|---|
| `external` | رابط `https://...` | يفتح في تبويب جديد. |
| `store` | `storeId` | يفتح صفحة المتجر. |
| `offers` | يُترك فارغاً | ينتقل إلى تبويب العروض. |
| `products` | يُترك فارغاً | ينتقل إلى كل المنتجات. |
| `category` | `categoryId` | يفتح منتجات الفئة. |

### 5.6 تتبع الإعلانات

يتم تسجيل الظهور والنقر محلياً في `localStorage` تحت المفتاح `wafra_ad_stats`. للفحص من Console:

```js
window.wafraAdStats()
```

الشكل:

```json
{
  "2026-10-30": {
    "ad_001": { "impressions": 3, "clicks": 1 }
  }
}
```

هذه إحصاءات محلية للاختبار وليست تحليلات خادم. يمكن لاحقاً إرسالها إلى خدمة تحليلات عند الحاجة.

---

## 6. قائمة تحقق سريعة قبل النشر

- [ ] كل `variantId` موجود في `products.json`.
- [ ] كل `branchId` موجود في `branches.json` داخل المدينة الصحيحة.
- [ ] كل `branchGroupId` معرّف في `stores.json` وموجود على الفرع.
- [ ] الأسعار والعروض لا تظهر خارج المدينة المختارة.
- [ ] `store_value` لا يحتوي على `variantId`، ويحتوي على `titleAr`.
- [ ] `value` لا يحتوي على `bundlePricePiastres` (أو يتركه فارغاً).
- [ ] `bundle` يحتوي على `bundleQuantity` و`bundlePricePiastres`.
- [ ] تواريخ `startDate` و`endDate` بصيغة `YYYY-MM-DD`.
- [ ] `ads.json` لا يحتوي على إعلانين متطابقين في `adId`.
- [ ] أي إعلان بمدينة أو محافظة محددة يحتوي على `scope` والحقل الجغرافي المناسب.
- [ ] بعد تعديل البيانات: ارفع `dataVersion` في `manifest.json` وارفع إصدار `CACHE_KEY` في `data-loader.js`.

---

## 7. ملاحظة عن ملفات Excel

مجلدا `data-sa-xlsx/` و`data-eg-xlsx/` نسخ قابلة للتعديل من ملفات JSON:

- كل ملف JSON له Workbook مستقل.
- المصفوفات المتداخلة (مثل `variants` و`cities` و`branchGroups`) تُفصل في أوراق مرتبطة.
- أوراق العمل باتجاه RTL مع تجميد صف العناوين والفلاتر.
- بعد التعديل، استخدم سكربت التحويل الخاص بك لتصدير JSON من جديد، ثم راجع قائمة التحقق أعلاه.
