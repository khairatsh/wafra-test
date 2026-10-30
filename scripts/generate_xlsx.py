#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
توليد نسخ Excel قابلة للتعديل من مجلدات بيانات وفرة.

الاستخدام:
    python scripts/generate_xlsx.py

المخرجات:
    data-sa-xlsx/*.xlsx
    data-eg-xlsx/*.xlsx
    data-sa-xlsx/README.md
    data-eg-xlsx/README.md

ملاحظة: هذا السكربت لا يعدّل JSON. بعد تعديل Excel استخدم:
    python scripts/import_xlsx.py --country sa
    python scripts/import_xlsx.py --country eg
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.worksheet import Worksheet

ROOT = Path(__file__).resolve().parent.parent
COUNTRIES = {
    "data-sa": ("السعودية", "data-sa-xlsx"),
    "data-eg": ("مصر", "data-eg-xlsx"),
}

BRAND_RED = "E31B23"
BRAND_BLACK = "111111"
HEADER_FILL = PatternFill("solid", fgColor=BRAND_BLACK)
SECTION_FILL = PatternFill("solid", fgColor=BRAND_RED)
BAND_FILL = PatternFill("solid", fgColor="F7F7F5")
NOTE_FILL = PatternFill("solid", fgColor="FFF7ED")
HEADER_FONT = Font(name="Arial", size=11, bold=True, color="FFFFFF")
BODY_FONT = Font(name="Arial", size=10, color="1F2937")
BOLD_FONT = Font(name="Arial", size=10, bold=True, color="1F2937")
THIN = Side(style="thin", color="E5E7EB")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

# وصف الحقول: النوع، إلزامي، القيم المسموحة، ملاحظة عربية
FIELD_META: dict[str, dict[str, str]] = {
    "governorateId": {"type": "نص", "required": "نعم", "allowed": "معرف فريد", "note": "معرف المحافظة، مثل sa-riyad أو gov_damietta."},
    "governorateNameAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم المحافظة بالعربية."},
    "cityId": {"type": "نص", "required": "لا", "allowed": "معرف موجود في locations.json", "note": "معرف المدينة. مطلوب عند ربط فرع أو سعر أو عرض بمدينة."},
    "cityNameAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم المدينة بالعربية."},
    "categoryId": {"type": "نص", "required": "نعم", "allowed": "معرف موجود في categories.json", "note": "معرف الفئة الرئيسية."},
    "categoryNameAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم الفئة بالعربية."},
    "departmentId": {"type": "نص", "required": "نعم", "allowed": "معرف موجود في departments.json", "note": "القسم الأعلى الذي تتبعه الفئة أو المتجر."},
    "departmentNameAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم القسم بالعربية."},
    "departmentIds": {"type": "قائمة", "required": "نعم", "allowed": "قائمة معرفات أقسام", "note": "أقسام المتجر. تُكتب كـ JSON مثل [\"dept_grocery\"]."},
    "icon": {"type": "نص", "required": "لا", "allowed": "رمز تعبيري", "note": "أيقونة القسم في الواجهة."},
    "sortOrder": {"type": "رقم", "required": "لا", "allowed": "رقم", "note": "ترتيب ظهور القسم. الأصغر أولاً."},
    "productId": {"type": "نص", "required": "نعم", "allowed": "معرف فريد", "note": "معرف المنتج الأساسي."},
    "productNameAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم المنتج بالعربية."},
    "brandAr": {"type": "نص", "required": "لا", "allowed": "", "note": "العلامة التجارية أو وصف المنتج."},
    "imageUrl": {"type": "نص", "required": "لا", "allowed": "رابط صورة", "note": "رابط صورة المنتج أو المتجر أو الإعلان."},
    "homeSuggested": {"type": "منطقي", "required": "لا", "allowed": "TRUE / FALSE", "note": "إظهار المنتج في المنتجات المقترحة بالرئيسية."},
    "variantId": {"type": "نص", "required": "شرطي", "allowed": "معرف موجود في products.json", "note": "مطلوب في prices.json وعروض المنتجات bundle/value، ويُحذف في store_value."},
    "packageSize": {"type": "رقم", "required": "نعم", "allowed": "رقم أكبر من صفر", "note": "حجم أو وزن العبوة."},
    "unit": {"type": "نص", "required": "نعم", "allowed": "كجم، لتر، قطعة، عبوة...", "note": "وحدة قياس العبوة."},
    "attributesAr": {"type": "نص", "required": "لا", "allowed": "", "note": "وصف إضافي للمتغير."},
    "storeId": {"type": "نص", "required": "شرطي", "allowed": "معرف موجود في stores.json", "note": "معرف المتجر. مطلوب في السعر العام وفي عروض المتجر."},
    "storeNameAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم المتجر بالعربية."},
    "homeScreenDisplay": {"type": "منطقي", "required": "لا", "allowed": "TRUE / FALSE", "note": "إظهار المتجر في قسم المتاجر المميزة."},
    "featuredInCat": {"type": "منطقي", "required": "لا", "allowed": "TRUE / FALSE", "note": "إبراز المتجر داخل فئته."},
    "branchGroupId": {"type": "نص", "required": "لا", "allowed": "معرف موجود في branchGroups", "note": "معرف مجموعة الفروع داخل المتجر."},
    "branchGroupNameAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم مجموعة الفروع بالعربية."},
    "branchId": {"type": "نص", "required": "لا", "allowed": "معرف موجود في branches.json", "note": "معرف الفرع. استخدمه لسعر أو عرض فرع واحد."},
    "branchIds": {"type": "نص", "required": "لا", "allowed": "قائمة معرفات", "note": "عدة فروع. تُفصل في ورقة offer_branchIds."},
    "branchNameAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم الفرع كما يظهر للعميل."},
    "addressAr": {"type": "نص", "required": "لا", "allowed": "", "note": "عنوان الفرع."},
    "category": {"type": "نص", "required": "لا", "allowed": "تصنيف نصي", "note": "تصنيف الفرع في البيانات السعودية."},
    "tasneed": {"type": "نص", "required": "لا", "allowed": "تصنيف نصي", "note": "تصنيف الفرع في البيانات المصرية."},
    "priceId": {"type": "نص", "required": "نعم", "allowed": "معرف فريد", "note": "معرف فريد لصف السعر."},
    "pricePiastres": {"type": "رقم", "required": "نعم", "allowed": "عدد صحيح بالقروش", "note": "السعر الحالي بالقروش: 1500 = 15.00."},
    "regularPricePiastres": {"type": "رقم", "required": "لا", "allowed": "عدد صحيح بالقروش", "note": "السعر قبل الخصم، ويُستخدم مع priceType=weekly_offer."},
    "priceType": {"type": "نص", "required": "لا", "allowed": "regular, weekly_offer", "note": "نوع السعر. الافتراضي regular."},
    "observationDate": {"type": "تاريخ", "required": "نعم", "allowed": "YYYY-MM-DD", "note": "تاريخ رصد السعر."},
    "sourceAr": {"type": "نص", "required": "لا", "allowed": "", "note": "مصدر السعر أو ملاحظة عنه."},
    "offerId": {"type": "نص", "required": "نعم", "allowed": "معرف فريد", "note": "معرف فريد للعرض."},
    "offerType": {"type": "نص", "required": "نعم", "allowed": "bundle, value, store_value", "note": "bundle لباكدج/كمية، value لقيمة مضافة، store_value لعرض متجر بدون منتج."},
    "titleAr": {"type": "نص", "required": "شرطي", "allowed": "", "note": "عنوان العرض. مطلوب في store_value."},
    "conditionAr": {"type": "نص", "required": "نعم", "allowed": "", "note": "شرح شرط العرض كما يظهر للعميل."},
    "bundleQuantity": {"type": "رقم", "required": "لا", "allowed": "عدد صحيح أكبر من صفر", "note": "عدد القطع في الباكدج. الافتراضي 1."},
    "bundlePricePiastres": {"type": "رقم", "required": "لا", "allowed": "عدد صحيح بالقروش", "note": "إجمالي سعر الباكدج. اتركه فارغاً في عروض value."},
    "startDate": {"type": "تاريخ", "required": "نعم", "allowed": "YYYY-MM-DD", "note": "بداية صلاحية العرض أو الإعلان."},
    "endDate": {"type": "تاريخ", "required": "نعم", "allowed": "YYYY-MM-DD", "note": "نهاية صلاحية العرض أو الإعلان."},
    "homeOfferDisplay": {"type": "منطقي", "required": "لا", "allowed": "TRUE / FALSE", "note": "إظهار العرض في قسم العروض المميزة بالرئيسية."},
    "sponsored": {"type": "منطقي", "required": "لا", "allowed": "TRUE / FALSE", "note": "تمييز العرض أو الإعلان كممول."},
    "cityIds": {"type": "نص", "required": "لا", "allowed": "قائمة معرفات مدن", "note": "تقييد العرض بمدن محددة. تُفصل في ورقة offer_cityIds."},
    "adId": {"type": "نص", "required": "نعم", "allowed": "معرف فريد", "note": "معرف فريد للإعلان."},
    "subtitleAr": {"type": "نص", "required": "لا", "allowed": "", "note": "وصف قصير يظهر تحت عنوان الإعلان."},
    "kickerAr": {"type": "نص", "required": "لا", "allowed": "", "note": "كلمة صغيرة فوق عنوان الإعلان."},
    "badgeAr": {"type": "نص", "required": "لا", "allowed": "", "note": "شارة الزاوية. الافتراضي: إعلان."},
    "ctaTextAr": {"type": "نص", "required": "لا", "allowed": "", "note": "نص زر الإجراء. الافتراضي: اعرف المزيد."},
    "targetType": {"type": "نص", "required": "نعم", "allowed": "external, store, offers, products, category", "note": "نوع هدف الإعلان."},
    "targetValue": {"type": "نص", "required": "حسب النوع", "allowed": "رابط أو معرف", "note": "رابط خارجي، أو storeId، أو categoryId حسب targetType."},
    "scope": {"type": "نص", "required": "لا", "allowed": "all, governorate, city", "note": "نطاق ظهور الإعلان."},
    "placement": {"type": "نص", "required": "لا", "allowed": "home_hero, offers_top, home_native", "note": "موضع الإعلان. الافتراضي home_hero. home_native محجوز للتطوير."},
    "priority": {"type": "رقم", "required": "لا", "allowed": "رقم", "note": "الأكبر يظهر أولاً."},
    "active": {"type": "منطقي", "required": "لا", "allowed": "TRUE / FALSE", "note": "FALSE لإيقاف العنصر دون حذفه."},
    "schemaVersion": {"type": "رقم", "required": "نعم", "allowed": "رقم", "note": "إصدار مخطط البيانات."},
    "dataVersion": {"type": "نص", "required": "نعم", "allowed": "YYYY.MM.DD.NNN", "note": "إصدار البيانات. ارفعه بعد كل تعديل."},
    "key": {"type": "نص", "required": "نعم", "allowed": "", "note": "مفتاح الملف داخل manifest."},
    "fileName": {"type": "نص", "required": "نعم", "allowed": "", "note": "اسم ملف JSON."},
}

SCHEMA_FIELDS: dict[str, list[str]] = {
    "locations": ["governorateId", "governorateNameAr", "cityId", "cityNameAr"],
    "departments": ["departmentId", "departmentNameAr", "icon", "sortOrder", "active"],
    "categories": ["categoryId", "categoryNameAr", "departmentId"],
    "products": ["productId", "productNameAr", "brandAr", "categoryId", "imageUrl", "homeSuggested", "variantId", "packageSize", "unit", "attributesAr"],
    "stores": ["storeId", "storeNameAr", "imageUrl", "homeScreenDisplay", "categoryId", "departmentIds", "featuredInCat", "branchGroupId", "branchGroupNameAr"],
    "branches": ["branchId", "storeId", "branchNameAr", "governorateId", "cityId", "addressAr", "category", "tasneed", "branchGroupId"],
    "prices": ["priceId", "variantId", "storeId", "branchId", "branchGroupId", "cityId", "pricePiastres", "regularPricePiastres", "priceType", "observationDate", "sourceAr"],
    "offers": ["offerId", "offerType", "variantId", "storeId", "branchId", "branchIds", "branchGroupIds", "cityIds", "titleAr", "conditionAr", "bundleQuantity", "bundlePricePiastres", "startDate", "endDate", "homeOfferDisplay", "sponsored"],
    "ads": ["adId", "imageUrl", "titleAr", "subtitleAr", "kickerAr", "badgeAr", "ctaTextAr", "targetType", "targetValue", "scope", "governorateId", "cityId", "placement", "priority", "startDate", "endDate", "sponsored", "active"],
    "manifest": ["schemaVersion", "dataVersion", "key", "fileName"],
}

ENUMS: dict[str, dict[str, list[str]]] = {
    "prices": {"priceType": ["regular", "weekly_offer"]},
    "offers": {"offerType": ["bundle", "value", "store_value"]},
    "ads": {
        "targetType": ["external", "store", "offers", "products", "category"],
        "placement": ["home_hero", "offers_top", "home_native"],
        "scope": ["all", "governorate", "city"],
    },
}

SHEET_DESCRIPTIONS: dict[str, dict[str, str]] = {
    "locations": {"locations": "المحافظات.", "cities": "المدن التابعة لكل محافظة."},
    "departments": {"departments": "الأقسام الرئيسية التي تتبعها الفئات والمتاجر."},
    "categories": {"categories": "الفئات الرئيسية وربطها بالأقسام."},
    "products": {"products": "المنتجات الأساسية.", "variants": "متغيرات العبوة التابعة للمنتجات."},
    "stores": {"stores": "المتاجر.", "branchGroups": "مجموعات الفروع التابعة للمتاجر."},
    "branches": {"branches": "الفروع وربطها بالمتجر والمدينة."},
    "prices": {"prices": "أسعار القطعة المفردة (عادي أو عرض أسبوعي)."},
    "offers": {
        "offers": "العروض: باكدجات، قيمة مضافة، عروض متجر. لا تحتوي أعمدة المصفوفات.",
        "offer_branchIds": "قائمة الفروع المرتبطة بكل عرض (بديل عن branchIds).",
        "offer_branchGroupIds": "قائمة مجموعات الفروع المرتبطة بكل عرض.",
        "offer_cityIds": "قائمة المدن التي يظهر فيها العرض.",
    },
    "ads": {"ads": "الإعلانات الممولة ومواضعها."},
    "manifest": {"manifest": "إصدار البيانات.", "files": "قائمة ملفات JSON داخل المجلد."},
}


def load_json(folder: Path, name: str) -> Any:
    with (folder / f"{name}.json").open("r", encoding="utf-8-sig") as fh:
        return json.load(fh)


def excel_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else value
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def ordered_headers(rows: list[dict[str, Any]], preferred: Iterable[str]) -> list[str]:
    # نُبقي كل أعمدة المخطط المفضلة حتى لو كانت الورقة فارغة،
    # ثم نضيف أي حقول إضافية واردة في البيانات.
    headers = list(preferred)
    for row in rows:
        for key in row.keys():
            if key not in headers:
                headers.append(key)
    return headers


def style_header(ws: Worksheet, headers: list[str]) -> None:
    for col, field in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=field)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
        meta = FIELD_META.get(field)
        if meta:
            text = f"{meta['note']}\nالنوع: {meta['type']}\nالإلزام: {meta['required']}"
            if meta["allowed"]:
                text += f"\nالقيم: {meta['allowed']}"
            comment = Comment(text, "Wafra")
            comment.width = 320
            comment.height = 130
            cell.comment = comment
    ws.row_dimensions[1].height = 30


def style_data_cell(cell, field: str, row_index: int) -> None:
    cell.font = BODY_FONT
    cell.border = BORDER
    cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
    if row_index % 2 == 0:
        cell.fill = BAND_FILL
    if field in {"homeSuggested", "homeScreenDisplay", "featuredInCat", "homeOfferDisplay", "sponsored", "active"}:
        cell.alignment = Alignment(horizontal="center", vertical="center")
    if field in {"pricePiastres", "regularPricePiastres", "bundlePricePiastres"}:
        cell.number_format = "#,##0"
        cell.alignment = Alignment(horizontal="center", vertical="center")
    if field in {"packageSize", "bundleQuantity", "priority", "schemaVersion", "sortOrder"}:
        cell.alignment = Alignment(horizontal="center", vertical="center")


def auto_width(ws: Worksheet, headers: list[str], rows: list[dict[str, Any]]) -> None:
    for col, field in enumerate(headers, 1):
        longest = len(str(field))
        for row in rows:
            value = row.get(field)
            if value is None:
                continue
            if isinstance(value, bool):
                text = "TRUE" if value else "FALSE"
            else:
                text = str(value)
            # URLs and long Arabic text need more room, but not unbounded.
            longest = max(longest, min(len(text), 58))
        if field in {"conditionAr", "titleAr", "addressAr", "sourceAr", "subtitleAr", "note"}:
            width = min(max(longest + 2, 18), 55)
        elif field == "imageUrl":
            width = 46
        else:
            width = min(max(longest + 3, 12), 42)
        ws.column_dimensions[get_column_letter(col)].width = width


def add_table_sheet(
    wb: Workbook,
    title: str,
    rows: list[dict[str, Any]],
    preferred: Iterable[str],
    *,
    tab_color: str = "D1D5DB",
    enum_fields: dict[str, list[str]] | None = None,
) -> None:
    ws = wb.create_sheet(title)
    ws.sheet_view.rightToLeft = True
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = tab_color
    headers = ordered_headers(rows, preferred)
    style_header(ws, headers)
    for row_index, row in enumerate(rows, 2):
        for col, field in enumerate(headers, 1):
            cell = ws.cell(row=row_index, column=col, value=excel_value(row.get(field)))
            style_data_cell(cell, field, row_index)
        ws.row_dimensions[row_index].height = 24
    auto_width(ws, headers, rows)
    last_col = get_column_letter(len(headers))
    last_row = max(1, len(rows) + 1)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{last_col}{last_row}"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True

    if enum_fields:
        for field, values in enum_fields.items():
            if field not in headers:
                continue
            col = get_column_letter(headers.index(field) + 1)
            dv = DataValidation(
                type="list",
                formula1='"' + ",".join(values) + '"',
                allow_blank=True,
            )
            dv.error = "اختر قيمة من القائمة المسموحة."
            dv.errorTitle = "قيمة غير صالحة"
            dv.prompt = "القيم المسموحة: " + ", ".join(values)
            dv.promptTitle = field
            ws.add_data_validation(dv)
            dv.add(f"{col}2:{col}1000")


def add_section(ws: Worksheet, row: int, text: str) -> int:
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
    cell = ws.cell(row=row, column=1, value=text)
    cell.fill = SECTION_FILL
    cell.font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    cell.alignment = Alignment(horizontal="right", vertical="center")
    ws.row_dimensions[row].height = 24
    return row + 1


def add_readme_sheet(
    wb: Workbook,
    file_key: str,
    country_label: str,
    description: str,
    sheet_notes: dict[str, str],
    export_notes: list[str],
) -> None:
    ws = wb.create_sheet("_README", 0)
    ws.sheet_view.rightToLeft = True
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = BRAND_RED
    ws.column_dimensions["A"].width = 27
    ws.column_dimensions["B"].width = 17
    ws.column_dimensions["C"].width = 13
    ws.column_dimensions["D"].width = 80

    ws.merge_cells("A1:D1")
    title = ws["A1"]
    title.value = f"وفرة — دليل تعديل {file_key}.xlsx — {country_label}"
    title.fill = SECTION_FILL
    title.font = Font(name="Arial", size=14, bold=True, color="FFFFFF")
    title.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 34

    ws.merge_cells("A2:D2")
    desc = ws["A2"]
    desc.value = description
    desc.font = BODY_FONT
    desc.fill = NOTE_FILL
    desc.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
    ws.row_dimensions[2].height = 34

    row = 4
    row = add_section(ws, row, "قواعد التعديل")
    rules = [
        "لا تغيّر أسماء الأوراق أو أسماء الأعمدة؛ لأن سكربت التصدير يعتمد عليها.",
        "الأوراق التي تبدأ بـ _ (مثل _README و_LOOKUPS) هي أوراق مساعدة ولا تُصدّر إلى JSON.",
        "القيم المنطقية تُكتب TRUE أو FALSE، والتواريخ بصيغة YYYY-MM-DD.",
        "الأسعار كلها بالقروش: 1500 = 15.00.",
        "لا تضع سعر قطعة مفردة في offers.json؛ الأسعار في prices.json.",
        "راجع DATA_REFERENCE_AR.md قبل إضافة نوع عرض أو إعلان جديد.",
    ]
    for item in rules:
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
        cell = ws.cell(row=row, column=1, value="• " + item)
        cell.font = BODY_FONT
        cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
        ws.row_dimensions[row].height = 22
        row += 1

    row += 1
    row = add_section(ws, row, "الأوراق")
    for sheet_name, note in sheet_notes.items():
        ws.cell(row=row, column=1, value=sheet_name).font = BOLD_FONT
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=4)
        cell = ws.cell(row=row, column=2, value=note)
        cell.font = BODY_FONT
        cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
        ws.row_dimensions[row].height = 22
        row += 1

    row += 1
    row = add_section(ws, row, "الحقول والقيم المسموحة")
    headers = ["الحقل", "النوع", "إلزامي", "القيم المسموحة / ملاحظات"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col, value=header)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER
    row += 1
    for field in SCHEMA_FIELDS.get(file_key, []):
        meta = FIELD_META.get(field, {"type": "نص", "required": "لا", "allowed": "", "note": ""})
        values = [field, meta["type"], meta["required"], (meta.get("allowed", "") + (" — " if meta.get("allowed") and meta.get("note") else "") + meta.get("note", "")).strip(" —")]
        for col, value in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=value)
            cell.font = BODY_FONT
            cell.border = BORDER
            cell.alignment = Alignment(horizontal="right", vertical="top", wrap_text=True)
        ws.row_dimensions[row].height = 26
        row += 1

    row += 1
    row = add_section(ws, row, "ملاحظات التصدير إلى JSON")
    for item in export_notes:
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
        cell = ws.cell(row=row, column=1, value="• " + item)
        cell.font = BODY_FONT
        cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
        ws.row_dimensions[row].height = 22
        row += 1

    row += 1
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
    note = ws.cell(row=row, column=1, value="بعد التعديل: شغّل python scripts/import_xlsx.py --country sa أو --country eg، ثم راجع قائمة التحقق في DATA_REFERENCE_AR.md.")
    note.font = Font(name="Arial", size=10, bold=True, color="7C5A0B")
    note.fill = PatternFill("solid", fgColor="FFF8E6")
    note.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 26
    ws.freeze_panes = "A4"


def add_lookups_sheet(wb: Workbook, lookups: list[dict[str, str]]) -> None:
    if not lookups:
        return
    ws = wb.create_sheet("_LOOKUPS")
    ws.sheet_view.rightToLeft = True
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = "0E9F6E"
    headers = ["type", "id", "labelAr", "extra"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER
    for row_index, item in enumerate(sorted(lookups, key=lambda x: (x["type"], x["id"])), 2):
        for col, field in enumerate(headers, 1):
            cell = ws.cell(row=row_index, column=col, value=item.get(field, ""))
            cell.font = BODY_FONT
            cell.border = BORDER
            cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
            if row_index % 2 == 0:
                cell.fill = BAND_FILL
        ws.row_dimensions[row_index].height = 22
    ws.column_dimensions["A"].width = 20
    ws.column_dimensions["B"].width = 34
    ws.column_dimensions["C"].width = 42
    ws.column_dimensions["D"].width = 42
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:D{max(1, len(lookups) + 1)}"


def build_lookups(data: dict[str, Any], include: set[str]) -> list[dict[str, str]]:
    lookups: list[dict[str, str]] = []
    if "departmentId" in include:
        for department in data.get("departments", []):
            lookups.append({
                "type": "departmentId",
                "id": department.get("departmentId", ""),
                "labelAr": department.get("departmentNameAr", ""),
                "extra": department.get("icon", ""),
            })
    if "categoryId" in include:
        for category in data.get("categories", []):
            lookups.append({
                "type": "categoryId",
                "id": category.get("categoryId", ""),
                "labelAr": category.get("categoryNameAr", ""),
                "extra": category.get("departmentId", ""),
            })
    if "storeId" in include:
        for store in data.get("stores", []):
            lookups.append({
                "type": "storeId",
                "id": store.get("storeId", ""),
                "labelAr": store.get("storeNameAr", ""),
                "extra": store.get("categoryId", ""),
            })
    if "branchGroupId" in include:
        for store in data.get("stores", []):
            for group in store.get("branchGroups", []) or []:
                lookups.append({
                    "type": "branchGroupId",
                    "id": group.get("branchGroupId", ""),
                    "labelAr": group.get("branchGroupNameAr", ""),
                    "extra": store.get("storeId", ""),
                })
    if "branchId" in include:
        for branch in data.get("branches", []):
            lookups.append({
                "type": "branchId",
                "id": branch.get("branchId", ""),
                "labelAr": branch.get("branchNameAr", ""),
                "extra": f"{branch.get('storeId', '')} / {branch.get('cityId', '')}",
            })
    if "variantId" in include:
        for product in data.get("products", []):
            for variant in product.get("variants", []) or []:
                lookups.append({
                    "type": "variantId",
                    "id": variant.get("variantId", ""),
                    "labelAr": f"{product.get('productNameAr', '')} — {variant.get('packageSize', '')} {variant.get('unit', '')}",
                    "extra": product.get("productId", ""),
                })
    if "cityId" in include or "governorateId" in include:
        for governorate in data.get("locations", []):
            if "governorateId" in include:
                lookups.append({
                    "type": "governorateId",
                    "id": governorate.get("governorateId", ""),
                    "labelAr": governorate.get("governorateNameAr", ""),
                    "extra": "",
                })
            for city in governorate.get("cities", []) or []:
                if "cityId" in include:
                    lookups.append({
                        "type": "cityId",
                        "id": city.get("cityId", ""),
                        "labelAr": city.get("cityNameAr", ""),
                        "extra": governorate.get("governorateId", ""),
                    })
    return lookups


def make_workbook(
    out_dir: Path,
    file_key: str,
    data: Any,
    data_full: dict[str, Any],
    country_label: str,
) -> Path:
    wb = Workbook()
    # احذف الورقة الافتراضية بعد إنشاء أول ورقة حقيقية.
    default_ws = wb.active

    sheet_notes = SHEET_DESCRIPTIONS.get(file_key, {})
    description = {
        "locations": "المحافظات والمدن. ورقة cities مرتبطة بالمحافظة عبر governorateId.",
        "departments": "الأقسام الرئيسية المستخدمة في الواجهة، وترتيب ظهورها.",
        "categories": "الفئات الرئيسية المستخدمة في المنتجات والمتاجر، مع ربط كل فئة بقسم.",
        "products": "المنتجات ومتغيرات العبوة. ورقة variants مرتبطة بالمنتج عبر productId.",
        "stores": "المتاجر ومجموعات الفروع. ورقة branchGroups مرتبطة بالمتجر عبر storeId.",
        "branches": "الفروع وربطها بالمتجر والمدينة ومجموعة الفروع.",
        "prices": "أسعار القطعة المفردة فقط. لا تضع عروض الباكدج هنا.",
        "offers": "الباكدجات وعروض الكمية والقيمة المضافة وعروض المتجر. المصفوفات مفصولة في أوراق مرتبطة.",
        "ads": "الإعلانات الممولة ومواضعها ونطاق ظهورها.",
        "manifest": "إصدار البيانات وقائمة الملفات.",
    }[file_key]
    export_notes = {
        "locations": [
            "أعد بناء locations.json من ورقة locations، ثم أضف مصفوفة cities لكل محافظة من ورقة cities.",
            "لا تكرر governorateId في ورقة cities كحقل مستقل داخل كائن المدينة؛ هو مفتاح ربط فقط.",
        ],
        "departments": [
            "كل صف في ورقة departments هو قسم مستقل.",
            "departmentId ثابت ويُستخدم في categories.departmentId وstores.departmentIds.",
            "active=FALSE يخفي القسم من الواجهة دون حذف بياناته.",
        ],
        "categories": [
            "كل صف في ورقة categories هو كائن فئة مستقل.",
            "departmentId يجب أن يطابق معرفاً موجوداً في departments.json.",
        ],
        "products": [
            "أعد بناء products.json من ورقة products، ثم أضف مصفوفة variants لكل منتج من ورقة variants باستخدام productId.",
            "packageSize رقم، وunit نص (كجم/لتر/قطعة...).",
        ],
        "stores": [
            "أعد بناء stores.json من ورقة stores، ثم أضف مصفوفة branchGroups لكل متجر من ورقة branchGroups.",
            "departmentIds قائمة معرفات أقسام بصيغة JSON، مثل [\"dept_grocery\"].",
            "branchGroupId يجب أن يطابق القيمة المستخدمة في branches.json وprices.json وoffers.json.",
        ],
        "branches": ["كل صف في ورقة branches هو فرع مستقل. تأكد من وجود storeId وcityId."],
        "prices": [
            "كل صف في ورقة prices هو صف سعر مستقل.",
            "استخدم branchId لسعر فرع، أو branchGroupId لمجموعة، أو storeId فقط لسعر المتجر العام.",
            "priceType المسموح: regular أو weekly_offer. regularPricePiastres اختياري.",
        ],
        "offers": [
            "أعد بناء offers.json من ورقة offers، ثم أضف branchIds وbranchGroupIds وcityIds من الأوراق المرتبطة بنفس offerId.",
            "لا تضع سعر قطعة مفردة هنا. استخدم prices.json.",
            "store_value لا يحتوي variantId ويحتوي titleAr.",
        ],
        "ads": [
            "كل صف في ورقة ads هو إعلان مستقل.",
            "targetType يحدد معنى targetValue: رابط خارجي أو storeId أو categoryId.",
            "placement الافتراضي home_hero. استخدم offers_top للإعلان أعلى صفحة العروض.",
        ],
        "manifest": [
            "manifest.xlsx للتوثيق والمراجعة. عدّل manifest.json مباشرة عند رفع dataVersion.",
            "ورقة files تحتوي مفتاح الملف واسمه.",
        ],
    }[file_key]
    add_readme_sheet(wb, file_key, country_label, description, sheet_notes, export_notes)

    enums = ENUMS.get(file_key, {})
    preferred = {
        "locations": {
            "locations": ["governorateId", "governorateNameAr"],
            "cities": ["governorateId", "cityId", "cityNameAr"],
        },
        "departments": {"departments": ["departmentId", "departmentNameAr", "icon", "sortOrder", "active"]},
        "categories": {"categories": ["categoryId", "categoryNameAr", "departmentId"]},
        "products": {
            "products": ["productId", "productNameAr", "brandAr", "categoryId", "imageUrl", "homeSuggested"],
            "variants": ["productId", "variantId", "packageSize", "unit", "attributesAr"],
        },
        "stores": {
            "stores": ["storeId", "storeNameAr", "imageUrl", "homeScreenDisplay", "categoryId", "departmentIds", "featuredInCat"],
            "branchGroups": ["storeId", "branchGroupId", "branchGroupNameAr"],
        },
        "branches": {"branches": ["branchId", "storeId", "branchNameAr", "governorateId", "cityId", "addressAr", "category", "tasneed", "branchGroupId"]},
        "prices": {"prices": ["priceId", "variantId", "storeId", "branchId", "branchGroupId", "cityId", "pricePiastres", "regularPricePiastres", "priceType", "observationDate", "sourceAr"]},
        "offers": {
            "offers": ["offerId", "offerType", "variantId", "storeId", "branchId", "titleAr", "conditionAr", "bundleQuantity", "bundlePricePiastres", "startDate", "endDate", "homeOfferDisplay", "sponsored"],
            "offer_branchIds": ["offerId", "branchId"],
            "offer_branchGroupIds": ["offerId", "branchGroupId"],
            "offer_cityIds": ["offerId", "cityId"],
        },
        "ads": {"ads": ["adId", "imageUrl", "titleAr", "subtitleAr", "kickerAr", "badgeAr", "ctaTextAr", "targetType", "targetValue", "scope", "governorateId", "cityId", "placement", "priority", "startDate", "endDate", "sponsored", "active"]},
        "manifest": {"manifest": ["key", "value"], "files": ["key", "fileName"]},
    }[file_key]

    if file_key == "locations":
        main_rows = [{"governorateId": g.get("governorateId", ""), "governorateNameAr": g.get("governorateNameAr", "")} for g in data]
        city_rows = []
        for g in data:
            for city in g.get("cities", []) or []:
                city_rows.append({
                    "governorateId": g.get("governorateId", ""),
                    "cityId": city.get("cityId", ""),
                    "cityNameAr": city.get("cityNameAr", ""),
                })
        add_table_sheet(wb, "locations", main_rows, preferred["locations"], tab_color=BRAND_BLACK)
        add_table_sheet(wb, "cities", city_rows, preferred["cities"])

    elif file_key == "departments":
        add_table_sheet(wb, "departments", data, preferred["departments"], tab_color=BRAND_BLACK)

    elif file_key == "categories":
        add_table_sheet(wb, "categories", data, preferred["categories"], tab_color=BRAND_BLACK)

    elif file_key == "products":
        main_rows = [{k: v for k, v in p.items() if k != "variants"} for p in data]
        variant_rows = []
        for product in data:
            for variant in product.get("variants", []) or []:
                variant_rows.append({"productId": product.get("productId", ""), **variant})
        add_table_sheet(wb, "products", main_rows, preferred["products"], tab_color=BRAND_BLACK)
        add_table_sheet(wb, "variants", variant_rows, preferred["variants"])

    elif file_key == "stores":
        main_rows = [{k: v for k, v in s.items() if k != "branchGroups"} for s in data]
        group_rows = []
        for store in data:
            for group in store.get("branchGroups", []) or []:
                group_rows.append({"storeId": store.get("storeId", ""), **group})
        add_table_sheet(wb, "stores", main_rows, preferred["stores"], tab_color=BRAND_BLACK)
        add_table_sheet(wb, "branchGroups", group_rows, preferred["branchGroups"])

    elif file_key == "branches":
        add_table_sheet(wb, "branches", data, preferred["branches"], tab_color=BRAND_BLACK)

    elif file_key == "prices":
        add_table_sheet(wb, "prices", data, preferred["prices"], tab_color=BRAND_BLACK, enum_fields=enums)

    elif file_key == "offers":
        main_rows = []
        branch_id_rows = []
        group_rows = []
        city_rows = []
        excluded = {"branchIds", "branchGroupIds", "cityIds"}
        for offer in data:
            main_rows.append({k: v for k, v in offer.items() if k not in excluded})
            for branch_id in offer.get("branchIds", []) or []:
                branch_id_rows.append({"offerId": offer.get("offerId", ""), "branchId": branch_id})
            for group_id in offer.get("branchGroupIds", []) or []:
                group_rows.append({"offerId": offer.get("offerId", ""), "branchGroupId": group_id})
            for city_id in offer.get("cityIds", []) or []:
                city_rows.append({"offerId": offer.get("offerId", ""), "cityId": city_id})
        add_table_sheet(wb, "offers", main_rows, preferred["offers"], tab_color=BRAND_BLACK, enum_fields=enums)
        add_table_sheet(wb, "offer_branchIds", branch_id_rows, preferred["offer_branchIds"])
        add_table_sheet(wb, "offer_branchGroupIds", group_rows, preferred["offer_branchGroupIds"])
        add_table_sheet(wb, "offer_cityIds", city_rows, preferred["offer_cityIds"])

    elif file_key == "ads":
        add_table_sheet(wb, "ads", data, preferred["ads"], tab_color=BRAND_BLACK, enum_fields=enums)

    elif file_key == "manifest":
        main_rows = [
            {"key": "schemaVersion", "value": data.get("schemaVersion")},
            {"key": "dataVersion", "value": data.get("dataVersion")},
        ]
        file_rows = [{"key": key, "fileName": value} for key, value in (data.get("files") or {}).items()]
        add_table_sheet(wb, "manifest", main_rows, preferred["manifest"], tab_color=BRAND_BLACK)
        add_table_sheet(wb, "files", file_rows, preferred["files"])

    # ورقة مساعدات المعرفات حسب الملف.
    lookup_includes = {
        "categories": {"departmentId"},
        "products": {"categoryId"},
        "stores": {"categoryId", "departmentId", "branchGroupId"},
        "branches": {"storeId", "branchGroupId", "branchId", "cityId", "governorateId"},
        "prices": {"variantId", "storeId", "branchId", "branchGroupId", "cityId"},
        "offers": {"variantId", "storeId", "branchId", "branchGroupId", "cityId"},
        "ads": {"storeId", "categoryId"},
    }.get(file_key, set())
    if lookup_includes:
        add_lookups_sheet(wb, build_lookups(data_full, lookup_includes))

    # إزالة الورقة الافتراضية إن لم تُستخدم.
    if default_ws.title in wb.sheetnames and default_ws.max_row == 1 and default_ws.max_column == 1:
        wb.remove(default_ws)

    wb.active = 0
    wb.properties.creator = "Wafra"
    wb.properties.title = f"{file_key} — {country_label}"
    wb.properties.description = "نسخة Excel قابلة للتعديل من بيانات وفرة."
    out_path = out_dir / f"{file_key}.xlsx"
    wb.save(out_path)
    return out_path


def write_folder_readme(out_dir: Path, country_label: str, workbooks: list[str]) -> None:
    content = f"""# نسخ Excel — {country_label}

هذه المجلدات تحتوي نسخاً قابلة للتعديل من ملفات JSON. كل ملف JSON له Workbook مستقل.

## الملفات

{chr(10).join(f"- `{name}`" for name in workbooks)}

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
"""
    (out_dir / "README.md").write_text(content, encoding="utf-8")


def main() -> None:
    for source_name, (country_label, out_name) in COUNTRIES.items():
        source = ROOT / source_name
        out_dir = ROOT / out_name
        out_dir.mkdir(parents=True, exist_ok=True)

        data_full: dict[str, Any] = {}
        for file_key in ["locations", "departments", "categories", "products", "stores", "branches", "prices", "offers", "ads", "manifest"]:
            data_full[file_key] = load_json(source, file_key)

        workbooks: list[str] = []
        for file_key in ["locations", "departments", "categories", "products", "stores", "branches", "prices", "offers", "ads", "manifest"]:
            make_workbook(out_dir, file_key, data_full[file_key], data_full, country_label)
            workbooks.append(f"{file_key}.xlsx")

        write_folder_readme(out_dir, country_label, workbooks)
        print(f"Created {out_dir} ({len(workbooks)} Excel files)")


if __name__ == "__main__":
    main()
