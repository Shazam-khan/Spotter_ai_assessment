"""FMCSA property-carrying driver HOS constants (70 hr / 8 day cycle)."""

MAX_DRIVING_PER_SHIFT = 11.0   # hrs of driving between 10-hr rests
MAX_WINDOW = 14.0              # hrs, consecutive wall clock, not paused by breaks
BREAK_AFTER_DRIVING = 8.0      # cumulative driving hrs before a 30-min break
BREAK_DURATION = 0.5
DAILY_REST = 10.0              # resets the 11-hr and 14-hr clocks
CYCLE_LIMIT = 70.0             # on-duty hrs per rolling 8 days
CYCLE_RESTART = 34.0           # hrs off duty resets the cycle
FUEL_INTERVAL_MILES = 1000.0
FUEL_STOP_DURATION = 0.5       # on-duty
PICKUP_DURATION = 1.0          # on-duty
DROPOFF_DURATION = 1.0         # on-duty
PRETRIP_DURATION = 0.5         # on-duty, at trip start
DAILY_INSPECTION = 0.25        # on-duty post-trip before a rest / pre-trip after

# All event durations above sit on a 15-minute lattice. Leg drive times and the
# trip start are rounded to the same lattice so every segment boundary lands on
# a quarter hour — log sheet totals then sum to exactly 24:00 by construction.
QUARTER = 0.25
EPS = 1e-6
