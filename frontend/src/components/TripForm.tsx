import { useState, type FormEvent } from 'react'
import { CalendarClock, Gauge, Loader2, Route } from 'lucide-react'

import type { PlanTripRequest } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationInput } from '@/components/LocationInput'
import { DateTimePicker } from '@/components/DateTimePicker'

interface Props {
  loading: boolean
  onSubmit: (req: PlanTripRequest) => void
}

function defaultStart(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(8, 0, 0, 0)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TripForm({ loading, onSubmit }: Props) {
  const [current, setCurrent] = useState('')
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [cycleUsed, setCycleUsed] = useState('0')
  const [startTime, setStartTime] = useState(defaultStart)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      current_location: current,
      pickup_location: pickup,
      dropoff_location: dropoff,
      current_cycle_used: Number(cycleUsed),
      start_time: startTime || undefined,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="size-4 text-primary" />
          Plan a Trip
        </CardTitle>
        <CardDescription>
          Enter the trip details — the planner inserts every FMCSA-required break, rest and fuel
          stop, then generates the daily log sheets.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <LocationInput
            id="current"
            label="Current location"
            placeholder="e.g. Chicago, IL"
            value={current}
            onChange={setCurrent}
          />
          <LocationInput
            id="pickup"
            label="Pickup location"
            placeholder="e.g. Green Bay, WI"
            value={pickup}
            onChange={setPickup}
          />
          <LocationInput
            id="dropoff"
            label="Dropoff location"
            placeholder="e.g. Dallas, TX"
            value={dropoff}
            onChange={setDropoff}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cycle" className="flex items-center gap-1.5">
                <Gauge className="size-3.5 text-muted-foreground" />
                Cycle used (hrs)
              </Label>
              <Input
                id="cycle"
                type="number"
                min={0}
                max={70}
                step={0.25}
                value={cycleUsed}
                onChange={(e) => setCycleUsed(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Of the 70-hr / 8-day cycle</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start" className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5 text-muted-foreground" />
                Trip start
              </Label>
              <DateTimePicker id="start" value={startTime} onChange={setStartTime} />
              <p className="text-xs text-muted-foreground">Snapped to 15-min marks</p>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-[#1c5cab] shadow-[0_0_18px_rgba(57,135,229,0.28)] transition-shadow hover:shadow-[0_0_26px_rgba(57,135,229,0.45)]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Planning route &amp; checking HOS…
              </>
            ) : (
              'Plan Trip'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
