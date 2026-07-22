import { useState } from 'react'

import type { DailyLog, LogSegment } from '@/types'
import { DUTY } from '@/lib/statusStyles'
import { formatClock } from '@/lib/utils'

const HOUR_TICKS = [0, 6, 12, 18, 24]

function tickLabel(h: number): string {
  if (h === 0 || h === 24) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

function segmentFill(seg: LogSegment): string {
  if (seg.status === 'off_duty') return 'rgba(69, 79, 99, 0.38)'
  return DUTY[seg.status].color
}

interface Hover {
  day: number
  seg: LogSegment
  centerPct: number
}

export function TripTimeline({ logs }: { logs: DailyLog[] }) {
  const [hover, setHover] = useState<Hover | null>(null)

  return (
    <div className="space-y-3">
      {/* Legend — identity is never color alone */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {(['driving', 'on_duty', 'sleeper', 'off_duty'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block size-2.5 rounded-[3px]"
              style={{ background: s === 'off_duty' ? 'rgba(69,79,99,0.7)' : DUTY[s].color }}
            />
            {DUTY[s].label}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {logs.map((log, dayIdx) => {
          const date = new Date(`${log.date}T00:00:00`)
          return (
            <div key={log.date} className="flex items-center gap-3">
              <div className="w-16 shrink-0 text-right">
                <div className="text-xs font-semibold">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
              </div>

              <div className="relative h-7 flex-1">
                {/* hairline hour grid (recessive) */}
                {HOUR_TICKS.map((h) => (
                  <span
                    key={h}
                    className="absolute top-0 h-full w-px bg-border"
                    style={{ left: `${(h / 24) * 100}%` }}
                  />
                ))}
                {log.segments.map((seg, i) => {
                  const left = (seg.start_min / 1440) * 100
                  const width = ((seg.end_min - seg.start_min) / 1440) * 100
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${DUTY[seg.status].label} ${formatClock(seg.start_min)}–${formatClock(seg.end_min)}`}
                      className="absolute top-1 h-5 cursor-default rounded-[4px] outline-none transition-[filter] hover:brightness-125 focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        left: `${left}%`,
                        width: `calc(${width}% - 2px)`,
                        background: segmentFill(seg),
                      }}
                      onMouseEnter={() =>
                        setHover({ day: dayIdx, seg, centerPct: left + width / 2 })
                      }
                      onMouseLeave={() => setHover(null)}
                    />
                  )
                })}

                {hover?.day === dayIdx && (
                  <div
                    className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs shadow-xl"
                    style={{ left: `${Math.min(Math.max(hover.centerPct, 12), 88)}%` }}
                  >
                    <span
                      className="mr-1.5 inline-block size-2 rounded-[2px]"
                      style={{ background: segmentFill(hover.seg) }}
                    />
                    <span className="font-medium">{DUTY[hover.seg.status].label}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {formatClock(hover.seg.start_min)} – {formatClock(hover.seg.end_min)}
                    </span>
                    {hover.seg.remark && (
                      <div className="mt-0.5 max-w-64 truncate text-[11px] text-muted-foreground">
                        {hover.seg.remark}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
                {log.totals.driving.label}
                <span className="ml-0.5 text-[9px]">drv</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hour axis */}
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0" />
        <div className="relative h-4 flex-1">
          {HOUR_TICKS.map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {tickLabel(h)}
            </span>
          ))}
        </div>
        <div className="w-14 shrink-0" />
      </div>
    </div>
  )
}
