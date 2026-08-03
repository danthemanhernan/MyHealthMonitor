from __future__ import annotations

import unittest
from datetime import UTC, date, datetime
from pathlib import Path

from scripts.nutrition_import import (
    DayStatus,
    import_nutrition_csv,
    normalize_quantity,
    parse_local_datetime,
    summarize_days,
)


FIXTURES = Path(__file__).parent / "fixtures"
IMPORTED_AT = datetime(2026, 8, 2, 12, 0, tzinfo=UTC)


class NutritionImportTests(unittest.TestCase):
    def test_importing_same_file_twice_is_idempotent(self) -> None:
        first = import_nutrition_csv(
            FIXTURES / "nutrition_export_a.csv",
            source_system="test-app",
            timezone_name="America/Los_Angeles",
            imported_at=IMPORTED_AT,
        )
        second = import_nutrition_csv(
            FIXTURES / "nutrition_export_a.csv",
            source_system="test-app",
            timezone_name="America/Los_Angeles",
            existing_entries=first.entries,
            imported_at=IMPORTED_AT,
        )

        self.assertEqual(3, first.report.imported)
        self.assertEqual(0, first.report.duplicates)
        self.assertEqual(3, len(second.entries))
        self.assertEqual(0, second.report.imported)
        self.assertEqual(3, second.report.duplicates)

    def test_overlapping_exports_do_not_duplicate_meals(self) -> None:
        first = import_nutrition_csv(
            FIXTURES / "nutrition_export_a.csv",
            source_system="test-app",
            timezone_name="America/Los_Angeles",
            imported_at=IMPORTED_AT,
        )
        overlap = import_nutrition_csv(
            FIXTURES / "nutrition_export_overlap.csv",
            source_system="test-app",
            timezone_name="America/Los_Angeles",
            existing_entries=first.entries,
            imported_at=IMPORTED_AT,
        )

        self.assertEqual(4, len(overlap.entries))
        self.assertEqual(1, overlap.report.imported)
        self.assertEqual(1, overlap.report.duplicates)
        ids = [entry.entry_id for entry in overlap.entries]
        self.assertEqual(len(ids), len(set(ids)))

    def test_units_normalize_to_canonical_values(self) -> None:
        grams, milliliters, unit = normalize_quantity(8, "oz")
        self.assertAlmostEqual(226.796185, grams or 0, places=6)
        self.assertIsNone(milliliters)
        self.assertEqual("g", unit)

        grams, milliliters, unit = normalize_quantity(1, "lb")
        self.assertAlmostEqual(453.59237, grams or 0, places=5)
        self.assertIsNone(milliliters)
        self.assertEqual("g", unit)

        grams, milliliters, unit = normalize_quantity(2, "fl oz")
        self.assertIsNone(grams)
        self.assertAlmostEqual(59.147059, milliliters or 0, places=6)
        self.assertEqual("ml", unit)

    def test_dates_and_timezones_are_deterministic(self) -> None:
        utc_value, local_date = parse_local_datetime(
            "2026-07-08 23:30", "America/Los_Angeles"
        )
        self.assertEqual("2026-07-09T06:30:00+00:00", utc_value)
        self.assertEqual("2026-07-08", local_date)

        utc_value_again, local_date_again = parse_local_datetime(
            "2026-07-09T06:30:00+00:00", "America/Los_Angeles"
        )
        self.assertEqual(utc_value, utc_value_again)
        self.assertEqual(local_date, local_date_again)

    def test_malformed_rows_are_reported_not_silently_discarded(self) -> None:
        result = import_nutrition_csv(
            FIXTURES / "nutrition_export_malformed.csv",
            source_system="test-app",
            timezone_name="America/Los_Angeles",
            imported_at=IMPORTED_AT,
        )

        self.assertEqual(0, result.report.imported)
        self.assertEqual(3, result.report.rejected)
        self.assertEqual(3, len(result.report.issues))
        self.assertEqual([2, 3, 4], [issue.row_number for issue in result.report.issues])
        self.assertTrue(all(issue.reason for issue in result.report.issues))
        self.assertEqual("not-a-date", result.report.issues[0].raw_row["consumed_at"])

    def test_incomplete_days_are_distinct_from_true_zero_values(self) -> None:
        imported = import_nutrition_csv(
            FIXTURES / "nutrition_export_a.csv",
            source_system="test-app",
            timezone_name="America/Los_Angeles",
            imported_at=IMPORTED_AT,
        )
        summaries = summarize_days(
            imported.entries,
            start_date=date(2026, 7, 8),
            end_date=date(2026, 7, 10),
            complete_dates={"2026-07-08"},
        )

        self.assertEqual(DayStatus.COMPLETE, summaries[0].status)
        self.assertEqual(DayStatus.PARTIAL, summaries[1].status)
        self.assertEqual(DayStatus.MISSING, summaries[2].status)
        self.assertGreater(summaries[0].calories_kcal or 0, 0)
        self.assertIsNone(summaries[2].calories_kcal)
        self.assertIsNone(summaries[2].protein_g)
        self.assertEqual(0, summaries[2].entry_count)

    def test_source_records_retain_provenance(self) -> None:
        result = import_nutrition_csv(
            FIXTURES / "nutrition_export_a.csv",
            source_system="test-app",
            timezone_name="America/Los_Angeles",
            imported_at=IMPORTED_AT,
        )
        entry = result.entries[0]
        provenance = entry.provenance

        self.assertEqual("test-app", provenance.source_system)
        self.assertEqual("nutrition_export_a.csv", provenance.source_filename)
        self.assertEqual(64, len(provenance.source_file_hash))
        self.assertEqual(2, provenance.source_row_number)
        self.assertEqual("meal-001", provenance.source_record_id)
        self.assertEqual("2026-08-02T12:00:00+00:00", provenance.imported_at)
        self.assertEqual("1.0.0", provenance.parser_version)


if __name__ == "__main__":
    unittest.main()
