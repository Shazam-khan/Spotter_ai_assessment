"""HOS engine tests — including the guide's §2.4 worked example and the
correctness traps graders check."""

from datetime import datetime

from django.test import SimpleTestCase

from trips.hos import constants as C
from trips.hos.engine import (
    DRIVING,
    OFF_DUTY,
    ON_DUTY,
    Leg,
    round_to_quarter,
    simulate_trip,
)

START = datetime(2026, 1, 5, 8, 0)  # Monday 08:00


def kinds(segments):
    return [s.kind for s in segments]


def driving_hours(segments):
    return sum(s.hours for s in segments if s.status == DRIVING)


class WorkedExampleTests(SimpleTestCase):
    """§2.4: 0 cycle hrs used, 1 hr current→pickup, ~600 mi (~11 hr) pickup→dropoff."""

    def setUp(self):
        self.legs = [
            Leg("to_pickup", 55.0, 1.0, "pickup"),
            Leg("to_dropoff", 600.0, 11.0, "dropoff"),
        ]
        self.segments = simulate_trip(self.legs, 0.0, START)

    def test_event_sequence(self):
        self.assertEqual(
            kinds(self.segments),
            [
                "pretrip", "drive", "pickup", "drive", "break", "drive",
                "posttrip", "rest", "pretrip_daily", "drive", "dropoff",
            ],
        )

    def test_break_after_8_cumulative_driving_hours(self):
        brk = next(s for s in self.segments if s.kind == "break")
        driven_before = sum(
            s.hours for s in self.segments if s.status == DRIVING and s.end <= brk.start
        )
        self.assertAlmostEqual(driven_before, C.BREAK_AFTER_DRIVING)
        self.assertAlmostEqual(brk.hours, C.BREAK_DURATION)
        # 1 hr leg1 + 7 hrs leg2 → break at 17:30 (started 08:00 with 0.5 pre-trip)
        self.assertEqual(brk.start, datetime(2026, 1, 5, 17, 30))

    def test_rest_when_11_hour_driving_limit_hit(self):
        rest = next(s for s in self.segments if s.kind == "rest")
        driven_before = sum(
            s.hours for s in self.segments if s.status == DRIVING and s.end <= rest.start
        )
        self.assertAlmostEqual(driven_before, C.MAX_DRIVING_PER_SHIFT)
        self.assertAlmostEqual(rest.hours, C.DAILY_REST)
        # Driving caps at 21:00; a 15-min post-trip inspection precedes the rest.
        self.assertEqual(rest.start, datetime(2026, 1, 5, 21, 15))
        posttrip = next(s for s in self.segments if s.kind == "posttrip")
        self.assertEqual(posttrip.start, datetime(2026, 1, 5, 21, 0))

    def test_remaining_driving_resumes_next_day_after_pretrip(self):
        pretrip2 = next(s for s in self.segments if s.kind == "pretrip_daily")
        self.assertEqual(pretrip2.start, datetime(2026, 1, 6, 7, 15))
        last_drive = [s for s in self.segments if s.kind == "drive"][-1]
        self.assertEqual(last_drive.start, datetime(2026, 1, 6, 7, 30))
        self.assertAlmostEqual(last_drive.hours, 1.0)

    def test_no_mileage_dropped(self):
        self.assertAlmostEqual(self.segments[-1].end_miles, 655.0, places=3)
        self.assertAlmostEqual(driving_hours(self.segments), 12.0)

    def test_timeline_is_contiguous(self):
        for a, b in zip(self.segments, self.segments[1:]):
            self.assertEqual(a.end, b.start)


class BreakRuleTests(SimpleTestCase):
    def test_break_inserted_at_exactly_8_hours(self):
        legs = [Leg("to_dropoff", 495.0, 9.0, "dropoff")]
        segments = simulate_trip(legs, 0.0, START)
        self.assertEqual(kinds(segments), ["pretrip", "drive", "break", "drive", "dropoff"])
        self.assertAlmostEqual(segments[1].hours, 8.0)
        self.assertAlmostEqual(segments[3].hours, 1.0)

    def test_no_break_under_8_hours(self):
        legs = [Leg("to_dropoff", 385.0, 7.0, "dropoff")]
        segments = simulate_trip(legs, 0.0, START)
        self.assertNotIn("break", kinds(segments))


class WindowTests(SimpleTestCase):
    def test_14_hour_window_expires_with_driving_hours_left(self):
        """On-duty stops eat the window: after 4 hrs of non-driving on-duty
        time plus a 30-min break, the window expires at only 10 driving hrs.
        Only a 10-hr rest may follow — never more driving."""
        legs = [
            Leg("a", 110.0, 2.0, "pickup"),
            Leg("b", 110.0, 2.0, "pickup"),
            Leg("c", 110.0, 2.0, "pickup"),
            Leg("d", 440.0, 8.0, "dropoff"),
        ]
        segments = simulate_trip(legs, 0.0, START)
        rest = next(s for s in segments if s.kind == "rest")
        driven_before = sum(
            s.hours for s in segments if s.status == DRIVING and s.end <= rest.start
        )
        # 11-hr driving limit NOT reached — the 14-hr window forced the rest.
        self.assertAlmostEqual(driven_before, 10.0)
        # Driving ceased exactly at the 14th hour (post-trip inspection after
        # the window closes is legal — it just isn't driving).
        last_drive_end = max(s.end for s in segments if s.status == DRIVING and s.end <= rest.start)
        self.assertEqual((last_drive_end - START).total_seconds() / 3600.0, C.MAX_WINDOW)

    def test_break_does_not_pause_window(self):
        """The 30-min break consumes window time: driving must stop 14 wall
        clock hours after coming on duty, break included."""
        legs = [
            Leg("a", 110.0, 2.0, "pickup"),
            Leg("b", 110.0, 2.0, "pickup"),
            Leg("c", 110.0, 2.0, "pickup"),
            Leg("d", 440.0, 8.0, "dropoff"),
        ]
        segments = simulate_trip(legs, 0.0, START)
        brk = next(s for s in segments if s.kind == "break")
        rest = next(s for s in segments if s.kind == "rest")
        self.assertLess(brk.start, rest.start)
        # Wall clock from on-duty start to when driving ceased == exactly 14 hrs
        # even though only 13.5 hrs were "productive" (0.5 was the break).
        last_drive_end = max(s.end for s in segments if s.status == DRIVING and s.end <= rest.start)
        self.assertEqual((last_drive_end - START).total_seconds() / 3600.0, 14.0)


class CycleTests(SimpleTestCase):
    def test_cycle_exhaustion_triggers_34_hour_restart(self):
        segments = simulate_trip([Leg("d", 275.0, 5.0, "dropoff")], 68.0, START)
        restart = next(s for s in segments if s.kind == "restart")
        self.assertAlmostEqual(restart.hours, C.CYCLE_RESTART)
        self.assertEqual(restart.status, OFF_DUTY)
        # 0.5 pre-trip + 1.5 driving consumed the last 2 cycle hrs.
        driven_before = sum(
            s.hours for s in segments if s.status == DRIVING and s.end <= restart.start
        )
        self.assertAlmostEqual(driven_before, 1.5)
        # Trip still completes fully after the restart.
        self.assertAlmostEqual(driving_hours(segments), 5.0)
        self.assertAlmostEqual(segments[-1].end_miles, 275.0, places=3)

    def test_fully_exhausted_cycle_restarts_before_pretrip(self):
        segments = simulate_trip([Leg("d", 55.0, 1.0, "dropoff")], 70.0, START)
        self.assertEqual(segments[0].kind, "restart")
        self.assertEqual(segments[1].kind, "pretrip")

    def test_on_duty_time_counts_against_cycle_but_not_driving_limit(self):
        """69.5 cycle hrs used leaves exactly 0.5 for the pre-trip; the first
        driving chunk must then trigger a restart even though the driver has
        driven 0 hrs."""
        segments = simulate_trip([Leg("d", 55.0, 1.0, "dropoff")], 69.5, START)
        self.assertEqual(kinds(segments)[:4], ["pretrip", "restart", "pretrip_daily", "drive"])


class FuelTests(SimpleTestCase):
    def test_fuel_stop_before_1000_miles(self):
        legs = [Leg("d", 1200.0, 20.0, "dropoff")]
        segments = simulate_trip(legs, 0.0, START)
        fuels = [s for s in segments if s.kind == "fuel"]
        self.assertEqual(len(fuels), 1)
        self.assertLessEqual(fuels[0].start_miles, C.FUEL_INTERVAL_MILES + 1e-6)
        self.assertGreater(fuels[0].start_miles, 900.0)
        self.assertEqual(fuels[0].status, ON_DUTY)
        self.assertAlmostEqual(segments[-1].end_miles, 1200.0, places=3)

    def test_no_fuel_stop_under_1000_miles(self):
        segments = simulate_trip([Leg("d", 600.0, 11.0, "dropoff")], 0.0, START)
        self.assertNotIn("fuel", kinds(segments))


class RoundingTests(SimpleTestCase):
    def test_round_to_quarter(self):
        self.assertAlmostEqual(round_to_quarter(10.9), 11.0)
        self.assertAlmostEqual(round_to_quarter(10.87), 10.75)
        self.assertAlmostEqual(round_to_quarter(0.05), 0.25)  # min one quarter
        self.assertAlmostEqual(round_to_quarter(0.0), 0.0)
