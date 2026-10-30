#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تحويل ملفات Excel المعدّلة إلى JSON لموقع وفرة.

الاستخدام:
    python scripts/import_xlsx.py --country sa
    python scripts/import_xlsx.py --country eg
    python scripts/import_xlsx.py --country all --dry-run

ملاحظات:
- يقرأ كل Workbook من data-sa-xlsx أو data-eg-xlsx ويبني ملف JSON المقابل.
- يتجاهل أوراق المساعدة التي تبدأ بـ _README أو _LOOKUPS.
- يتحقق من المعرفات والمراجع الأساسية قبل الكتابة.
- ينشئ نسخة احتياطية داخل data-*/‎.backup قبل تعديل أي ملف.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
COUNTRIES = {
    "sa": ("data-sa", "data-sa-xlsx", "السعودية"),
    "eg": ("data-eg", "data-eg-xlsx", "مصر"),
}
FILES = [
    "locations",
    "departments",
    "categories",
    "products",
    "stores",
    "branches",
    "prices",
    "offers",
    "ads",
    "manifest",
]

BOOLEAN_FIELDS = {
    "homeSuggested",
    "homeScreenDisplay",
    "featuredInCat",
    "homeOfferDisplay",
    "sponsored",
    "active",
}
INTEGER_FIELDS = {
    "bundleQuantity",
    "priority",
    "schemaVersion",
    "sortOrder",
    "pricePiastres",
    "regularPricePiastres",
    "bundlePricePiastres",
}
NUMBER_FIELDS = {"packageSize", *INTEGER_FIELDS}
DATE_FIELDS = {"observationDate", "startDate", "endDate"}
ARRAY_FIELDS = {"branchIds", "branchGroupIds", "cityIds", "departmentIds"}
STRIPPED_FIELDS = {
    "governorateId",
    "cityId",
    "categoryId",
    "departmentId",
    "productId",
    "variantId",
    "storeId",
    "branchId",
    "branchGroupId",
    "offerId",
    "adId",
    "priceId",
    "targetType",
    "targetValue",
    "scope",
    "placement",
    "priceType",
    "offerType",
    "key",
    "fileName",
    "dataVersion",
    "imageUrl",
}


class ImportErrorWithContext(Exception):
    """خطأ قابل للعرض للمستخدم مع سياق الورقة والصف."""


def arabic_digits_to_latin(text: str) -> str:
    return text.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))


def parse_boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"true", "1", "yes", "y", "نعم", "صح", "صحيح"}:
        return True
    if text in {"false", "0", "no", "n", "لا", "خطأ", "غير صحيح"}:
        return False
    raise ValueError(f"قيمة منطقية غير مفهومة: {value!r}")


def parse_number(value: Any, field: str) -> int | float:
    if isinstance(value, bool):
        raise ValueError(f"قيمة رقمية غير صالحة في {field}: {value!r}")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        number = value
    else:
        text = arabic_digits_to_latin(str(value)).strip()
        text = text.replace("٬", "").replace(",", "").replace(" ", "")
        if not text:
            raise ValueError(f"قيمة رقمية فارغة في {field}")
        number = float(text)

    if field in INTEGER_FIELDS:
        if not float(number).is_integer():
            raise ValueError(f"يجب أن يكون {field} عدداً صحيحاً: {value!r}")
        return int(number)
    return int(number) if float(number).is_integer() else float(number)


def parse_array(value: Any, field: str) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if value is None or value == "":
        return []

    text = str(value).strip()
    if not text:
        return []

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        raise ValueError("JSON ليس قائمة")
    except json.JSONDecodeError:
        # سماح بكتابة بسيطة: dept_grocery, dept_fresh
        parts = [part.strip().strip('"').strip("'") for part in re.split(r"[,;|]", text)]
        return [part for part in parts if part]


def parse_value(field: str, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str) and value.strip() == "":
        # لا نحذف المسافات من الحقول النصية حتى لا نغيّر بيانات المستخدم.
        # أما الحقول الرقمية والمنطقية والمعرفات فتُعامل كقيمة فارغة.
        if field in BOOLEAN_FIELDS or field in NUMBER_FIELDS or field in DATE_FIELDS:
            return None
        if field in ARRAY_FIELDS or field in STRIPPED_FIELDS:
            return None
        return value

    if field in BOOLEAN_FIELDS:
        return parse_boolean(value)
    if field in NUMBER_FIELDS:
        return parse_number(value, field)
    if field in DATE_FIELDS:
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        return str(value).strip()
    if field in ARRAY_FIELDS:
        return parse_array(value, field)

    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value)
    return text.strip() if field in STRIPPED_FIELDS else text


def read_sheet(path: Path, sheet_name: str, *, required: bool = True) -> list[dict[str, Any]]:
    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        if sheet_name not in wb.sheetnames:
            if required:
                raise ImportErrorWithContext(f"{path.name}: الورقة المطلوبة «{sheet_name}» غير موجودة.")
            return []

        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        headers = []
        for value in rows[0]:
            headers.append(str(value).strip() if value is not None else "")

        result: list[dict[str, Any]] = []
        for row_index, row in enumerate(rows[1:], start=2):
            item: dict[str, Any] = {}
            for column_index, header in enumerate(headers):
                if not header or column_index >= len(row):
                    continue
                raw_value = row[column_index]
                try:
                    value = parse_value(header, raw_value)
                except ValueError as exc:
                    raise ImportErrorWithContext(
                        f"{path.name} / {sheet_name} / الصف {row_index} / العمود {header}: {exc}"
                    ) from exc
                if value is not None:
                    item[header] = value
            if item:
                result.append(item)
        return result
    finally:
        wb.close()


def rebuild_locations(path: Path) -> list[dict[str, Any]]:
    locations = read_sheet(path, "locations")
    cities = read_sheet(path, "cities")
    for location in locations:
        governorate_id = location.get("governorateId")
        location_cities = [
            {key: value for key, value in city.items() if key != "governorateId"}
            for city in cities
            if city.get("governorateId") == governorate_id
        ]
        if location_cities:
            location["cities"] = location_cities
    return locations


def rebuild_products(path: Path) -> list[dict[str, Any]]:
    products = read_sheet(path, "products")
    variants = read_sheet(path, "variants")
    for product in products:
        product_id = product.get("productId")
        product_variants = [
            {key: value for key, value in variant.items() if key != "productId"}
            for variant in variants
            if variant.get("productId") == product_id
        ]
        if product_variants:
            product["variants"] = product_variants
    return products


def rebuild_stores(path: Path) -> list[dict[str, Any]]:
    stores = read_sheet(path, "stores")
    groups = read_sheet(path, "branchGroups", required=False)
    for store in stores:
        store_id = store.get("storeId")
        store_groups = [
            {key: value for key, value in group.items() if key != "storeId"}
            for group in groups
            if group.get("storeId") == store_id
        ]
        if store_groups:
            store["branchGroups"] = store_groups
    return stores


def rebuild_offers(path: Path) -> list[dict[str, Any]]:
    offers = read_sheet(path, "offers")
    by_id = {offer.get("offerId"): offer for offer in offers}
    arrays = {
        "branchIds": ("offer_branchIds", "branchId"),
        "branchGroupIds": ("offer_branchGroupIds", "branchGroupId"),
        "cityIds": ("offer_cityIds", "cityId"),
    }
    for array_name, (sheet, column) in arrays.items():
        for row in read_sheet(path, sheet, required=False):
            offer = by_id.get(row.get("offerId"))
            if offer is not None and row.get(column):
                offer.setdefault(array_name, []).append(row[column])
    return offers


def rebuild_manifest(path: Path) -> dict[str, Any]:
    manifest: dict[str, Any] = {}
    for row in read_sheet(path, "manifest"):
        key = row.get("key")
        if key:
            value = row.get("value")
            if key == "schemaVersion":
                value = parse_number(value, "schemaVersion")
            manifest[key] = value
    manifest["files"] = {
        row["key"]: row["fileName"]
        for row in read_sheet(path, "files")
        if row.get("key") and row.get("fileName")
    }
    return manifest


def rebuild_file(path: Path, file_key: str) -> Any:
    if file_key == "locations":
        return rebuild_locations(path)
    if file_key == "products":
        return rebuild_products(path)
    if file_key == "stores":
        return rebuild_stores(path)
    if file_key == "offers":
        return rebuild_offers(path)
    if file_key == "manifest":
        return rebuild_manifest(path)
    return read_sheet(path, file_key)


def require_fields(rows: list[dict[str, Any]], fields: list[str], label: str, errors: list[str]) -> None:
    for index, row in enumerate(rows, start=1):
        for field in fields:
            if row.get(field) in (None, ""):
                errors.append(f"{label}: الصف {index} ينقصه الحقل الإلزامي «{field}».")


def find_duplicates(values: list[Any], label: str, errors: list[str]) -> None:
    seen: set[Any] = set()
    for value in values:
        if value in seen:
            errors.append(f"{label}: المعرف «{value}» مكرر.")
        seen.add(value)


def validate(data: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    locations = data.get("locations", [])
    departments = data.get("departments", [])
    categories = data.get("categories", [])
    products = data.get("products", [])
    stores = data.get("stores", [])
    branches = data.get("branches", [])
    prices = data.get("prices", [])
    offers = data.get("offers", [])
    ads = data.get("ads", [])

    require_fields(locations, ["governorateId"], "locations", errors)
    require_fields(departments, ["departmentId", "departmentNameAr"], "departments", errors)
    require_fields(categories, ["categoryId", "categoryNameAr", "departmentId"], "categories", errors)
    require_fields(products, ["productId", "productNameAr", "categoryId"], "products", errors)
    require_fields(stores, ["storeId", "storeNameAr", "categoryId", "departmentIds"], "stores", errors)
    require_fields(branches, ["branchId", "storeId", "governorateId", "cityId"], "branches", errors)
    require_fields(prices, ["priceId", "variantId", "pricePiastres", "observationDate"], "prices", errors)
    require_fields(offers, ["offerId", "offerType"], "offers", errors)
    require_fields(ads, ["adId", "targetType"], "ads", errors)

    find_duplicates([row.get("governorateId") for row in locations], "locations.governorateId", errors)
    find_duplicates([row.get("departmentId") for row in departments], "departments.departmentId", errors)
    find_duplicates([row.get("categoryId") for row in categories], "categories.categoryId", errors)
    find_duplicates([row.get("productId") for row in products], "products.productId", errors)
    find_duplicates([row.get("storeId") for row in stores], "stores.storeId", errors)
    find_duplicates([row.get("priceId") for row in prices], "prices.priceId", errors)
    find_duplicates([row.get("offerId") for row in offers], "offers.offerId", errors)
    find_duplicates([row.get("adId") for row in ads], "ads.adId", errors)

    variant_ids: list[Any] = []
    for product in products:
        for variant in product.get("variants", []) or []:
            if not variant.get("variantId"):
                errors.append(f"products: المنتج «{product.get('productId')}» يحتوي متغيراً بدون variantId.")
            else:
                variant_ids.append(variant.get("variantId"))
    find_duplicates(variant_ids, "products.variants.variantId", errors)

    branch_keys = [
        (branch.get("branchId"), branch.get("cityId"), branch.get("governorateId"))
        for branch in branches
    ]
    # branchId قد يتكرر عبر المدن عمداً في بيانات وفرة، لذلك نعرض التكرار كتحذير.
    find_duplicates(branch_keys, "branches (branchId + cityId)", warnings)

    department_ids = {row.get("departmentId") for row in departments}
    category_ids = {row.get("categoryId") for row in categories}
    product_ids = {row.get("productId") for row in products}
    variant_id_set = set(variant_ids)
    store_ids = {row.get("storeId") for row in stores}
    branch_ids = {row.get("branchId") for row in branches}
    branch_group_ids = {
        group.get("branchGroupId")
        for store in stores
        for group in (store.get("branchGroups", []) or [])
        if group.get("branchGroupId")
    }
    city_ids = {
        city.get("cityId")
        for location in locations
        for city in (location.get("cities", []) or [])
        if city.get("cityId")
    }
    governorate_ids = {row.get("governorateId") for row in locations}

    for category in categories:
        if category.get("departmentId") not in department_ids:
            errors.append(
                f"categories: الفئة «{category.get('categoryId')}» مرتبطة بقسم غير موجود: {category.get('departmentId')}"
            )

    for store in stores:
        if store.get("categoryId") not in category_ids:
            errors.append(
                f"stores: المتجر «{store.get('storeId')}» مرتبط بفئة غير موجودة: {store.get('categoryId')}"
            )
        for department_id in store.get("departmentIds", []) or []:
            if department_id not in department_ids:
                errors.append(
                    f"stores: المتجر «{store.get('storeId')}» مرتبط بقسم غير موجود: {department_id}"
                )

    for product in products:
        if product.get("categoryId") not in category_ids:
            errors.append(
                f"products: المنتج «{product.get('productId')}» مرتبط بفئة غير موجودة: {product.get('categoryId')}"
            )
    for branch in branches:
        if branch.get("storeId") not in store_ids:
            warnings.append(f"branches: الفرع «{branch.get('branchId')}» مرتبط بمتجر غير موجود: {branch.get('storeId')}")
        if branch.get("governorateId") not in governorate_ids:
            warnings.append(
                f"branches: الفرع «{branch.get('branchId')}» مرتبط بمحافظة غير موجودة: {branch.get('governorateId')}"
            )
        if branch.get("cityId") not in city_ids:
            warnings.append(f"branches: الفرع «{branch.get('branchId')}» مرتبط بمدينة غير موجودة: {branch.get('cityId')}")
        if branch.get("branchGroupId") and branch.get("branchGroupId") not in branch_group_ids:
            warnings.append(
                f"branches: مجموعة الفروع «{branch.get('branchGroupId')}» غير معرّفة داخل المتجر «{branch.get('storeId')}»."
            )

    for price in prices:
        if price.get("variantId") not in variant_id_set:
            warnings.append(f"prices: السعر «{price.get('priceId')}» يشير إلى variantId غير موجود: {price.get('variantId')}")
        if price.get("storeId") and price.get("storeId") not in store_ids:
            warnings.append(f"prices: السعر «{price.get('priceId')}» يشير إلى متجر غير موجود: {price.get('storeId')}")
        if price.get("branchId") and price.get("branchId") not in branch_ids:
            warnings.append(f"prices: السعر «{price.get('priceId')}» يشير إلى فرع غير موجود: {price.get('branchId')}")
        if price.get("branchGroupId") and price.get("branchGroupId") not in branch_group_ids:
            warnings.append(
                f"prices: السعر «{price.get('priceId')}» يشير إلى مجموعة فروع غير موجودة: {price.get('branchGroupId')}"
            )
        if price.get("cityId") and price.get("cityId") not in city_ids:
            warnings.append(f"prices: السعر «{price.get('priceId')}» يشير إلى مدينة غير موجودة: {price.get('cityId')}")
        if not any(price.get(key) for key in ("branchId", "branchGroupId", "storeId")):
            warnings.append(f"prices: السعر «{price.get('priceId')}» لا يحدد فرعاً أو مجموعة فروع أو متجراً.")

    for offer in offers:
        if offer.get("variantId") and offer.get("variantId") not in variant_id_set:
            warnings.append(f"offers: العرض «{offer.get('offerId')}» يشير إلى variantId غير موجود: {offer.get('variantId')}")
        if offer.get("storeId") and offer.get("storeId") not in store_ids:
            warnings.append(f"offers: العرض «{offer.get('offerId')}» يشير إلى متجر غير موجود: {offer.get('storeId')}")
        for branch_id in offer.get("branchIds", []) or []:
            if branch_id not in branch_ids:
                warnings.append(f"offers: العرض «{offer.get('offerId')}» يشير إلى فرع غير موجود: {branch_id}")
        for group_id in offer.get("branchGroupIds", []) or []:
            if group_id not in branch_group_ids:
                warnings.append(f"offers: العرض «{offer.get('offerId')}» يشير إلى مجموعة فروع غير موجودة: {group_id}")
        for city_id in offer.get("cityIds", []) or []:
            if city_id not in city_ids:
                warnings.append(f"offers: العرض «{offer.get('offerId')}» يشير إلى مدينة غير موجودة: {city_id}")

    for ad in ads:
        target_type = ad.get("targetType")
        target_value = ad.get("targetValue")
        if target_type == "store" and target_value not in store_ids:
            warnings.append(f"ads: الإعلان «{ad.get('adId')}» يشير إلى متجر غير موجود: {target_value}")
        if target_type == "category" and target_value not in category_ids:
            warnings.append(f"ads: الإعلان «{ad.get('adId')}» يشير إلى فئة غير موجودة: {target_value}")


def make_backup(source: Path, file_keys: list[str], timestamp: str) -> Path:
    backup_dir = source / ".backup" / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)
    for file_key in file_keys:
        source_file = source / f"{file_key}.json"
        if source_file.exists():
            shutil.copy2(source_file, backup_dir / source_file.name)
    return backup_dir


def write_json(path: Path, value: Any) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_path, path)


def import_country(country_code: str, args: argparse.Namespace) -> int:
    source_name, xlsx_name, country_label = COUNTRIES[country_code]
    source = ROOT / source_name
    xlsx_dir = ROOT / xlsx_name

    print(f"\n== {country_label} ({source_name}) ==")

    missing = [f"{file_key}.xlsx" for file_key in FILES if not (xlsx_dir / f"{file_key}.xlsx").exists()]
    if missing:
        message = "ملفات Excel التالية غير موجودة: " + ", ".join(missing)
        if not args.allow_missing:
            print("خطأ: " + message)
            print("شغّل python scripts/generate_xlsx.py أولاً، أو استخدم --allow-missing لتجاوز الملفات الناقصة.")
            return 1
        print("تحذير: " + message)

    data: dict[str, Any] = {}
    for file_key in FILES:
        path = xlsx_dir / f"{file_key}.xlsx"
        if not path.exists():
            continue
        try:
            data[file_key] = rebuild_file(path, file_key)
        except ImportErrorWithContext as exc:
            print(f"خطأ في {file_key}.xlsx: {exc}")
            return 1

    errors: list[str] = []
    warnings: list[str] = []
    validate(data, errors, warnings)

    for warning in warnings:
        print("تحذير: " + warning)

    if errors:
        print("\nفشل التحقق، لم تتم كتابة أي ملف:")
        for error in errors:
            print(" - " + error)
        return 1

    counts = []
    for file_key in FILES:
        if file_key not in data:
            continue
        value = data[file_key]
        count = len(value) if isinstance(value, list) else len(value.get("files", {}))
        counts.append(f"{file_key}={count}")

    if args.dry_run:
        print("تم التحقق بنجاح (dry-run، لم تُكتب ملفات): " + ", ".join(counts))
        return 0

    backup_dir = None
    if not args.no_backup:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_dir = make_backup(source, [key for key in FILES if key in data], timestamp)
        print(f"نسخة احتياطية: {backup_dir}")

    for file_key, value in data.items():
        write_json(source / f"{file_key}.json", value)

    print("تم تحديث JSON: " + ", ".join(counts))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="تحويل ملفات Excel المعدّلة إلى JSON لموقع وفرة.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--country",
        choices=["sa", "eg", "all"],
        default="all",
        help="الدولة المطلوب تحويلها. الافتراضي all.",
    )
    parser.add_argument("--dry-run", action="store_true", help="التحقق فقط دون كتابة JSON.")
    parser.add_argument("--no-backup", action="store_true", help="عدم إنشاء نسخة احتياطية قبل الكتابة.")
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="تجاوز ملفات Excel الناقصة بدل إيقاف العملية.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    countries = ["sa", "eg"] if args.country == "all" else [args.country]

    exit_code = 0
    for country_code in countries:
        exit_code = max(exit_code, import_country(country_code, args))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
