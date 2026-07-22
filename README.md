# ELD Trip Planner — FMCSA HOS-Compliant Routing & Daily Log Generator

**Live app:** <https://spotter-ai-assessment-beta.vercel.app>
**API:** <https://spotter-ai-assessment-26f6.onrender.com> ([health check](https://spotter-ai-assessment-26f6.onrender.com/health/))

> Note: the API runs on Render's free tier and sleeps when idle — the first request
> after a quiet period cold-starts in ~50 s (the UI shows a loading state while it wakes).

A full-stack app for property-carrying truck drivers. Enter **current location, pickup, dropoff and the cycle hours already used**, and get back:

1. **A route map** (Leaflet + OpenStreetMap) with markers for every planned stop — pickup 📦, dropoff 🏁, fuel ⛽, 30-min breaks ☕, 10-hr rests 🛏, 34-hr restarts 🔄 — each interpolated onto the actual road polyline.
2. **Driver's Daily Log sheets** — the classic FMCSA paper grid drawn programmatically in SVG, one per calendar day, with the duty-status line, remarks flags ("City, ST — activity"), and per-row totals that always sum to exactly 24:00. Printable to PDF.

## Architecture

```
React (Vite + Tailwind + shadcn-style UI)          Django + DRF
┌─────────────────────────────────┐   POST    ┌──────────────────────────────┐
│ TripForm (Nominatim autocomplete)│ ────────▶ │ /api/plan-trip               │
│ RouteMap (react-leaflet)         │           │  ├ Geocoding (Nominatim)     │
│ LogSheet (pure SVG)              │ ◀──────── │  ├ Routing (OSRM, free)      │
│ TripSummary                      │   JSON    │  └ HOS engine (pure Python)  │
└─────────────────────────────────┘           └──────────────────────────────┘
```

- **HOS engine** (`backend/trips/hos/`) is pure Python with zero Django dependencies and full unit-test coverage (`backend/trips/tests/`).
- **Routing** uses the public OSRM server (`router.project-osrm.org`) — drive time comes from the API's real duration, not a guessed average speed.
- **Geocoding** uses Nominatim (no API key). Stop remarks are reverse-geocoded to "City, ST".

## HOS Rules Implemented (property-carrying, 70 hr / 8 day)

| Rule | Behavior |
|---|---|
| **11-hr driving limit** | After 11 cumulative driving hrs since the last 10-hr rest → insert a 10-hr off-duty rest. |
| **14-hr driving window** | Wall-clock window from coming on duty; on-duty stops **and** 30-min breaks consume it (breaks do not pause it). When it expires, only a 10-hr rest allows more driving. |
| **30-min break** | Required after 8 cumulative driving hrs; logged off-duty. |
| **70-hr / 8-day cycle** | Driving + on-duty time consume `70 − current_cycle_used`. If exhausted mid-trip → automatic 34-hr restart. |
| **Fuel** | 30-min on-duty stop at least every 1,000 miles. |
| **Pickup / dropoff** | 1 hr on-duty each; 30-min on-duty pre-trip inspection at trip start. |
| **Inspections** | 15-min on-duty post-trip inspection before every 10-hr rest and a 15-min pre-trip inspection when a new shift starts (matching the FMCSA example logs), so every duty-status change carries a city/state remark. |
| **Recap** | Each log sheet carries the 70-hr/8-day Recap block — A: on-duty hours today (lines 3 & 4), B: total on duty last 8 days, C: hours available tomorrow (70 − B) — with restarts resetting B to the hours accrued since. |

A mid-leg interruption (break/rest/fuel) resumes the same leg afterwards — no mileage is dropped, and every stop's map coordinate is interpolated along the route polyline at the exact mileage where it occurs.

## Running Locally

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv venv
venv/Scripts/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver   # http://localhost:8000
```

**Frontend** (Node 20+):

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

**Tests** (the HOS engine's correctness suite — 24 tests including the FMCSA worked example, 14-hr-window expiry, cycle exhaustion → 34-hr restart, midnight splitting, fuel interval):

```bash
cd backend
python manage.py test trips
```

## API

`POST /api/plan-trip`

```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Green Bay, WI",
  "dropoff_location": "Dallas, TX",
  "current_cycle_used": 20,
  "start_time": "2026-07-23T08:00:00"   // optional, defaults to today 08:00
}
```

Returns `{ route: {polyline, distance_miles, duration_hrs}, stops: [...], logs: [per-day sheets], summary: {...} }`.

## Assumptions

- Trip start time is user-selectable (defaults to 08:00); it and all leg drive times are snapped to a 15-minute lattice so every log-grid boundary lands on a quarter hour and each sheet's totals sum to exactly 24:00.
- Average speed derives from OSRM's route duration; no traffic modeling.
- 10-hr rests are logged as **Off Duty** by design (no sleeper-berth split) — the Sleeper Berth row is intentionally 0:00 on every sheet.
- The trip's prior cycle hours (the "current cycle used" input) are treated as fixed history: hours do not roll off the 8-day window mid-trip (conservative). The Recap's "total on duty last 8 days" is that input plus trip accrual, reset by a 34-hr restart.
- Main office and home terminal addresses on the sheets default to the trip's starting city; carrier/driver/truck details are user-editable in the form (demo values fill any blanks).
- The trip "end time" shown is **dropoff completion** — arrival plus the 1-hr unload block.
- A 34-hr restart spanning a full calendar day produces an all-Off-Duty sheet with a "34-hour restart (continued)" remark.
- Fuel stops are 30 min on-duty; pre-trip inspection is 30 min on-duty at trip start; post-trip is rolled into the dropoff hour.
- Single driver, no co-driver, no adverse-driving-conditions extension.
- One (home-terminal) timezone is used for the entire log, per the FMCSA "time base" rule.
- A 34-hr restart is taken automatically if the 70-hr cycle is exhausted mid-trip.
- The public OSRM/Nominatim servers are free demo services — occasional slowness is possible on cold requests.

## Deployment (Vercel + Render)

The frontend is a static Vite build (Vercel); the backend is a long-running Django/gunicorn
service (Render) — trip planning chains several external API calls and can take 10–25 s,
which doesn't fit serverless function limits.

**Backend → Render** (uses [render.yaml](render.yaml) as a Blueprint):
1. Push the repo to GitHub, then in Render choose **New → Blueprint** and select the repo.
2. After the first deploy, note the service URL (e.g. `https://eld-trip-planner-api.onrender.com`)
   and check `https://<api-url>/health/` returns `{"status": "ok"}`.
3. Once the frontend is live, set the `CORS_ALLOWED_ORIGINS` env var to the exact Vercel
   origin (e.g. `https://eld-trip-planner.vercel.app`) and redeploy.

**Frontend → Vercel:**
1. **Add New Project** → import the repo → set **Root Directory** to `frontend/`
   (framework auto-detects Vite; build `npm run build`, output `dist`).
2. Add env var `VITE_API_URL = https://<your-render-service>.onrender.com` (no trailing slash).
3. Deploy, then plug the resulting Vercel URL into Render's `CORS_ALLOWED_ORIGINS` (step 3 above).

**Free-tier note:** Render spins the service down after ~15 min idle; the first request then
cold-starts (~50 s). The UI shows a loading state, but for demos either open the `/health/`
URL a minute beforehand or add a free uptime pinger (e.g. UptimeRobot) against it.
