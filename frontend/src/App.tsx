import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  FileText,
  Map as MapIcon,
  Printer,
  ShieldCheck,
  Truck,
} from 'lucide-react'

import type { PlanTripRequest, PlanTripResponse, TripDetails } from '@/types'
import { planTrip } from '@/lib/api'
import { TripForm } from '@/components/TripForm'
import { TripSummary } from '@/components/TripSummary'
import { TripTimeline } from '@/components/TripTimeline'
import { RouteMap, MapLegend } from '@/components/RouteMap'
import { LogSheet } from '@/components/LogSheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function LoadingCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-5 py-24 text-center">
        <div className="relative w-56">
          <div className="truck-bob flex justify-center text-primary">
            <Truck className="size-10" />
          </div>
          <svg viewBox="0 0 224 8" className="mt-2 w-full">
            <line x1="0" y1="4" x2="224" y2="4" stroke="#2a3348" strokeWidth="2" />
            <line x1="0" y1="4" x2="224" y2="4" stroke="#3987e5" strokeWidth="2" className="road-line" />
          </svg>
        </div>
        <div>
          <p className="font-medium">Planning your trip…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Geocoding, routing via OSRM, and simulating FMCSA Hours-of-Service rules.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-secondary text-primary">
          <MapIcon className="size-6" />
        </div>
        <div>
          <p className="font-semibold">No trip planned yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Enter a current location, pickup, dropoff and your used cycle hours — you&rsquo;ll get
            the full route with every required stop plus filled-in daily log sheets.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
          {['11-hr driving limit', '14-hr window', '30-min breaks', '70-hr cycle', 'Fuel every 1,000 mi'].map(
            (rule) => (
              <span key={rule} className="rounded-full border border-border bg-secondary px-2.5 py-1">
                {rule}
              </span>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const DEMO_DETAILS: TripDetails = {
  driver_name: 'Sam Carter',
  carrier_name: 'Spotter Freight Lines',
  truck_number: 'TRK-1024',
  trailer_number: 'TRL-5088',
  shipper: 'Acme Distribution',
  commodity: 'General freight',
}

export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PlanTripResponse | null>(null)
  const [details, setDetails] = useState<TripDetails>(DEMO_DETAILS)

  const handleSubmit = async (req: PlanTripRequest, formDetails: TripDetails) => {
    setLoading(true)
    setError(null)
    // Blank fields fall back to demo values so the log header is never empty.
    setDetails({
      driver_name: formDetails.driver_name.trim() || DEMO_DETAILS.driver_name,
      carrier_name: formDetails.carrier_name.trim() || DEMO_DETAILS.carrier_name,
      truck_number: formDetails.truck_number.trim() || DEMO_DETAILS.truck_number,
      trailer_number: formDetails.trailer_number.trim() || DEMO_DETAILS.trailer_number,
      shipper: formDetails.shipper.trim() || DEMO_DETAILS.shipper,
      commodity: formDetails.commodity.trim() || DEMO_DETAILS.commodity,
    })
    try {
      setResult(await planTrip(req))
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#1c5cab] text-primary-foreground shadow-[0_0_20px_rgba(57,135,229,0.35)]">
              <Truck className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">ELD Trip Planner</h1>
              <p className="text-xs text-muted-foreground">
                Hours-of-Service compliant routing &amp; daily log generator
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
              <ShieldCheck className="size-3.5 text-[#0ca30c]" />
              FMCSA Part 395
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
              <Activity className="size-3.5 text-primary" />
              70 hr / 8 day
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          <div className="no-print space-y-4 lg:sticky lg:top-20 lg:self-start">
            <TripForm loading={loading} onSubmit={handleSubmit} />
            {error && (
              <div className="fade-up flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {!result && !loading && <EmptyCard />}
            {loading && <LoadingCard />}

            {result && !loading && (
              <>
                <section className="fade-up no-print">
                  <TripSummary summary={result.summary} />
                </section>

                <Card className="fade-up no-print" style={{ animationDelay: '60ms' }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapIcon className="size-4 text-primary" />
                      Route &amp; Planned Stops
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <RouteMap encodedPolyline={result.route.polyline} stops={result.stops} />
                    <MapLegend />
                  </CardContent>
                </Card>

                <Card className="fade-up no-print" style={{ animationDelay: '120ms' }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="size-4 text-primary" />
                      Duty Status Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TripTimeline logs={result.logs} />
                  </CardContent>
                </Card>

                <section id="log-sheets" className="fade-up space-y-4" style={{ animationDelay: '180ms' }}>
                  <div className="no-print flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <FileText className="size-4 text-primary" />
                      Driver&rsquo;s Daily Logs
                      <span className="text-sm font-normal text-muted-foreground">
                        ({result.logs.length} {result.logs.length === 1 ? 'sheet' : 'sheets'})
                      </span>
                    </h2>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer />
                      Print / Save PDF
                    </Button>
                  </div>
                  {result.logs.map((log, i) => (
                    <LogSheet
                      key={log.date}
                      log={log}
                      dayNumber={i + 1}
                      totalDays={result.logs.length}
                      details={details}
                      homeTerminal={result.summary.locations.current}
                    />
                  ))}
                </section>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="no-print border-t border-border py-6 text-center text-xs text-muted-foreground">
        Property-carrying driver · 70 hr / 8 day cycle · No adverse conditions · Fuel every 1,000 mi ·
        Routing by OSRM · Geocoding by Nominatim
      </footer>
    </div>
  )
}
