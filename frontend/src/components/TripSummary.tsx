import {
  BedDouble,
  CalendarDays,
  Coffee,
  Fuel,
  MapPinned,
  RotateCcw,
  Timer,
} from 'lucide-react'
import type { ReactNode } from 'react'

import type { TripSummaryData } from '@/types'
import { formatDateTimeShort, formatDurationShort } from '@/lib/utils'

function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: ReactNode
  value: ReactNode
  label: string
  color: string
}) {
  return (
    <div className="lift flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-md"
        style={{ background: `${color}1f`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate font-mono text-lg font-semibold leading-tight">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

function RouteNode({ city, caption, last }: { city: string; caption: string; last?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div className="flex flex-col items-center self-stretch">
        <span
          className={`mt-1 size-2.5 shrink-0 rounded-full ${last ? 'bg-[#0ca30c]' : 'bg-primary'}`}
          style={{ boxShadow: `0 0 8px ${last ? '#0ca30c' : '#3987e5'}88` }}
        />
        {!last && <span className="mt-1 w-px flex-1 bg-gradient-to-b from-primary/60 to-primary/10 sm:hidden" />}
      </div>
      <div className="min-w-0 pb-3 sm:pb-0">
        <div className="truncate text-sm font-semibold">{city}</div>
        <div className="truncate text-xs text-muted-foreground">{caption}</div>
      </div>
    </div>
  )
}

export function TripSummary({ summary }: { summary: TripSummaryData }) {
  const cycleEnd = summary.cycle_used_at_end
  const cyclePct = cycleEnd !== null ? Math.min((cycleEnd / 70) * 100, 100) : 100

  return (
    <div className="space-y-3">
      {/* Route ribbon */}
      <div className="rounded-lg border border-border bg-card px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
          <RouteNode city={summary.locations.current} caption={`Depart ${formatDateTimeShort(summary.start_time)}`} />
          <div className="mx-1 mt-2 hidden h-px w-10 shrink-0 bg-gradient-to-r from-primary/60 via-primary/25 to-primary/60 sm:block" />
          <RouteNode city={summary.locations.pickup} caption="Pickup · 1 hr on-duty" />
          <div className="mx-1 mt-2 hidden h-px w-10 shrink-0 bg-gradient-to-r from-primary/60 via-primary/25 to-[#0ca30c]/60 sm:block" />
          <RouteNode city={summary.locations.dropoff} caption={`Arrive ${formatDateTimeShort(summary.end_time)}`} last />
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          icon={<MapPinned className="size-4" />}
          value={`${summary.total_distance_miles.toLocaleString()} mi`}
          label="Total distance"
          color="#3987e5"
        />
        <Stat
          icon={<Timer className="size-4" />}
          value={formatDurationShort(summary.total_driving_hrs)}
          label="Driving time"
          color="#199e70"
        />
        <Stat
          icon={<CalendarDays className="size-4" />}
          value={summary.total_days}
          label={summary.total_days === 1 ? 'Log sheet (day)' : 'Log sheets (days)'}
          color="#9085e9"
        />
        <div className="lift rounded-lg border border-border bg-card px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-lg font-semibold leading-tight">
              {cycleEnd !== null ? cycleEnd.toFixed(1) : '0.0'}
              <span className="text-xs text-muted-foreground"> / 70 hrs</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${cyclePct}%`,
                background:
                  cyclePct > 85 ? '#e66767' : cyclePct > 60 ? '#c98500' : '#3987e5',
              }}
            />
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {cycleEnd !== null ? 'Cycle used after trip' : 'Cycle reset by 34-hr restart'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={<BedDouble className="size-4" />} value={summary.rest_stops} label="10-hr rests" color="#9085e9" />
        <Stat icon={<Coffee className="size-4" />} value={summary.breaks} label="30-min breaks" color="#d95926" />
        <Stat icon={<Fuel className="size-4" />} value={summary.fuel_stops} label="Fuel stops" color="#c98500" />
        <Stat icon={<RotateCcw className="size-4" />} value={summary.restarts} label="34-hr restarts" color="#e66767" />
      </div>
    </div>
  )
}
