"""Daily log sheet splitting tests — every sheet must total exactly 24:00."""

from datetime import datetime

from django.test import SimpleTestCase

from trips.hos.engine import Leg, simulate_trip
from trips.hos.logs import build_daily_logs

START = datetime(2026, 1, 5, 8, 0)


class DailyLogTests(SimpleTestCase):
    def _logs(self, legs, cycle_used=0.0):
        return build_daily_logs(simulate_trip(legs, cycle_used, START))

    def test_worked_example_spans_two_sheets(self):
        logs = self._logs(
            [Leg("to_pickup", 55.0, 1.0, "pickup"), Leg("to_dropoff", 600.0, 11.0, "dropoff")]
        )
        self.assertEqual(len(logs), 2)
        self.assertEqual(logs[0]["date"], "2026-01-05")
        self.assertEqual(logs[1]["date"], "2026-01-06")

    def test_every_sheet_totals_24_hours(self):
        scenarios = [
            [Leg("d", 100.0, 2.0, "dropoff")],
            [Leg("p", 55.0, 1.0, "pickup"), Leg("d", 600.0, 11.0, "dropoff")],
            [Leg("p", 55.0, 1.0, "pickup"), Leg("d", 2000.0, 36.25, "dropoff")],
        ]
        for legs in scenarios:
            for sheet in self._logs(legs):
                total = sum(t["minutes"] for t in sheet["totals"].values())
                self.assertEqual(total, 24 * 60, f"sheet {sheet['date']}")

    def test_first_day_padded_off_duty_from_midnight(self):
        logs = self._logs([Leg("d", 100.0, 2.0, "dropoff")])
        first = logs[0]["segments"][0]
        self.assertEqual(first["status"], "off_duty")
        self.assertEqual(first["start_min"], 0)
        self.assertEqual(first["end_min"], 8 * 60)

    def test_last_day_padded_off_duty_to_midnight(self):
        logs = self._logs([Leg("d", 100.0, 2.0, "dropoff")])
        last = logs[-1]["segments"][-1]
        self.assertEqual(last["status"], "off_duty")
        self.assertEqual(last["end_min"], 24 * 60)

    def test_worked_example_day1_totals(self):
        logs = self._logs(
            [Leg("to_pickup", 55.0, 1.0, "pickup"), Leg("to_dropoff", 600.0, 11.0, "dropoff")]
        )
        day1 = logs[0]["totals"]
        # Off duty: 00:00–08:00 pad + 30-min break + 21:00–24:00 rest start = 11:30
        self.assertEqual(day1["off_duty"]["label"], "11:30")
        self.assertEqual(day1["driving"]["label"], "11:00")
        self.assertEqual(day1["on_duty"]["label"], "1:30")
        self.assertEqual(day1["sleeper"]["label"], "0:00")

    def test_segment_boundaries_on_15_min_lattice(self):
        logs = self._logs(
            [Leg("p", 55.0, 1.0, "pickup"), Leg("d", 2000.0, 36.25, "dropoff")]
        )
        for sheet in logs:
            for seg in sheet["segments"]:
                self.assertEqual(seg["start_min"] % 15, 0)
                self.assertEqual(seg["end_min"] % 15, 0)

    def test_midnight_spanning_segment_carries_no_duplicate_remark(self):
        logs = self._logs(
            [Leg("p", 55.0, 1.0, "pickup"), Leg("d", 600.0, 11.0, "dropoff")]
        )
        # The 10-hr rest starts 21:00 day 1 and continues on day 2 — the day-2
        # continuation must not repeat the remark flag.
        day2_first = logs[1]["segments"][0]
        self.assertEqual(day2_first["status"], "off_duty")
        self.assertEqual(day2_first["remark"], "")

    def test_daily_driving_miles_split_across_days(self):
        logs = self._logs(
            [Leg("to_pickup", 55.0, 1.0, "pickup"), Leg("to_dropoff", 600.0, 11.0, "dropoff")]
        )
        total = sum(sheet["total_miles_driving"] for sheet in logs)
        self.assertAlmostEqual(total, 655.0, places=0)
        # Day 2 has exactly the final 1-hr chunk of leg 2 (~54.5 mi).
        self.assertLess(logs[1]["total_miles_driving"], 60)
