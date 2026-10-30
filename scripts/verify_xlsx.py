#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""التحقق من أن ملفات Excel يمكن إعادة بنائها إلى نفس JSON الأصلي."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
FILES = ["locations", "departments", "categories", "products", "stores", "branches", "prices", "offers", "ads", "manifest"]


def parse_json_cell(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text or text[0] not in "[{":
        return value
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return value


def read_sheet(path: Path, name: str) -> list[dict[str, Any]]:
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(value) for value in rows[0] if value is not None]
    result: list[dict[str, Any]] = []
    for row in rows[1:]:
        item: dict[str, Any] = {}
        for header, value in zip(headers, row):
            if value is None or value == "":
                continue
            item[header] = value
        if item:
            result.append(item)
    wb.close()
    return result


def rebuild_locations(path: Path) -> list[dict[str, Any]]:
    locations = read_sheet(path, "locations")
    cities = read_sheet(path, "cities")
    for location in locations:
        governorate_id = location["governorateId"]
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
        product_id = product["productId"]
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
    groups = read_sheet(path, "branchGroups")
    for store in stores:
        if "departmentIds" in store:
            store["departmentIds"] = parse_json_cell(store["departmentIds"])
        store_id = store["storeId"]
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
    by_id = {offer["offerId"]: offer for offer in offers}
    arrays = {
        "branchIds": ("offer_branchIds", "branchId"),
        "branchGroupIds": ("offer_branchGroupIds", "branchGroupId"),
        "cityIds": ("offer_cityIds", "cityId"),
    }
    for array_name, (sheet, column) in arrays.items():
        for row in read_sheet(path, sheet):
            offer = by_id.get(row.get("offerId"))
            if offer is not None and row.get(column):
                offer.setdefault(array_name, []).append(row[column])
    return offers


def rebuild_manifest(path: Path) -> dict[str, Any]:
    manifest: dict[str, Any] = {}
    for row in read_sheet(path, "manifest"):
        manifest[row["key"]] = row["value"]
    manifest["files"] = {row["key"]: row["fileName"] for row in read_sheet(path, "files")}
    return manifest


def main() -> int:
    failures = 0
    for country, source_name, out_name in [
        ("SA", "data-sa", "data-sa-xlsx"),
        ("EG", "data-eg", "data-eg-xlsx"),
    ]:
        source = ROOT / source_name
        out_dir = ROOT / out_name
        print(f"== {country} ==")
        for file_key in FILES:
            original = json.loads((source / f"{file_key}.json").read_text(encoding="utf-8-sig"))
            path = out_dir / f"{file_key}.xlsx"
            if file_key == "locations":
                rebuilt = rebuild_locations(path)
            elif file_key == "products":
                rebuilt = rebuild_products(path)
            elif file_key == "stores":
                rebuilt = rebuild_stores(path)
            elif file_key == "offers":
                rebuilt = rebuild_offers(path)
            elif file_key == "manifest":
                rebuilt = rebuild_manifest(path)
            else:
                rebuilt = read_sheet(path, file_key)
            ok = rebuilt == original
            print(f"{file_key:10} {'OK' if ok else 'MISMATCH'}")
            if not ok:
                failures += 1
                # اطبع أول اختلاف مختصراً للمساعدة في التصحيح.
                if isinstance(original, list) and isinstance(rebuilt, list):
                    for index, (a, b) in enumerate(zip(original, rebuilt)):
                        if a != b:
                            print("  first diff index:", index)
                            print("  original:", json.dumps(a, ensure_ascii=False)[:700])
                            print("  rebuilt :", json.dumps(b, ensure_ascii=False)[:700])
                            break
                    if len(original) != len(rebuilt):
                        print("  length:", len(original), "!=", len(rebuilt))
                else:
                    print("  original:", json.dumps(original, ensure_ascii=False)[:700])
                    print("  rebuilt :", json.dumps(rebuilt, ensure_ascii=False)[:700])
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
