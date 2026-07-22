import { ArrowRight, BedDouble, CalendarDays, Coffee, Fuel, Gauge, MapPinned, RotateCcw, Timer } from 'lucide-react'
import type { ReactNode } from 'react'

import type { TripSummaryData } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime, formatDuration } from '@/lib/utils'

function Stat({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3.5 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold leading-tight">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

export function TripSummary({ summary }: { summary: TripSummaryData }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            <span>{summary.locations.current}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span>{summary.locations.pickup}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span>{summary.locations.dropoff}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(summary.start_time)} → {formatDateTime(summary.end_time)}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          icon={<MapPinned className="size-4" />}
          value={`${summary.total_distance_miles.toLocaleString()} mi`}
          label="Total distance"
        />
        <Stat
          icon={<Timer className="size-4" />}
          value={formatDuration(summary.total_driving_hrs)}
          label="Driving time"
        />
        <Stat
          icon={<CalendarDays className="size-4" />}
          value={summary.total_days}
          label={summary.total_days === 1 ? 'Log sheet (day)' : 'Log sheets (days)'}
        />
        <Stat
          icon={<Gauge className="size-4" />}
          value={
            summary.cycle_used_at_end !== null
              ? `${summary.cycle_used_at_end.toFixed(1)} / 70`
              : 'Reset'
          }
          label={summary.cycle_used_at_end !== null ? 'Cycle used after trip' : '34-hr restart taken'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={<BedDouble className="size-4" />} value={summary.rest_stops} label="10-hr rests" />
        <Stat icon={<Coffee className="size-4" />} value={summary.breaks} label="30-min breaks" />
        <Stat icon={<Fuel className="size-4" />} value={summary.fuel_stops} label="Fuel stops" />
        <Stat icon={<RotateCcw className="size-4" />} value={summary.restarts} label="34-hr restarts" />
      </div>
    </div>
  )
}
