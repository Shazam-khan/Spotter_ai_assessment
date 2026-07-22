"""OSRM routing (public demo server — free, no key) + polyline interpolation."""

from __future__ import annotations

import math

import polyline as polyline_codec
import requests

OSRM_URL = "https://router.project-osrm.org"
TIMEOUT = 15
METERS_PER_MILE = 1609.344


class RoutingError(Exception):
    """Raised when a route can't be computed."""


def fetch_route(coords: list[tuple[float, float]]) -> dict:
    """Route through (lat, lon) waypoints.

    Returns {polyline, points, legs: [{distance_miles, duration_hrs}],
    distance_miles, duration_hrs}.
    """
    path = ";".join(f"{lon},{lat}" for lat, lon in coords)
    try:
        resp = requests.get(
            f"{OSRM_URL}/route/v1/driving/{path}",
            params={"overview": "full", "geometries": "polyline", "steps": "false"},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        raise RoutingError(f"Routing service unavailable: {exc}") from exc

    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError("No drivable route found between those locations.")

    route = data["routes"][0]
    legs = [
        {
            "distance_miles": leg["distance"] / METERS_PER_MILE,
            "duration_hrs": leg["duration"] / 3600.0,
        }
        for leg in route["legs"]
    ]
    return {
        "polyline": route["geometry"],
        "points": polyline_codec.decode(route["geometry"]),  # [(lat, lon), ...]
        "legs": legs,
        "distance_miles": route["distance"] / METERS_PER_MILE,
        "duration_hrs": route["duration"] / 3600.0,
    }


def _haversine_miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 3958.8 * 2 * math.asin(math.sqrt(h))


class RouteLocator:
    """Interpolates a coordinate at a given mileage along the route polyline,
    so stop markers sit on the road rather than at leg endpoints."""

    def __init__(self, points: list[tuple[float, float]], total_route_miles: float):
        self.points = points
        self.cum = [0.0]
        for i in range(1, len(points)):
            self.cum.append(self.cum[-1] + _haversine_miles(points[i - 1], points[i]))
        # Haversine along the polyline underestimates the road distance
        # slightly; scale so the polyline length matches OSRM's total.
        self.scale = self.cum[-1] / total_route_miles if total_route_miles > 0 else 1.0

    def point_at(self, route_miles: float) -> tuple[float, float]:
        target = max(0.0, min(route_miles * self.scale, self.cum[-1]))
        lo, hi = 0, len(self.cum) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if self.cum[mid] < target:
                lo = mid + 1
            else:
                hi = mid
        i = max(1, lo)
        span = self.cum[i] - self.cum[i - 1]
        t = 0.0 if span <= 0 else (target - self.cum[i - 1]) / span
        lat = self.points[i - 1][0] + t * (self.points[i][0] - self.points[i - 1][0])
        lon = self.points[i - 1][1] + t * (self.points[i][1] - self.points[i - 1][1])
        return lat, lon
