#!/usr/bin/env python3
"""Deterministic, provenance-preserving nutrition CSV imports.

The importer intentionally uses only the Python standard library so it can run in
CI without additional dependencies. Source-specific adapters can map their rows
into :class:`NutritionEntry` while sharing normalization, deduplication, error
reporting, completeness, and provenance behavior.
"""

from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime
from enum import StrEnum
from pathlib import Path
from typing import Iterable, Mapping, Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


PARSER_VERSION = "1.0.0"
GRAMS_PER_OUNCE = 28.349523125
GRAMS_PER_POUND = 453.59237
MILLILITERS_PER_FLUID_OUNCE = 29.5735295625


class DayStatus(StrEnum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    MISSING = "missing"


@dataclass(frozen=True, slots=True)
class Provenance:
    source_system: str
    source_filename: str
    source_file_hash: str
    source_row_number: int
    source_record_id: str | None
    imported_at: str
    parser_version: str = PARSER_VERSION


@dataclass(frozen=True, slots=True)
class NutritionEntry:
    entry_id: str
    consumed_at_utc: str
    local_date: str
    meal_type: str
    food_name: str
    quantity: float
    quantity_unit: str
    grams: float | None
    milliliters: float | None
    calories_kcal: float
    protein_g: float
    carbohydrates_g: float
    fat_g: float
    fiber_g: float | None
    provenance: Provenance


@dataclass(frozen=True, slots=True)
class ImportIssue:
    row_number: int
    reason: str
    raw_row: Mapping[str, str]


@dataclass(slots=True)
class ImportReport:
    imported: int = 0
    duplicates: int = 0
    rejected: int = 0
    issues: list[ImportIssue] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class ImportResult:
    entries: tuple[NutritionEntry, ...]
    report: ImportReport


@dataclass(frozen=True, slots=True)
class DailyNutrition:
    date: str
    status: DayStatus
    calories_kcal: float | None
    protein_g: float | None
    carbohydrates_g: float | None
    fat_g: float | None
    fiber_g: float | None
    entry_count: int


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_quantity(quantity: float, unit: str) -> tuple[float | None, float | None, str]:
    """Return ``(grams, milliliters, canonical_unit)``.

    Mass is normalized to grams and liquid volume to milliliters. Servings and
    other count-like units remain unit-bearing but have no inferred mass/volume.
    """
    canonical = unit.strip().lower().replace(".", "")
    aliases = {
        "gram": "g",
        "grams": "g",
        "kg": "kg",
        "kilogram": "kg",
        "kilograms": "kg",
        "oz": "oz",
        "ounce": "oz",
        "ounces": "oz",
        "lb": "lb",
        "lbs": "lb",
        "pound": "lb",
        "pounds": "lb",
        "ml": "ml",
        "milliliter": "ml",
        "milliliters": "ml",
        "l": "l",
        "liter": "l",
        "liters": "l",
        "fl oz": "fl oz",
        "fluid ounce": "fl oz",
        "fluid ounces": "fl oz",
        "serving": "serving",
        "servings": "serving",
        "count": "count",
        "item": "count",
        "items": "count",
    }
    canonical = aliases.get(canonical, canonical)
    if canonical == "g":
        return quantity, None, "g"
    if canonical == "kg":
        return quantity * 1000.0, None, "g"
    if canonical == "oz":
        return quantity * GRAMS_PER_OUNCE, None, "g"
    if canonical == "lb":
        return quantity * GRAMS_PER_POUND, None, "g"
    if canonical == "ml":
        return None, quantity, "ml"
    if canonical == "l":
        return None, quantity * 1000.0, "ml"
    if canonical == "fl oz":
        return None, quantity * MILLILITERS_PER_FLUID_OUNCE, "ml"
    return None, None, canonical


def parse_local_datetime(value: str, timezone_name: str) -> tuple[str, str]:
    """Normalize a source timestamp into UTC and return its source-local date."""
    try:
        timezone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"unknown timezone: {timezone_name}") from exc

    raw = value.strip()
    parsed: datetime
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        supported = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%m/%d/%Y %H:%M")
        for pattern in supported:
            try:
                parsed = datetime.strptime(raw, pattern)
                break
            except ValueError:
                continue
        else:
            raise ValueError(f"unsupported datetime: {value!r}") from None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone)
    local = parsed.astimezone(timezone)
    utc = local.astimezone(UTC)
    return utc.isoformat(timespec="seconds"), local.date().isoformat()


def stable_entry_id(
    *,
    source_system: str,
    source_record_id: str | None,
    consumed_at_utc: str,
    meal_type: str,
    food_name: str,
    quantity: float,
    quantity_unit: str,
    calories_kcal: float,
    protein_g: float,
    carbohydrates_g: float,
    fat_g: float,
) -> str:
    """Create a deterministic logical-record ID across overlapping exports."""
    identity = {
        "source_system": source_system.strip().lower(),
        "source_record_id": source_record_id or "",
        "consumed_at_utc": consumed_at_utc,
        "meal_type": meal_type.strip().lower(),
        "food_name": " ".join(food_name.split()).lower(),
        "quantity": round(quantity, 6),
        "quantity_unit": quantity_unit,
        "calories_kcal": round(calories_kcal, 6),
        "protein_g": round(protein_g, 6),
        "carbohydrates_g": round(carbohydrates_g, 6),
        "fat_g": round(fat_g, 6),
    }
    encoded = json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def _required(row: Mapping[str, str], name: str) -> str:
    value = (row.get(name) or "").strip()
    if not value:
        raise ValueError(f"missing required field: {name}")
    return value


def _number(row: Mapping[str, str], name: str, *, optional: bool = False) -> float | None:
    value = (row.get(name) or "").strip()
    if not value and optional:
        return None
    if not value:
        raise ValueError(f"missing required field: {name}")
    try:
        parsed = float(value)
    except ValueError as exc:
        raise ValueError(f"invalid numeric value for {name}: {value!r}") from exc
    if parsed < 0:
        raise ValueError(f"negative value for {name}: {value!r}")
    return parsed


def import_nutrition_csv(
    path: Path,
    *,
    source_system: str,
    timezone_name: str,
    existing_entries: Iterable[NutritionEntry] = (),
    imported_at: datetime | None = None,
) -> ImportResult:
    """Import a canonical nutrition CSV and deduplicate logical records.

    Expected columns are documented in ``tests/fixtures`` and intentionally
    source-neutral so application-specific adapters can emit the same contract.
    """
    imported_at = imported_at or datetime.now(UTC)
    source_hash = hash_file(path)
    seen_ids = {entry.entry_id for entry in existing_entries}
    entries: list[NutritionEntry] = list(existing_entries)
    report = ImportReport()

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, start=2):
            try:
                consumed_at_utc, local_date = parse_local_datetime(
                    _required(row, "consumed_at"), timezone_name
                )
                meal_type = _required(row, "meal_type")
                food_name = _required(row, "food_name")
                quantity = _number(row, "quantity")
                assert quantity is not None
                grams, milliliters, canonical_unit = normalize_quantity(
                    quantity, _required(row, "quantity_unit")
                )
                calories = _number(row, "calories_kcal")
                protein = _number(row, "protein_g")
                carbs = _number(row, "carbohydrates_g")
                fat = _number(row, "fat_g")
                fiber = _number(row, "fiber_g", optional=True)
                assert calories is not None and protein is not None
                assert carbs is not None and fat is not None
                source_record_id = (row.get("source_record_id") or "").strip() or None
                entry_id = stable_entry_id(
                    source_system=source_system,
                    source_record_id=source_record_id,
                    consumed_at_utc=consumed_at_utc,
                    meal_type=meal_type,
                    food_name=food_name,
                    quantity=quantity,
                    quantity_unit=canonical_unit,
                    calories_kcal=calories,
                    protein_g=protein,
                    carbohydrates_g=carbs,
                    fat_g=fat,
                )
                if entry_id in seen_ids:
                    report.duplicates += 1
                    continue
                provenance = Provenance(
                    source_system=source_system,
                    source_filename=path.name,
                    source_file_hash=source_hash,
                    source_row_number=row_number,
                    source_record_id=source_record_id,
                    imported_at=imported_at.astimezone(UTC).isoformat(timespec="seconds"),
                )
                entries.append(
                    NutritionEntry(
                        entry_id=entry_id,
                        consumed_at_utc=consumed_at_utc,
                        local_date=local_date,
                        meal_type=meal_type,
                        food_name=food_name,
                        quantity=quantity,
                        quantity_unit=canonical_unit,
                        grams=round(grams, 6) if grams is not None else None,
                        milliliters=round(milliliters, 6) if milliliters is not None else None,
                        calories_kcal=calories,
                        protein_g=protein,
                        carbohydrates_g=carbs,
                        fat_g=fat,
                        fiber_g=fiber,
                        provenance=provenance,
                    )
                )
                seen_ids.add(entry_id)
                report.imported += 1
            except (AssertionError, ValueError) as exc:
                report.rejected += 1
                report.issues.append(
                    ImportIssue(row_number=row_number, reason=str(exc), raw_row=dict(row))
                )

    return ImportResult(entries=tuple(entries), report=report)


def summarize_days(
    entries: Sequence[NutritionEntry],
    *,
    start_date: date,
    end_date: date,
    complete_dates: set[str] | None = None,
) -> tuple[DailyNutrition, ...]:
    """Aggregate entries while preserving missing/partial/complete semantics."""
    if end_date < start_date:
        raise ValueError("end_date must not precede start_date")
    complete_dates = complete_dates or set()
    by_date: dict[str, list[NutritionEntry]] = {}
    for entry in entries:
        by_date.setdefault(entry.local_date, []).append(entry)

    summaries: list[DailyNutrition] = []
    current = start_date
    while current <= end_date:
        key = current.isoformat()
        rows = by_date.get(key, [])
        if not rows:
            summaries.append(
                DailyNutrition(
                    date=key,
                    status=DayStatus.MISSING,
                    calories_kcal=None,
                    protein_g=None,
                    carbohydrates_g=None,
                    fat_g=None,
                    fiber_g=None,
                    entry_count=0,
                )
            )
        else:
            fiber_values = [row.fiber_g for row in rows if row.fiber_g is not None]
            summaries.append(
                DailyNutrition(
                    date=key,
                    status=DayStatus.COMPLETE if key in complete_dates else DayStatus.PARTIAL,
                    calories_kcal=sum(row.calories_kcal for row in rows),
                    protein_g=sum(row.protein_g for row in rows),
                    carbohydrates_g=sum(row.carbohydrates_g for row in rows),
                    fat_g=sum(row.fat_g for row in rows),
                    fiber_g=sum(fiber_values) if fiber_values else None,
                    entry_count=len(rows),
                )
            )
        current = date.fromordinal(current.toordinal() + 1)
    return tuple(summaries)


def entries_as_dicts(entries: Sequence[NutritionEntry]) -> list[dict[str, object]]:
    return [asdict(entry) for entry in entries]
