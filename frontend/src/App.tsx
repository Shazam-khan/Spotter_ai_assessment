import { useState } from 'react'
import { AlertCircle, FileText, Map as MapIcon, Printer, Truck } from 'lucide-react'

import type { PlanTripRequest, PlanTripResponse } from '@/types'
import { planTrip } from '@/lib/api'
import { TripForm } from '@/components/TripForm'
import { TripSummary } from '@/components/TripSummary'
import { RouteMap, MapLegend } from '@/components/RouteMap'
import { LogSheet } from '@/components/LogSheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PlanTripResponse | null>(null)

  const handleSubmit = async (req: PlanTripRequest) => {
    setLoading(true)
    setError(null)
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
      <header className="no-print border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">ELD Trip Planner</h1>
            <p className="text-xs text-muted-foreground">
              FMCSA Hours-of-Service compliant routing &amp; daily log generator
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          <div className="no-print space-y-4 lg:sticky lg:top-6 lg:self-start">
            <TripForm loading={loading} onSubmit={handleSubmit} />
            {error && (
              <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {!result && !loading && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
                  <MapIcon className="size-10 text-muted-foreground/40" />
                  <div>
                    <p className="font-medium">No trip planned yet</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Enter a current location, pickup, dropoff and your used cycle hours — you&rsquo;ll
                      get the full route with every required stop plus filled-in daily log sheets.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
                  <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
                  <div>
                    <p className="font-medium">Planning your trip…</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Geocoding, routing, and simulating Hours-of-Service rules.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {result && !loading && (
              <>
                <section className="no-print">
                  <TripSummary summary={result.summary} />
                </section>

                <Card className="no-print">
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

                <section id="log-sheets" className="space-y-4">
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
                    <LogSheet key={log.date} log={log} dayNumber={i + 1} totalDays={result.logs.length} />
                  ))}
                </section>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="no-print border-t border-border py-6 text-center text-xs text-muted-foreground">
        Property-carrying driver · 70 hr / 8 day cycle · No adverse conditions · Fuel every 1,000 mi
      </footer>
    </div>
  )
}
