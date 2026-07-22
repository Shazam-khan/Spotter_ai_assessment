from __future__ import annotations

from datetime import date, datetime, time, timedelta

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .hos import constants as C
from .hos.engine import DRIVING, ON_DUTY, Leg, round_to_quarter, simulate_trip
from .hos.logs import build_daily_logs
from .serializers import PlanTripRequestSerializer
from .services.geocoding import GeocodingError, city_for, geocode
from .services.routing import RouteLocator, RoutingError, fetch_route

INTERPOLATED_KINDS = {"fuel", "break", "rest", "restart"}


def _snap_quarter_hour(dt: datetime) -> datetime:
    total = dt.hour * 60 + dt.minute
    snapped = int(round(total / 15.0)) * 15
    base = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return base + timedelta(minutes=snapped)


class PlanTripView(APIView):
    def post(self, request):
        ser = PlanTripRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            current = geocode(data["current_location"])
            pickup = geocode(data["pickup_location"])
            dropoff = geocode(data["dropoff_location"])
        except GeocodingError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            route = fetch_route(
                [
                    (current["lat"], current["lon"]),
                    (pickup["lat"], pickup["lon"]),
                    (dropoff["lat"], dropoff["lon"]),
                ]
            )
        except RoutingError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        start_time = data.get("start_time") or datetime.combine(date.today(), time(8, 0))
        if start_time.tzinfo is not None:
            start_time = start_time.replace(tzinfo=None)  # home-terminal local time
        start_time = _snap_quarter_hour(start_time)

        legs = [
            Leg(
                name="to_pickup",
                distance_miles=route["legs"][0]["distance_miles"],
                drive_hours=round_to_quarter(route["legs"][0]["duration_hrs"]),
                end_event="pickup",
            ),
            Leg(
                name="to_dropoff",
                distance_miles=route["legs"][1]["distance_miles"],
                drive_hours=round_to_quarter(route["legs"][1]["duration_hrs"]),
                end_event="dropoff",
            ),
        ]

        segments = simulate_trip(legs, data["current_cycle_used"], start_time)

        locator = RouteLocator(route["points"], route["distance_miles"])
        place_by_kind = {
            "pretrip": current["short_name"],
            "pickup": pickup["short_name"],
            "dropoff": dropoff["short_name"],
        }
        stops = [
            {
                "type": "start",
                "label": f"Start — {place_by_kind['pretrip']}",
                "lat": current["lat"],
                "lng": current["lon"],
                "arrival": start_time.isoformat(),
                "duration_hrs": 0,
            }
        ]
        for seg in segments:
            if seg.kind == "drive":
                continue
            if seg.kind in INTERPOLATED_KINDS:
                lat, lng = locator.point_at(seg.start_miles)
                city = city_for(lat, lng)
                if city:
                    seg.remark = f"{city} — {seg.remark}"
            else:
                lat, lng = {
                    "pretrip": (current["lat"], current["lon"]),
                    "pickup": (pickup["lat"], pickup["lon"]),
                    "dropoff": (dropoff["lat"], dropoff["lon"]),
                }[seg.kind]
                seg.remark = f"{place_by_kind[seg.kind]} — {seg.remark}"
            stops.append(
                {
                    "type": seg.kind,
                    "label": seg.remark,
                    "lat": lat,
                    "lng": lng,
                    "arrival": seg.start.isoformat(),
                    "duration_hrs": seg.hours,
                }
            )

        logs = build_daily_logs(segments)

        driving_hrs = sum(seg.hours for seg in segments if seg.status == DRIVING)
        on_duty_hrs = sum(seg.hours for seg in segments if seg.status == ON_DUTY)
        restarts = sum(1 for seg in segments if seg.kind == "restart")
        cycle_used_end = (
            data["current_cycle_used"] + driving_hrs + on_duty_hrs
            if restarts == 0
            else None  # cycle was reset mid-trip by a 34-hr restart
        )

        return Response(
            {
                "route": {
                    "polyline": route["polyline"],
                    "distance_miles": round(route["distance_miles"], 1),
                    "duration_hrs": round(route["duration_hrs"], 2),
                },
                "stops": stops,
                "logs": logs,
                "summary": {
                    "start_time": start_time.isoformat(),
                    "end_time": segments[-1].end.isoformat(),
                    "total_distance_miles": round(route["distance_miles"], 1),
                    "total_driving_hrs": round(driving_hrs, 2),
                    "total_on_duty_hrs": round(driving_hrs + on_duty_hrs, 2),
                    "total_days": len(logs),
                    "rest_stops": sum(1 for s in segments if s.kind == "rest"),
                    "fuel_stops": sum(1 for s in segments if s.kind == "fuel"),
                    "breaks": sum(1 for s in segments if s.kind == "break"),
                    "restarts": restarts,
                    "cycle_used_at_end": (
                        round(cycle_used_end, 2) if cycle_used_end is not None else None
                    ),
                    "locations": {
                        "current": place_by_kind["pretrip"],
                        "pickup": place_by_kind["pickup"],
                        "dropoff": place_by_kind["dropoff"],
                    },
                },
            }
        )
