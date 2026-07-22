"""Nominatim geocoding (free, no API key — requires a descriptive User-Agent)."""

from __future__ import annotations

from functools import lru_cache

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "eld-trip-planner/1.0 (full-stack assessment)"}
TIMEOUT = 10


class GeocodingError(Exception):
    """Raised when a location can't be geocoded."""


def _short_name(hit: dict) -> str:
    """Compact "City, ST" style label from a Nominatim result."""
    address = hit.get("address", {})
    place = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("hamlet")
        or hit.get("name")
    )
    iso = address.get("ISO3166-2-lvl4", "")
    state = iso.split("-")[-1] if "-" in iso else address.get("state")
    if place and state:
        return f"{place}, {state}"
    return place or hit["display_name"].split(",")[0]


def geocode(query: str) -> dict:
    """Resolve a free-text location to {lat, lon, display_name, short_name}."""
    try:
        resp = requests.get(
            f"{NOMINATIM_URL}/search",
            params={
                "q": query,
                "format": "json",
                "limit": 1,
                "countrycodes": "us,ca,mx",
                "addressdetails": 1,
            },
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        results = resp.json()
    except requests.RequestException as exc:
        raise GeocodingError(f"Geocoding service unavailable: {exc}") from exc

    if not results:
        raise GeocodingError(f'Could not find a location for "{query}".')

    hit = results[0]
    return {
        "lat": float(hit["lat"]),
        "lon": float(hit["lon"]),
        "display_name": hit["display_name"],
        "short_name": _short_name(hit),
    }


@lru_cache(maxsize=512)
def reverse_geocode_city(lat_r: float, lon_r: float) -> str | None:
    """Best-effort "City, ST" for a coordinate (rounded before caching)."""
    try:
        resp = requests.get(
            f"{NOMINATIM_URL}/reverse",
            params={"lat": lat_r, "lon": lon_r, "format": "json", "zoom": 10},
            headers=HEADERS,
            timeout=5,
        )
        resp.raise_for_status()
        address = resp.json().get("address", {})
    except requests.RequestException:
        return None

    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("hamlet")
        or address.get("county")
    )
    iso = address.get("ISO3166-2-lvl4", "")
    state = iso.split("-")[-1] if "-" in iso else address.get("state")
    if city and state:
        return f"{city}, {state}"
    return city or state or None


def city_for(lat: float, lon: float) -> str | None:
    """Public wrapper that rounds coords so nearby lookups share a cache entry."""
    return reverse_geocode_city(round(lat, 2), round(lon, 2))
