# Full Stack Developer Assessment — Complete Attempt Guide
### Trip Planner + ELD Log Generator (Django + React)

---

## 1. What You're Being Asked to Build (Plain English)

An app where a truck dispatcher/driver enters **4 inputs**:

1. **Current location** (where the truck is now)
2. **Pickup location** (where the load is collected)
3. **Dropoff location** (final destination)
4. **Current Cycle Used (Hrs)** — how many of the 70 hours in the rolling 8-day cycle the driver has *already* burned

…and gets back **2 outputs**:

1. **A map** showing the full route (current → pickup → dropoff) with markers for every planned stop: fuel stops, 30-min breaks, 10-hour rest stops, pickup, and dropoff.
2. **Filled-in Driver's Daily Log sheets** — the classic FMCSA paper log grid, *drawn programmatically* (lines on the 24-hour grid across the 4 duty-status rows), one sheet per calendar day of the trip. Long trips = multiple sheets.

**Deliverables checklist:**
- [ ] Live hosted version (frontend on Vercel; backend on Render/Railway/Fly.io — Vercel alone won't host Django well)
- [ ] 3–5 minute Loom walking through app + code
- [ ] Public GitHub repo
- [ ] Accuracy of HOS math will be tested — this is the core grading criterion
- [ ] Polished UI/UX — explicitly stated it "can compensate for some inaccuracies," so invest real time in design

---

## 2. The Rules Engine — The Heart of the Assessment

Everything below comes from the FMCSA Hours of Service guide you were given. The assessment fixes the assumptions for you: **property-carrying driver, 70 hr / 8 day cycle, no adverse conditions, fuel every 1,000 miles, 1 hour each for pickup and dropoff.**

### 2.1 The Four HOS Limits You Must Enforce

| Rule | Limit | What It Means for Your Planner |
|---|---|---|
| **11-Hour Driving Limit** | Max 11 hrs of *driving* per shift | After 11 cumulative driving hours since the last 10-hr rest, insert a 10-hour off-duty rest before any more driving. |
| **14-Hour Driving Window** | No driving after the 14th consecutive hour since coming on duty | The window starts when the driver first goes on duty (e.g., pickup work) and runs on the wall clock — breaks do NOT pause it. If the window expires, insert a 10-hour rest. |
| **30-Minute Break** | Required after 8 *cumulative* hours of driving | Once cumulative driving since the last break hits 8 hrs, insert a 30-min break (can be off-duty). Doesn't extend the 14-hr window. |
| **70-Hour / 8-Day Cycle** | Max 70 on-duty hours in any rolling 8 days | Start the trip with `70 − currentCycleUsed` hours available. Driving + on-duty (not driving) time both consume it. If it runs out mid-trip, the driver needs a **34-hour restart** (off duty) to reset to a fresh 70. |

**A 10-consecutive-hour off-duty rest fully resets both the 11-hr driving clock and the 14-hr window.** The 34-hour restart resets the 70-hr cycle.

### 2.2 Duty Status Categories (the 4 grid rows)

1. **Off Duty** — rest breaks, 10-hr resets, 34-hr restarts
2. **Sleeper Berth** — you can log the 10-hr rests here instead; simplest is to just use Off Duty (or split e.g. first part off-duty, remainder sleeper like the video example)
3. **Driving** — behind the wheel
4. **On Duty (Not Driving)** — pre-trip inspection, pickup (1 hr), dropoff (1 hr), fueling, scaling, post-trip inspection

### 2.3 Trip Simulation Algorithm (Pseudocode)

This is the algorithm you'll implement in Django. It walks through the trip minute-by-minute (or in event chunks) and emits a timeline of duty-status segments.

```
INPUTS:
  route_legs = [ (current→pickup, dist1, drive_hrs1),
                 (pickup→dropoff, dist2, drive_hrs2) ]   # from map API
  cycle_remaining = 70 - current_cycle_used
  AVG_SPEED — derive drive time from the routing API's duration, not a guess

STATE:
  clock = trip start time (e.g., today 08:00, or "now")
  driving_since_rest = 0        # resets on 10-hr rest
  window_elapsed = 0            # 14-hr window; resets on 10-hr rest
  driving_since_break = 0       # resets on 30-min break AND on 10-hr rest
  miles_since_fuel = 0
  segments = []                 # (start, end, status, label, location)

EVENTS to interleave while consuming each leg's driving time:
  • Pre-trip inspection: 0.5 hr On-Duty at trip start (nice touch; video shows it)
  • Pickup: 1.0 hr On-Duty when arriving at pickup
  • Dropoff: 1.0 hr On-Duty when arriving at dropoff
  • Fuel stop: ~0.5 hr On-Duty every time miles_since_fuel ≥ 1000
  • 30-min break: 0.5 hr Off-Duty when driving_since_break ≥ 8
  • 10-hr rest: when EITHER driving_since_rest would exceed 11
                OR window_elapsed would exceed 14 before the next chunk fits
  • 34-hr restart: when cycle_remaining hits 0

MAIN LOOP (per leg):
  while leg has remaining drive time:
    # how much can we drive right now, in one chunk?
    chunk = min( remaining_leg_drive,
                 11 - driving_since_rest,
                 14 - window_elapsed,
                 8  - driving_since_break,
                 cycle_remaining )
    if chunk <= 0:
        decide which limit bound us:
          - break limit  → insert 30-min Off-Duty break
          - 11-hr or 14-hr → insert 10-hr Off-Duty rest (resets both + break clock)
          - cycle → insert 34-hr Off-Duty restart (cycle_remaining = 70)
        continue
    emit Driving segment of length chunk
    advance all counters; accrue miles = chunk × leg_speed
    if miles_since_fuel ≥ 1000: emit 0.5 hr On-Duty fuel stop (mark map location)
  at leg end: emit the pickup or dropoff 1-hr On-Duty segment
              (these consume window time and cycle time but not driving time)

FINALLY: split `segments` at midnight boundaries → one log sheet per calendar day.
```

**Key correctness traps the graders will check:**
- The 30-min break does **not** pause the 14-hr window (window keeps running through it).
- The 14-hr window is consecutive wall-clock time — on-duty stops (pickup, fuel) eat into it.
- On-duty (not driving) hours count against the **70-hr cycle** but not the 11-hr driving limit.
- If the 14-hr window expires but driving hours remain, only a 10-hr rest fixes it.
- Mid-drive interruptions: when a break/rest interrupts a leg, resume the same leg after — don't drop mileage.
- Interpolate the stop's **map coordinate** along the route polyline based on fraction of leg distance covered — so rest/fuel markers sit *on the road*, not at endpoints.

### 2.4 Worked Sanity Check (test your engine against this)

Trip: 0 cycle hrs used, ~600 miles pickup→dropoff (~10.9 hrs driving at ~55 mph), 1 hr from current→pickup.

- 08:00 Pre-trip (On-Duty, 0.5) → 08:30 drive 1 hr to pickup → 09:30 Pickup (On-Duty, 1 hr) → 10:30 drive…
- Driving since rest hits 8 hrs total around 18:30 → 30-min break → resume…
- 11-hr driving cap reached around 22:00 with ~1.9 driving hrs left → 10-hr rest (22:00–08:00 next day)
- Day 2: drive remaining ~1.9 hrs → Dropoff 1 hr On-Duty → done.
- Day 1 log sheet: Off-duty 08:00 line start, on-duty blocks, driving blocks, rest starting 22:00 to midnight. Day 2 sheet continues the rest until 08:00. Totals on each sheet must sum to **24:00**.

Run 3 test scenarios and screenshot them for the Loom: short trip (1 sheet), medium (2 sheets), long trip with fuel stop + near-cycle-limit (3+ sheets, maybe a 34-hr restart with high "current cycle used" input).

---

## 3. Drawing the Log Sheets (What the Video Teaches)

The Schneider video + your screenshots define exactly what a correct sheet looks like:

**Header fields:** date, driver/carrier name, main office address, home terminal, truck/trailer numbers, total miles driving today, shipper & commodity (or shipping doc #), driver signature line, co-driver (N/A).

**The grid:** 24 hours across (midnight → noon → midnight), 15-minute tick marks, 4 rows (Off Duty / Sleeper Berth / Driving / On Duty). You draw:
- A **horizontal line** along the correct row for the duration of each status
- A **vertical line** connecting rows at every status change
- **Remarks flags** below the grid: angled labels with *city, state + activity* at every status change (e.g., "Green Bay, WI — Pre-trip/TIV", "Fond du Lac, WI — Scale", "Paw Paw, IL — 30 min break", "Edwardsville, IL — Post-trip, 10 hr break") — mirror your screenshots
- **Total hours column** on the right: per-row totals; round minutes to :00/:15/:30/:45 (as your totals screenshot shows: 8:30 + 5:00 + 9:30 + 1:00 = 24:00). **Must total 24.**

**How to render it (pick one):**

- **Recommended: SVG in React.** Draw the blank grid as SVG (or overlay on the blank log PNG you have), then map `(time → x, status → y)` and emit `<line>`/`<path>` elements from the day's segments. Crisp, printable, easy to make multiple sheets, and looks great in the demo. Add a "Download PDF" via `window.print()` or `jsPDF`.
- Alternative: HTML5 `<canvas>` — fine, but SVG is easier to debug and style.
- Avoid rendering server-side with Pillow/matplotlib — heavier, slower iteration, worse aesthetics.

Coordinate math: `x = gridLeft + (minutesSinceMidnight / 1440) × gridWidth`, `y = rowCenterY[status]`. Snap segment boundaries to 15-min increments for a clean look.

---

## 4. Architecture & Stack

```
React (Vite) ── POST /api/plan-trip ──▶ Django + DRF
  │                                        │
  │ Leaflet map + SVG log sheets           │ Geocoding (Nominatim)
  │ ◀── JSON: route polyline, stops,       │ Routing (OSRM / OpenRouteService)
  │     daily logs, summary                │ HOS simulation engine (pure Python)
```

**Backend (Django + DRF):**
- One endpoint: `POST /api/plan-trip` with `{current_location, pickup_location, dropoff_location, current_cycle_used}`.
- **Geocoding:** Nominatim (free, no key; set a User-Agent header) or OpenRouteService geocoder.
- **Routing:** OSRM public server (`router.project-osrm.org` — free, no key, returns geometry + distance + duration) or OpenRouteService (free key, 2k req/day). Use the API's *duration* for drive time.
- **HOS engine:** pure Python module, zero external deps → **write unit tests for it** (huge Loom talking point).
- Response: `{ route: {polyline, distance_miles, duration_hrs}, stops: [{type, location, lat, lng, time, duration}], logs: [{date, segments: [{start, end, status, remark}], totals}] }`.

**Frontend (React):**
- Form with 4 inputs (use location autocomplete via Nominatim search for polish).
- **Leaflet + react-leaflet + OpenStreetMap tiles** (free, no key) drawing the polyline + custom markers per stop type (different colors/icons for fuel ⛽, break ☕, rest 🛏, pickup 📦, dropoff 🏁). Popups showing time + duration.
- Trip summary card: total distance, total duration, # days, # stops, cycle hours consumed/remaining.
- Log sheet component (SVG) — one per day, paginated or stacked, with a print/download button.
- Design: pick a clean theme (Tailwind + shadcn/ui is fast), loading states while the API computes, and an error state for un-geocodable addresses. The brief explicitly rewards aesthetics.

**Hosting:**
- Frontend → **Vercel** (they named it).
- Backend → **Render free tier** (or Railway/Fly). Configure CORS (`django-cors-headers`) for the Vercel domain. Note: Render free tier cold-starts (~50s) — mention in README or ping it with a health check.
- Env vars for the API base URL; no secrets needed if you use OSRM + Nominatim.

---

## 5. Build Order (Suggested ~3–4 Day Plan)

**Day 1 — Core engine first (it's what's graded):**
1. Scaffold Django + DRF, single endpoint stub.
2. Write the HOS simulator as a pure function with hardcoded route inputs; unit-test it against the worked example in §2.4 and edge cases (exactly 8 hrs driving, 14-window expiry with driving hours left, cycle exhaustion → 34-hr restart, trip spanning midnight).

**Day 2 — Route + wiring:**
3. Add geocoding + OSRM routing; feed real distances/durations into the engine; interpolate stop coordinates along the polyline.
4. Scaffold React, build the input form, call the API, render the Leaflet map with markers.

**Day 3 — Log sheets + polish:**
5. Build the SVG log grid component; render segments, remarks, totals; multi-day pagination; print/PDF.
6. UI polish: layout, summary cards, loading/error states, mobile check.

**Day 4 — Ship:**
7. Deploy backend (Render) + frontend (Vercel), test the live URL end to end with all 3 scenarios.
8. Clean README (setup, architecture, HOS rules implemented, assumptions).
9. Record the Loom.

---

## 6. The Loom Script (3–5 min)

1. **(0:00–0:30)** Live app: enter a realistic long trip (e.g., Chicago → pickup Green Bay → dropoff Dallas, 20 cycle hrs used). Show the map with all stop markers.
2. **(0:30–1:30)** Walk the outputs: point at the 30-min break marker ("required after 8 cumulative driving hours"), the 10-hr rest ("11-hour driving limit hit"), the fuel stop ("every 1,000 miles"), the 1-hr pickup/dropoff blocks.
3. **(1:30–2:30)** Show the log sheets: trace the line across duty statuses, remarks, per-row totals summing to 24, and multiple sheets for multi-day.
4. **(2:30–4:00)** Code tour: the HOS engine (show the loop + the four limits), the unit tests passing, the SVG log renderer, the API shape.
5. **(4:00–4:30)** Stack + hosting recap, one sentence on what you'd add next (sleeper-berth split, timezone handling, editable start time).

Mentioning the tests and citing the specific FMCSA rules by name signals you actually understood the domain — that's what separates submissions.

---

## 7. Assumptions to State in Your README (so graders don't ding you)

- Trip starts "now" (or a user-selectable start time — a nice easy add).
- Average speed comes from the routing API's duration; no traffic modeling.
- 10-hr rests logged as Off Duty (or note if you split with Sleeper Berth).
- Fuel stops: 30 min, On-Duty; pre-trip 30 min On-Duty at day start; post-trip rolled into dropoff or logged separately.
- Single driver, no co-driver, no adverse-conditions extension (per brief).
- Home-terminal timezone used for the whole log (per FMCSA "time base to be used" rule) — simplest: keep everything in one timezone.
- 34-hr restart used automatically if the 70-hr cycle is exhausted mid-trip.

---

## 8. Quick Reference — Constants for Your Code

```python
MAX_DRIVING_PER_SHIFT   = 11.0   # hrs
MAX_WINDOW              = 14.0   # hrs, consecutive, not paused by breaks
BREAK_AFTER_DRIVING     = 8.0    # cumulative driving hrs
BREAK_DURATION          = 0.5
DAILY_REST              = 10.0   # resets 11 & 14 clocks
CYCLE_LIMIT             = 70.0   # hrs / 8 days
CYCLE_RESTART           = 34.0   # hrs off duty resets cycle
FUEL_INTERVAL_MILES     = 1000
FUEL_STOP_DURATION      = 0.5    # on-duty
PICKUP_DURATION         = 1.0    # on-duty
DROPOFF_DURATION        = 1.0    # on-duty
PRETRIP_DURATION        = 0.5    # on-duty (optional but realistic)
```

Good luck — nail the HOS engine's accuracy first, then make it beautiful. Those are the two things they said they're grading.
