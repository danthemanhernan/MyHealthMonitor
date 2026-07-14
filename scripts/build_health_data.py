#!/usr/bin/env python3
"""Build a small, app-friendly snapshot from the local Apple Health export.

This is intentionally a one-time importer. The Apple export is streamed because
the XML can be several GB. MyFitnessPal's PDF is parsed with pypdf; future
imports should use the CSV path documented in docs/DATA_PLAN.md instead.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from calendar import monthrange
from pathlib import Path
from typing import Any
from xml.etree.ElementTree import iterparse


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XML = ROOT / "data/raw/apple-health/apple_health_export/export.xml"
DEFAULT_PDF = ROOT / "data/raw/myfitnesspal/pdf/Free Calorie Counter, Diet & Exercise Journal | MyFitnessPal.pdf"
DEFAULT_ROUTES = ROOT / "data/raw/apple-health/apple_health_export/workout-routes"
DEFAULT_OUTPUT = ROOT / "src/data/health-data.json"

SLEEP_VALUES = {
    "HKCategoryValueSleepAnalysisAsleepCore",
    "HKCategoryValueSleepAnalysisAsleepDeep",
    "HKCategoryValueSleepAnalysisAsleepREM",
    "HKCategoryValueSleepAnalysisAsleepUnspecified",
}


def date_only(value: str) -> str:
    return value[:10]


def three_months_before(value: str) -> str:
    current = date.fromisoformat(value)
    month = current.month - 3
    year = current.year
    if month <= 0:
        month += 12
        year -= 1
    day = min(current.day, monthrange(year, month)[1])
    return date(year, month, day).isoformat()


def minutes_between(start: str, end: str) -> int:
    try:
        start_dt = datetime.strptime(start[:19], "%Y-%m-%d %H:%M:%S")
        end_dt = datetime.strptime(end[:19], "%Y-%m-%d %H:%M:%S")
        return max(0, round((end_dt - start_dt).total_seconds() / 60))
    except ValueError:
        return 0


def sleep_night_date(value: str) -> str | None:
    """Return the evening date for an overnight sleep window.

    The intended window is 8:00 PM through 11:00 AM the next day. Records
    beginning between 11:00 AM and 8:00 PM are treated as daytime sleep and
    excluded from the overnight total.
    """
    try:
        started = datetime.strptime(value[:19], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None
    if started.hour >= 20:
        return started.date().isoformat()
    if started.hour < 11 or (started.hour == 11 and started.minute == 0):
        return (started.date() - timedelta(days=1)).isoformat()
    return None


def parse_apple_health(path: Path) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], Counter[str], int]:
    daily: dict[str, dict[str, Any]] = defaultdict(lambda: {
        "steps": 0.0,
        "stepsBySource": defaultdict(float),
        "activeEnergyKcal": 0.0,
        "restingHeartRateValues": [],
        "hrvValues": [],
        "weightValues": [],
        "sleepSegments": [],
        "sourceCounts": Counter(),
    })
    workouts: list[dict[str, Any]] = []
    record_counts: Counter[str] = Counter()
    workout_count = 0

    for _, element in iterparse(path, events=("end",)):
        attrs = element.attrib
        tag = element.tag
        if tag == "Record":
            record_type = attrs.get("type", "")
            record_counts[record_type] += 1
            day = date_only(attrs.get("startDate", ""))
            try:
                value = float(attrs.get("value", "0"))
            except ValueError:
                value = 0.0
            if record_type == "HKQuantityTypeIdentifierStepCount" and attrs.get("unit") == "count":
                row = daily[day]
                row["sourceCounts"][attrs.get("sourceName", "unknown")] += 1
                row["stepsBySource"][attrs.get("sourceName", "unknown")] += value
            elif record_type == "HKQuantityTypeIdentifierActiveEnergyBurned" and attrs.get("unit") == "Cal":
                row = daily[day]
                row["sourceCounts"][attrs.get("sourceName", "unknown")] += 1
                row["activeEnergyKcal"] += value
            elif record_type == "HKQuantityTypeIdentifierRestingHeartRate":
                row = daily[day]
                row["sourceCounts"][attrs.get("sourceName", "unknown")] += 1
                row["restingHeartRateValues"].append(value)
            elif record_type == "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
                row = daily[day]
                row["sourceCounts"][attrs.get("sourceName", "unknown")] += 1
                row["hrvValues"].append(value)
            elif record_type == "HKQuantityTypeIdentifierBodyMass" and attrs.get("unit") == "lb":
                row = daily[day]
                row["sourceCounts"][attrs.get("sourceName", "unknown")] += 1
                row["weightValues"].append({"value": value, "date": attrs.get("startDate", "")})
            elif (
                record_type == "HKCategoryTypeIdentifierSleepAnalysis"
                and attrs.get("sourceName", "").startswith("daniel")
                and attrs.get("value") in SLEEP_VALUES
            ):
                sleep_day = sleep_night_date(attrs.get("startDate", ""))
                if sleep_day is None:
                    element.clear()
                    continue
                row = daily[sleep_day]
                row["sourceCounts"][attrs.get("sourceName", "unknown")] += 1
                row["sleepSegments"].append({
                    "minutes": minutes_between(attrs.get("startDate", ""), attrs.get("endDate", "")),
                    "start": attrs.get("startDate", ""),
                    "end": attrs.get("endDate", ""),
                })
        elif tag == "Workout":
            workout_count += 1
            try:
                duration = float(attrs.get("duration", "0"))
            except ValueError:
                duration = 0.0
            workouts.append({
                "date": date_only(attrs.get("startDate", "")),
                "type": attrs.get("workoutActivityType", "").replace("HKWorkoutActivityType", ""),
                "durationMinutes": round(duration, 1),
                "calories": round(float(attrs.get("totalEnergyBurned", "0") or 0), 1),
                "source": attrs.get("sourceName", ""),
            })
        element.clear()

    normalized: dict[str, dict[str, Any]] = {}
    for day, row in daily.items():
        if not day or day == "":
            continue
        sleep = row["sleepSegments"]
        sleep_minutes = sum(item["minutes"] for item in sleep)
        bedtime = min((item["start"] for item in sleep), default=None)
        wake_time = max((item["end"] for item in sleep), default=None)
        watch_sources = {source: total for source, total in row["stepsBySource"].items() if "apple watch" in source.replace("\xa0", " ").lower()}
        iphone_sources = {source: total for source, total in row["stepsBySource"].items() if "iPhone" in source}
        selected_sources = watch_sources or iphone_sources or dict(row["stepsBySource"])
        step_source, step_total = max(selected_sources.items(), key=lambda item: item[1], default=(None, 0.0))
        normalized[day] = {
            "date": day,
            "steps": round(step_total),
            "stepSource": step_source,
            "activeEnergyKcal": round(row["activeEnergyKcal"]),
            "restingHeartRate": round(sum(row["restingHeartRateValues"]) / len(row["restingHeartRateValues"])) if row["restingHeartRateValues"] else None,
            "hrvMs": round(sum(row["hrvValues"]) / len(row["hrvValues"]), 1) if row["hrvValues"] else None,
            "weightLb": round(row["weightValues"][-1]["value"], 1) if row["weightValues"] else None,
            "sleepMinutes": sleep_minutes or None,
            "bedtime": bedtime,
            "wakeTime": wake_time,
            "workoutCount": 0,
            "workoutMinutes": 0,
        }
    return normalized, workouts, record_counts, workout_count


def parse_mfp_pdf(path: Path) -> list[dict[str, Any]]:
    from pypdf import PdfReader

    text = "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
    markers = list(re.finditer(r"(?m)^\s*((?:Jun|Jul)\s+\d{1,2}\s*,?\s*2026)\s*$", text))
    days: list[dict[str, Any]] = []
    for index, marker in enumerate(markers):
        raw_date = re.sub(r"\s+", " ", marker.group(1).replace(" ,", ",")).replace(" ,", ",")
        day = datetime.strptime(raw_date, "%b %d, %Y").date().isoformat()
        section = text[marker.end() : markers[index + 1].start() if index + 1 < len(markers) else None]
        section = section.split("Calories minutesSets", 1)[0]
        totals: dict[str, int] | None = None
        for line in section.splitlines():
            line = line.strip()
            match = re.match(r"^(\d{2,7})g(\d{1,3}|--)g\s*(\d{1,3}|--)g\s*(\d{1,4}|--)mg\s*(\d{1,5}|--)mg\s*(\d{1,3}|--)g\s*(\d{1,3}|--)g\s*$", line)
            if not match:
                continue
            prefix, fat, protein, cholesterol, sodium, sugar, fiber = match.groups()
            splits = []
            for carb_digits in range(1, 4):
                if len(prefix) <= carb_digits:
                    continue
                calories = int(prefix[:-carb_digits])
                carbs = int(prefix[-carb_digits:])
                if 50 <= calories <= 5000 and 0 <= carbs <= 500:
                    splits.append((calories, carbs))
            if not splits:
                continue
            calories, carbs = max(splits, key=lambda item: item[0])
            totals = {
                "calories": calories,
                "carbsG": carbs,
                "fatG": None if fat == "--" else int(fat),
                "proteinG": None if protein == "--" else int(protein),
                "cholesterolMg": None if cholesterol == "--" else int(cholesterol),
                "sodiumMg": None if sodium == "--" else int(sodium),
                "sugarG": None if sugar == "--" else int(sugar),
                "fiberG": None if fiber == "--" else int(fiber),
            }
        days.append({"date": day, **(totals or {})})
    return days


def parse_routes(path: Path) -> list[dict[str, Any]]:
    routes = []
    for route in sorted(path.glob("*.gpx")):
        points = 0
        first = last = None
        for _, element in iterparse(route, events=("end",)):
            if element.tag.endswith("}trkpt"):
                points += 1
                current = (float(element.attrib["lat"]), float(element.attrib["lon"]))
                first = first or current
                last = current
            element.clear()
        routes.append({"file": route.name, "points": points, "date": re.search(r"\d{4}-\d{2}-\d{2}", route.name).group(0)})
    return routes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml", type=Path, default=DEFAULT_XML)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--routes", type=Path, default=DEFAULT_ROUTES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    daily, workouts, record_counts, workout_count = parse_apple_health(args.xml)
    nutrition = parse_mfp_pdf(args.pdf)
    latest_import_date = max(daily)
    cutoff_date = three_months_before(latest_import_date)
    daily = {day: row for day, row in daily.items() if day >= cutoff_date}
    workouts = [row for row in workouts if row["date"] >= cutoff_date]
    nutrition = [row for row in nutrition if row["date"] >= cutoff_date]
    routes = [row for row in parse_routes(args.routes) if row["date"] >= cutoff_date]
    by_day = {row["date"]: row for row in nutrition}
    for workout in workouts:
        row = daily.setdefault(workout["date"], {"date": workout["date"], "steps": 0, "stepsBySource": {}, "activeEnergyKcal": 0, "restingHeartRate": None, "hrvMs": None, "weightLb": None, "sleepMinutes": None, "bedtime": None, "wakeTime": None, "workoutCount": 0, "workoutMinutes": 0})
        row["workoutCount"] += 1
        row["workoutMinutes"] += workout["durationMinutes"]
    for row in daily.values():
        row["workoutMinutes"] = round(row["workoutMinutes"], 1)
        if row["date"] in by_day:
            row["nutrition"] = by_day[row["date"]]
    output = {
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "dateRange": {"start": min(daily), "end": max(daily)},
        "sources": {
            "appleHealthXml": {"file": str(args.xml.relative_to(ROOT)), "recordCount": sum(record_counts.values()), "recordTypes": record_counts},
            "myFitnessPalPdf": {"file": str(args.pdf.relative_to(ROOT)), "daysFound": len(nutrition), "note": "One-time PDF extraction; use CSV for future imports."},
            "workoutRoutes": {"fileCount": len(routes)},
        },
        "dailyMetrics": [daily[key] for key in sorted(daily)],
        "nutritionDays": nutrition,
        "workouts": sorted(workouts, key=lambda row: row["date"]),
        "workoutRoutes": routes,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False, default=lambda value: dict(value)), encoding="utf-8")
    print(f"Wrote {args.output} with {len(output['dailyMetrics'])} days, {len(workouts)} workouts, {len(nutrition)} nutrition days, and {len(output['workoutRoutes'])} routes.")


if __name__ == "__main__":
    main()
