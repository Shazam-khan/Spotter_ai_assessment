"""Turn the simulated duty-status timeline into per-calendar-day log sheets.

Every segment boundary produced by the engine sits on a 15-minute lattice, so
each day's row totals are exact multiples of 15 minutes and sum to 24:00.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta

from .engine import DRIVING, OFF_DUTY, ON_DUTY, SLEEPER, Segment

STATUSES = (OFF_DUTY, SLEEPER, DRIVING, ON_DUTY)


def _minutes_since_midnight(dt: datetime) -> int:
    return dt.hour * 60 + dt.minute


def _fmt_hours(minutes: int) -> str:
    return f"{minutes // 60}:{minutes % 60:02d}"


def build_daily_logs(segments: list[Segment]) -> list[dict]:
    """Split the timeline at midnight into one log sheet per calendar day.

    The first day is padded with Off Duty from midnight to the trip start and
    the last day with Off Duty up to midnight, so each sheet covers 24 hours.
    """
    if not segments:
        return []

    first_day = segments[0].start.date()
    last_day = segments[-1].end.date()
    # A trip ending exactly at midnight belongs to the previous sheet.
    if segments[-1].end.time() == time(0, 0) and last_day > first_day:
        last_day -= timedelta(days=1)

    days = []
    day = first_day
    while day <= last_day:
        day_start = datetime.combine(day, time(0, 0))
        day_end = day_start + timedelta(days=1)

        day_segments = []
        totals_min = {status: 0 for status in STATUSES}
        miles_driving = 0.0
        start_miles: float | None = None
        end_miles = 0.0

        cursor = day_start
        for seg in segments:
            clip_start = max(seg.start, day_start)
            clip_end = min(seg.end, day_end)
            if clip_end <= clip_start:
                continue
            # Pad any gap before this segment (only the pre-trip-start morning).
            if clip_start > cursor:
                gap_min = int((clip_start - cursor).total_seconds() // 60)
                day_segments.append(
                    {
                        "status": OFF_DUTY,
                        "kind": "off",
                        "start_min": _minutes_since_midnight(cursor),
                        "end_min": _minutes_since_midnight(cursor) + gap_min,
                        "remark": "",
                    }
                )
                totals_min[OFF_DUTY] += gap_min
            start_min = _minutes_since_midnight(clip_start)
            dur_min = int((clip_end - clip_start).total_seconds() // 60)
            carried = seg.start < day_start
            # Remarks flag only where the status change happens — except a
            # segment covering the whole sheet (e.g. a 34-hr restart day),
            # which gets its remark back so the sheet isn't unexplained.
            if carried:
                remark = f"{seg.remark} (continued)" if dur_min == 24 * 60 and seg.remark else ""
            else:
                remark = seg.remark
            day_segments.append(
                {
                    "status": seg.status,
                    "kind": seg.kind,
                    "start_min": start_min,
                    "end_min": start_min + dur_min,
                    "remark": remark,
                }
            )
            totals_min[seg.status] += dur_min
            seg_seconds = (seg.end - seg.start).total_seconds()
            start_frac = (clip_start - seg.start).total_seconds() / seg_seconds if seg_seconds else 0
            end_frac = (clip_end - seg.start).total_seconds() / seg_seconds if seg_seconds else 1
            seg_span = seg.end_miles - seg.start_miles
            if start_miles is None:
                start_miles = seg.start_miles + seg_span * start_frac
            end_miles = seg.start_miles + seg_span * end_frac
            if seg.status == DRIVING and seg.hours > 0:
                miles_driving += seg_span * (end_frac - start_frac)
            cursor = clip_end

        # Pad the tail of the day (trip finished before midnight).
        if cursor < day_end:
            tail_min = int((day_end - cursor).total_seconds() // 60)
            day_segments.append(
                {
                    "status": OFF_DUTY,
                    "kind": "off",
                    "start_min": _minutes_since_midnight(cursor),
                    "end_min": _minutes_since_midnight(cursor) + tail_min,
                    "remark": "",
                }
            )
            totals_min[OFF_DUTY] += tail_min

        # Merge adjacent same-status filler segments for a cleaner drawing.
        merged: list[dict] = []
        for item in day_segments:
            prev = merged[-1] if merged else None
            if (
                prev
                and prev["status"] == item["status"]
                and prev["end_min"] == item["start_min"]
                and not item["remark"]
            ):
                prev["end_min"] = item["end_min"]
            else:
                merged.append(item)

        assert sum(totals_min.values()) == 24 * 60, (
            f"Log sheet for {day} totals {sum(totals_min.values())} minutes"
        )

        days.append(
            {
                "date": day.isoformat(),
                "segments": merged,
                "totals": {
                    status: {
                        "minutes": totals_min[status],
                        "label": _fmt_hours(totals_min[status]),
                    }
                    for status in STATUSES
                },
                "total_miles_driving": round(miles_driving, 1),
                "start_miles": round(start_miles or 0.0, 1),
                "end_miles": round(end_miles, 1),
            }
        )
        day += timedelta(days=1)

    return days
