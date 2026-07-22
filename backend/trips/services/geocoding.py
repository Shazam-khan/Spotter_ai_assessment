"""Geocoding with graceful degradation between two free OSM-based services.

Forward search: Nominatim first (best address matching), throttled to its
1 req/s public policy and cached; on failure or 429 it falls back to Photon
(photon.komoot.io — no hard rate limit).

Reverse ("City, ST" for remarks): Photon first — these are the high-volume
calls and Render's shared egress IPs get 429s from Nominatim quickly — with
throttled Nominatim as the fallback.
"""

from __future__ import annotations

import threading
import time
from functools import lru_cache

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
PHOTON_URL = "https://photon.komoot.io"
HEADERS = {"User-Agent": "eld-trip-planner/1.0 (full-stack assessment)"}
TIMEOUT = 10

US_STATE_ABBR = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
}


class GeocodingError(Exception):
    """Raised when a location can't be geocoded."""


# Nominatim public policy: max 1 request/second. Serialize and space calls.
_nominatim_lock = threading.Lock()
_nominatim_next = 0.0


def _nominatim_get(path: str, params: dict) -> list | dict:
    global _nominatim_next
    with _nominatim_lock:
        wait = _nominatim_next - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _nominatim_next = time.monotonic() + 1.1
    resp = requests.get(f"{NOMINATIM_URL}{path}", params=params, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _abbr_state(state: str | None) -> str | None:
    if not state:
        return None
    return US_STATE_ABBR.get(state, state)


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
    state = iso.split("-")[-1] if "-" in iso else _abbr_state(address.get("state"))
    if place and state:
        return f"{place}, {state}"
    return place or hit["display_name"].split(",")[0]


def _photon_search(query: str) -> dict | None:
    resp = requests.get(
        f"{PHOTON_URL}/api",
        params={"q": query, "limit": 1, "lang": "en"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    features = resp.json().get("features") or []
    if not features:
        return None
    props = features[0].get("properties", {})
    lon, lat = features[0]["geometry"]["coordinates"]
    place = props.get("city") or props.get("name")
    state = _abbr_state(props.get("state"))
    short = f"{place}, {state}" if place and state else (place or query)
    display = ", ".join(
        p for p in [props.get("name"), props.get("city"), props.get("state"), props.get("country")] if p
    )
    return {
        "lat": float(lat),
        "lon": float(lon),
        "display_name": display or query,
        "short_name": short,
    }


@lru_cache(maxsize=512)
def geocode(query: str) -> dict:
    """Resolve a free-text location to {lat, lon, display_name, short_name}."""
    not_found = False
    try:
        results = _nominatim_get(
            "/search",
            {
                "q": query,
                "format": "json",
                "limit": 1,
                "countrycodes": "us,ca,mx",
                "addressdetails": 1,
            },
        )
        if results:
            hit = results[0]
            return {
                "lat": float(hit["lat"]),
                "lon": float(hit["lon"]),
                "display_name": hit["display_name"],
                "short_name": _short_name(hit),
            }
        not_found = True
    except requests.RequestException:
        pass  # rate-limited or down — try Photon

    try:
        result = _photon_search(query)
    except requests.RequestException as exc:
        if not_found:
            raise GeocodingError(f'Could not find a location for "{query}".') from exc
        raise GeocodingError(f"Geocoding services unavailable: {exc}") from exc

    if result is None:
        raise GeocodingError(f'Could not find a location for "{query}".')
    return result


@lru_cache(maxsize=512)
def reverse_geocode_city(lat_r: float, lon_r: float) -> str | None:
    """Best-effort "City, ST" for a coordinate (rounded before caching)."""
    # Photon first: reverse lookups are the bulk of our traffic.
    try:
        resp = requests.get(
            f"{PHOTON_URL}/reverse",
            params={"lat": lat_r, "lon": lon_r, "lang": "en"},
            headers=HEADERS,
            timeout=5,
        )
        resp.raise_for_status()
        features = resp.json().get("features") or []
        if features:
            props = features[0].get("properties", {})
            city = props.get("city") or props.get("county") or props.get("name")
            state = _abbr_state(props.get("state"))
            if city and state:
                return f"{city}, {state}"
            if city:
                return city
    except requests.RequestException:
        pass

    try:
        address = _nominatim_get(
            "/reverse", {"lat": lat_r, "lon": lon_r, "format": "json", "zoom": 10}
        ).get("address", {})
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
