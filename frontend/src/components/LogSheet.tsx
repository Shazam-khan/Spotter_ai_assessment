import type { DailyLog, DutyStatus } from '@/types'

const ROW_ORDER: DutyStatus[] = ['off_duty', 'sleeper', 'driving', 'on_duty']
const ROW_LABELS: Record<DutyStatus, [string, string?]> = {
  off_duty: ['1. Off Duty'],
  sleeper: ['2. Sleeper', 'Berth'],
  driving: ['3. Driving'],
  on_duty: ['4. On Duty', '(not driving)'],
}

// SVG geometry (viewBox units)
const GRID_X = 118
const GRID_W = 792 // 33 units per hour, 8.25 per quarter
const GRID_Y = 34
const ROW_H = 40
const GRID_H = ROW_H * 4
const TOTALS_X = GRID_X + GRID_W + 10
const REMARKS_Y = GRID_Y + GRID_H
const REMARKS_H = 148
const SVG_W = 990
const SVG_H = REMARKS_Y + REMARKS_H

const INK = '#1e3a8a' // grid ink (blue like the paper form)
const PEN = '#111827' // the driver's drawn line

function x(min: number): number {
  return GRID_X + (min / 1440) * GRID_W
}

function rowCenterY(status: DutyStatus): number {
  return GRID_Y + ROW_ORDER.indexOf(status) * ROW_H + ROW_H / 2
}

function hourLabel(h: number): string {
  if (h === 0 || h === 24) return 'Mid-night'
  if (h === 12) return 'Noon'
  return String(h % 12)
}

export function LogSheet({ log, dayNumber, totalDays }: { log: DailyLog; dayNumber: number; totalDays: number }) {
  const date = new Date(`${log.date}T00:00:00`)
  const remarks = log.segments.filter((s) => s.remark && s.kind !== 'drive')
  const grandTotal = Object.values(log.totals).reduce((acc, t) => acc + t.minutes, 0)

  return (
    <div className="log-sheet-page overflow-hidden rounded-lg bg-[#fdfdfa] shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
      {/* Paper header */}
      <div className="border-b border-slate-300 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight text-slate-900">
              Driver&rsquo;s Daily Log
              <span className="ml-2 text-xs font-medium text-slate-500">(24 hours)</span>
            </h3>
            <p className="mt-0.5 text-sm font-medium text-slate-600">
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div className="font-semibold text-slate-700">
              Sheet {dayNumber} of {totalDays}
            </div>
            <div>Original — file at home terminal</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 sm:grid-cols-4">
          <div>
            <div className="font-mono text-sm font-semibold text-slate-900">
              {Math.round(log.total_miles_driving)} mi
            </div>
            <div className="border-t border-slate-300 pt-0.5">Total miles driving today</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Property Carrier</div>
            <div className="border-t border-slate-300 pt-0.5">Name of carrier</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">70 hr / 8 day</div>
            <div className="border-t border-slate-300 pt-0.5">Cycle rule</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">N/A</div>
            <div className="border-t border-slate-300 pt-0.5">Co-driver</div>
          </div>
        </div>
      </div>

      {/* The 24-hour grid */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="min-w-[760px]"
          role="img"
          aria-label={`Daily log grid for ${log.date}`}
        >
          {/* Hour labels */}
          {Array.from({ length: 25 }, (_, h) => (
            <text
              key={h}
              x={x(h * 60)}
              y={GRID_Y - 8}
              textAnchor="middle"
              fontSize={h % 12 === 0 ? 8 : 10}
              fontWeight={600}
              fill={INK}
            >
              {hourLabel(h)}
            </text>
          ))}
          <text x={TOTALS_X + 28} y={GRID_Y - 16} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK}>
            Total
          </text>
          <text x={TOTALS_X + 28} y={GRID_Y - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK}>
            Hours
          </text>

          {/* Row bands + labels */}
          {ROW_ORDER.map((status, i) => {
            const yTop = GRID_Y + i * ROW_H
            const [line1, line2] = ROW_LABELS[status]
            return (
              <g key={status}>
                <rect
                  x={GRID_X}
                  y={yTop}
                  width={GRID_W}
                  height={ROW_H}
                  fill={i % 2 === 0 ? '#ffffff' : '#f8fafc'}
                  stroke="none"
                />
                <text x={8} y={yTop + (line2 ? ROW_H / 2 - 4 : ROW_H / 2 + 3)} fontSize={10.5} fontWeight={700} fill={INK}>
                  {line1}
                </text>
                {line2 && (
                  <text x={8} y={yTop + ROW_H / 2 + 8} fontSize={8.5} fill={INK}>
                    {line2}
                  </text>
                )}
              </g>
            )
          })}

          {/* Vertical hour + quarter tick lines */}
          {Array.from({ length: 97 }, (_, q) => {
            const minute = q * 15
            const isHour = q % 4 === 0
            const isHalf = q % 2 === 0
            if (isHour) {
              return (
                <line
                  key={q}
                  x1={x(minute)}
                  y1={GRID_Y}
                  x2={x(minute)}
                  y2={GRID_Y + GRID_H}
                  stroke={INK}
                  strokeWidth={minute % 720 === 0 ? 1.6 : 0.8}
                  opacity={0.9}
                />
              )
            }
            // Quarter/half ticks drawn inside each row from its top edge
            return ROW_ORDER.map((_, i) => (
              <line
                key={`${q}-${i}`}
                x1={x(minute)}
                y1={GRID_Y + i * ROW_H}
                x2={x(minute)}
                y2={GRID_Y + i * ROW_H + (isHalf ? 13 : 8)}
                stroke={INK}
                strokeWidth={0.6}
                opacity={0.75}
              />
            ))
          })}

          {/* Horizontal row separators */}
          {Array.from({ length: 5 }, (_, i) => (
            <line
              key={i}
              x1={GRID_X}
              y1={GRID_Y + i * ROW_H}
              x2={GRID_X + GRID_W}
              y2={GRID_Y + i * ROW_H}
              stroke={INK}
              strokeWidth={i === 0 || i === 4 ? 1.6 : 1}
            />
          ))}

          {/* Totals column */}
          <rect x={TOTALS_X} y={GRID_Y} width={56} height={GRID_H} fill="#ffffff" stroke={INK} strokeWidth={1.2} />
          {ROW_ORDER.map((status, i) => (
            <g key={status}>
              {i > 0 && (
                <line
                  x1={TOTALS_X}
                  y1={GRID_Y + i * ROW_H}
                  x2={TOTALS_X + 56}
                  y2={GRID_Y + i * ROW_H}
                  stroke={INK}
                  strokeWidth={0.8}
                />
              )}
              <text
                x={TOTALS_X + 28}
                y={GRID_Y + i * ROW_H + ROW_H / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fontFamily="'JetBrains Mono', monospace"
                fill={PEN}
              >
                {log.totals[status].label}
              </text>
            </g>
          ))}
          <text
            x={TOTALS_X + 28}
            y={GRID_Y + GRID_H + 16}
            textAnchor="middle"
            fontSize={10.5}
            fontWeight={800}
            fontFamily="'JetBrains Mono', monospace"
            fill={grandTotal === 1440 ? '#15803d' : '#b91c1c'}
          >
            = {Math.floor(grandTotal / 60)}:{(grandTotal % 60).toString().padStart(2, '0')}
          </text>

          {/* The drawn duty line */}
          {log.segments.map((seg, i) => {
            const y = rowCenterY(seg.status)
            const next = log.segments[i + 1]
            return (
              <g key={i}>
                <line x1={x(seg.start_min)} y1={y} x2={x(seg.end_min)} y2={y} stroke={PEN} strokeWidth={2.6} strokeLinecap="round" />
                {next && (
                  <line
                    x1={x(seg.end_min)}
                    y1={y}
                    x2={x(seg.end_min)}
                    y2={rowCenterY(next.status)}
                    stroke={PEN}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                  />
                )}
                {next && <circle cx={x(seg.end_min)} cy={y} r={3} fill="#dc2626" />}
                {next && <circle cx={x(seg.end_min)} cy={rowCenterY(next.status)} r={3} fill="#dc2626" />}
              </g>
            )
          })}

          {/* Remarks */}
          <text x={8} y={REMARKS_Y + 24} fontSize={11} fontWeight={800} fill={INK}>
            REMARKS
          </text>
          <line
            x1={GRID_X}
            y1={REMARKS_Y + 30}
            x2={GRID_X + GRID_W}
            y2={REMARKS_Y + 30}
            stroke={INK}
            strokeWidth={0.8}
            opacity={0.5}
          />
          {remarks.map((seg, i) => {
            const rx = x(seg.start_min)
            return (
              <g key={i}>
                <line x1={rx} y1={REMARKS_Y} x2={rx} y2={REMARKS_Y + 30} stroke={PEN} strokeWidth={1} opacity={0.6} />
                <text
                  x={rx}
                  y={REMARKS_Y + 36}
                  fontSize={9.5}
                  fill={PEN}
                  transform={`rotate(38 ${rx} ${REMARKS_Y + 36})`}
                >
                  {seg.remark}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
