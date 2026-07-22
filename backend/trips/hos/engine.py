"""Pure-Python FMCSA Hours-of-Service trip simulator.

Walks the trip's driving legs in event chunks and emits a timeline of
duty-status segments, inserting 30-min breaks, 10-hr rests, fuel stops and
34-hr cycle restarts wherever a limit binds.

No Django imports — unit-testable in isolation.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from . import constants as C

OFF_DUTY = "off_duty"
SLEEPER = "sleeper"
DRIVING = "driving"
ON_DUTY = "on_duty"


@dataclass
class Leg:
    name: str                 # "to_pickup" | "to_dropoff"
    distance_miles: float
    drive_hours: float        # from routing API; rounded to 15-min lattice
    end_event: str | None     # "pickup" | "dropoff" | None


@dataclass
class Segment:
    start: datetime
    end: datetime
    status: str               # off_duty | sleeper | driving | on_duty
    kind: str                 # pretrip | drive | pickup | dropoff | fuel | break | rest | restart
    remark: str
    start_miles: float        # miles into the whole trip at segment start
    end_miles: float

    @property
    def hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0


@dataclass
class _State:
    clock: datetime
    driving_since_rest: float = 0.0    # 11-hr limit
    window_elapsed: float = 0.0        # 14-hr window (wall clock, not paused by breaks)
    driving_since_break: float = 0.0   # 8-hr break rule
    cycle_remaining: float = C.CYCLE_LIMIT
    miles: float = 0.0
    miles_since_fuel: float = 0.0
    pending_pretrip: bool = False  # daily pre-trip owed after a rest/restart
    segments: list[Segment] = field(default_factory=list)


def round_to_quarter(hours: float) -> float:
    """Round to the nearest 15 minutes (minimum one quarter for positive input)."""
    q = round(hours / C.QUARTER) * C.QUARTER
    if hours > C.EPS and q < C.QUARTER:
        return C.QUARTER
    return q


def simulate_trip(
    legs: list[Leg],
    current_cycle_used: float,
    start_time: datetime,
) -> list[Segment]:
    """Simulate the full trip and return the duty-status timeline.

    `start_time` must sit on a 15-minute boundary and each leg's
    `drive_hours` on the 15-minute lattice (see `round_to_quarter`).
    """
    s = _State(clock=start_time)
    s.cycle_remaining = C.CYCLE_LIMIT - current_cycle_used

    def emit(status: str, kind: str, hours: float, remark: str, miles_delta: float = 0.0):
        seg = Segment(
            start=s.clock,
            end=s.clock + timedelta(hours=hours),
            status=status,
            kind=kind,
            remark=remark,
            start_miles=s.miles,
            end_miles=s.miles + miles_delta,
        )
        s.segments.append(seg)
        s.clock = seg.end
        s.miles += miles_delta
        if status in (DRIVING, ON_DUTY):
            s.cycle_remaining -= hours
        # The 14-hr window runs on the wall clock: driving, on-duty work and
        # short breaks all consume it. Only the resets below stop it.
        s.window_elapsed += hours

    def take_rest():
        # Post-trip inspection before shutting down (as the FMCSA example logs
        # do), unless the cycle can't absorb it.
        if s.cycle_remaining >= C.DAILY_INSPECTION - C.EPS:
            emit(ON_DUTY, "posttrip", C.DAILY_INSPECTION, "Post-trip/TIV")
        emit(OFF_DUTY, "rest", C.DAILY_REST, "10-hour rest")
        s.driving_since_rest = 0.0
        s.window_elapsed = 0.0
        s.driving_since_break = 0.0
        s.pending_pretrip = True

    def take_restart():
        emit(OFF_DUTY, "restart", C.CYCLE_RESTART, "34-hour restart")
        s.cycle_remaining = C.CYCLE_LIMIT
        s.driving_since_rest = 0.0
        s.window_elapsed = 0.0
        s.driving_since_break = 0.0
        s.pending_pretrip = True

    def ensure_cycle(hours: float):
        """Guarantee enough cycle hours for an upcoming on-duty task."""
        if s.cycle_remaining < hours - C.EPS:
            take_restart()

    # Pre-trip inspection at the very start of the trip.
    ensure_cycle(C.PRETRIP_DURATION)
    emit(ON_DUTY, "pretrip", C.PRETRIP_DURATION, "Pre-trip/TIV")
    s.pending_pretrip = False  # trip-start inspection covers the first shift

    guard = 0
    for leg in legs:
        remaining = leg.drive_hours
        speed = leg.distance_miles / leg.drive_hours if leg.drive_hours > C.EPS else 0.0

        while remaining > C.EPS:
            guard += 1
            if guard > 10_000:
                raise RuntimeError("HOS simulation failed to converge")

            # Daily pre-trip inspection before the first drive of a new shift.
            if s.pending_pretrip:
                if s.cycle_remaining >= C.DAILY_INSPECTION - C.EPS:
                    emit(ON_DUTY, "pretrip_daily", C.DAILY_INSPECTION, "Pre-trip/TIV")
                s.pending_pretrip = False
                continue

            # Fuel stop due? (every 1,000 miles, before driving on)
            if s.miles_since_fuel >= C.FUEL_INTERVAL_MILES - C.EPS:
                ensure_cycle(C.FUEL_STOP_DURATION)
                emit(ON_DUTY, "fuel", C.FUEL_STOP_DURATION, "Fueling")
                s.miles_since_fuel = 0.0
                continue

            # Hours of driving until the next fuel stop is due, floored to the
            # 15-min lattice so every boundary stays on a quarter hour.
            fuel_cap = math.inf
            if speed > C.EPS:
                hours_to_fuel = (C.FUEL_INTERVAL_MILES - s.miles_since_fuel) / speed
                fuel_cap = math.floor(hours_to_fuel / C.QUARTER) * C.QUARTER
                if fuel_cap <= C.EPS:
                    # Within a quarter hour of the fuel interval: fuel now.
                    ensure_cycle(C.FUEL_STOP_DURATION)
                    emit(ON_DUTY, "fuel", C.FUEL_STOP_DURATION, "Fueling")
                    s.miles_since_fuel = 0.0
                    continue

            chunk = min(
                remaining,
                C.MAX_DRIVING_PER_SHIFT - s.driving_since_rest,
                C.MAX_WINDOW - s.window_elapsed,
                C.BREAK_AFTER_DRIVING - s.driving_since_break,
                s.cycle_remaining,
                fuel_cap,
            )

            if chunk <= C.EPS:
                # A limit binds — decide which recovery to insert.
                if s.cycle_remaining <= C.EPS:
                    take_restart()
                elif (
                    C.BREAK_AFTER_DRIVING - s.driving_since_break <= C.EPS
                    and C.MAX_DRIVING_PER_SHIFT - s.driving_since_rest > C.EPS
                    and C.MAX_WINDOW - s.window_elapsed > C.BREAK_DURATION + C.EPS
                ):
                    # Only the 8-hr break rule binds and there is still room in
                    # the shift to drive afterwards — take the 30-min break.
                    # (It does NOT pause the 14-hr window.)
                    emit(OFF_DUTY, "break", C.BREAK_DURATION, "30-min break")
                    s.driving_since_break = 0.0
                else:
                    # 11-hr or 14-hr limit exhausted (or a break would be
                    # pointless because the window is nearly spent).
                    take_rest()
                continue

            emit(DRIVING, "drive", chunk, "", miles_delta=chunk * speed)
            s.driving_since_rest += chunk
            s.driving_since_break += chunk
            s.miles_since_fuel += chunk * speed
            remaining -= chunk

        if leg.end_event == "pickup":
            ensure_cycle(C.PICKUP_DURATION)
            emit(ON_DUTY, "pickup", C.PICKUP_DURATION, "Pickup — loading")
        elif leg.end_event == "dropoff":
            ensure_cycle(C.DROPOFF_DURATION)
            emit(ON_DUTY, "dropoff", C.DROPOFF_DURATION, "Dropoff — unloading")

    return s.segments
