import type { DailyLog, DutyStatus, TripDetails } from '@/types'

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
const REMARKS_H = 150
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

function Field({ value, label, mono }: { value: string; label: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`truncate text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </div>
      <div className="truncate border-t border-slate-300 pt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  )
}

function MileBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1">
      <div className="rounded-sm border border-slate-400 px-2 py-1.5 text-center font-mono text-sm font-semibold text-slate-900">
        {value}
      </div>
      <div className="mt-0.5 text-center text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  )
}

interface Props {
  log: DailyLog
  dayNumber: number
  totalDays: number
  details: TripDetails
  homeTerminal: string
}

export function LogSheet({ log, dayNumber, totalDays, details, homeTerminal }: Props) {
  const date = new Date(`${log.date}T00:00:00`)
  const remarks = log.segments.filter((s) => s.remark)
  const grandTotal = Object.values(log.totals).reduce((acc, t) => acc + t.minutes, 0)
  const dayMiles = Math.round(log.total_miles_driving)
  const pad = (n: number) => n.toString().padStart(2, '0')

  return (
    <div className="log-sheet-page overflow-hidden rounded-lg bg-[#fdfdfa] shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
      {/* ── Paper header ─────────────────────────────────────────────── */}
      <div className="border-b border-slate-300 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight text-slate-900">
              Driver&rsquo;s Daily Log
              <span className="ml-2 text-xs font-medium text-slate-500">(24 hours)</span>
            </h3>
            <div className="mt-1 flex items-end gap-1 font-mono text-sm font-semibold text-slate-900">
              <span className="border-b border-slate-400 px-1">{pad(date.getMonth() + 1)}</span>/
              <span className="border-b border-slate-400 px-1">{pad(date.getDate())}</span>/
              <span className="border-b border-slate-400 px-1">{date.getFullYear()}</span>
              <span className="ml-2 text-[10px] font-sans font-normal uppercase tracking-wide text-slate-500">
                (month) (day) (year)
              </span>
            </div>
          </div>
          <div className="text-right text-[10px] leading-4 text-slate-500">
            <div className="text-xs font-semibold text-slate-700">
              Sheet {dayNumber} of {totalDays}
            </div>
            <div>Original — file at home terminal.</div>
            <div>Duplicate — driver retains in possession for 8 days.</div>
          </div>
        </div>

        {/* From / To */}
        <div className="mt-3 grid grid-cols-2 gap-x-6">
          <Field value={log.from_location} label="From" />
          <Field value={log.to_location} label="To" />
        </div>

        {/* Mileage / carrier / addresses */}
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          <div className="flex gap-2">
            <MileBox value={String(dayMiles)} label="Total miles driving today" />
            <MileBox value={String(dayMiles)} label="Total mileage today" />
          </div>
          <Field value={details.carrier_name} label="Name of carrier or carriers" />
          <Field
            value={`${details.truck_number} / ${details.trailer_number}`}
            label="Truck/tractor & trailer numbers"
            mono
          />
          <Field value={homeTerminal} label="Main office address" />
          <Field value={homeTerminal} label="Home terminal address" />
          <Field value={`${details.shipper} — ${details.commodity}`} label="Shipper & commodity" />
        </div>

        {/* Signature row */}
        <div className="mt-3 grid grid-cols-2 gap-x-6">
          <div className="min-w-0">
            <div
              className="truncate text-lg leading-6 text-slate-800"
              style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive' }}
            >
              {details.driver_name || ' '}
            </div>
            <div className="border-t border-slate-400 pt-0.5 text-[10px] uppercase leading-tight tracking-wide text-slate-500">
              Driver&rsquo;s signature in full — I certify these entries are true and correct
            </div>
          </div>
          <Field value="N/A" label="Name of co-driver" />
        </div>
      </div>

      {/* ── The 24-hour grid ─────────────────────────────────────────── */}
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
          {(() => {
            // Paper-log style: a tick at each event, nearby events (post-trip +
            // rest, fuel + break) share one bracket, and the label runs at 45°
            // like handwriting — city on the first line, activities stacked
            // beneath it.
            interface RemarkGroup {
              lines: string[]
              x1: number
              x2: number
              lastMin: number
            }
            const groups: RemarkGroup[] = []
            for (const seg of remarks) {
              const [city, ...restParts] = seg.remark.split(' — ')
              const activity = restParts.join(' — ')
              const last = groups[groups.length - 1]
              if (last && seg.start_min - last.lastMin <= 60) {
                // Same location moments later (post-trip → rest, fuel → break):
                // one bracket, activities stacked under the shared city line.
                last.lines.push(activity || city)
                last.lastMin = seg.start_min
              } else {
                groups.push({
                  lines: activity ? [city, activity] : [city],
                  // The bracket spans the event's own duration, like the paper
                  // form (capped at 1 hr so a long rest isn't bracketed whole).
                  x1: x(seg.start_min),
                  x2: x(Math.min(seg.end_min, seg.start_min + 60)),
                  lastMin: seg.start_min,
                })
              }
            }
            const barY = REMARKS_Y + 14
            return groups.map((g, i) => {
              const ax = (g.x1 + g.x2) / 2
              const ty = barY + 10
              return (
                <g key={i}>
                  <line x1={g.x1} y1={REMARKS_Y} x2={g.x1} y2={barY} stroke={PEN} strokeWidth={1.6} />
                  {g.x2 - g.x1 > 3 && (
                    <>
                      <line x1={g.x2} y1={REMARKS_Y} x2={g.x2} y2={barY} stroke={PEN} strokeWidth={1.6} />
                      <line x1={g.x1} y1={barY} x2={g.x2} y2={barY} stroke={PEN} strokeWidth={1.6} />
                    </>
                  )}
                  <text
                    x={ax}
                    y={ty}
                    fontSize={10.5}
                    fontWeight={700}
                    fill={PEN}
                    textAnchor="end"
                    transform={`rotate(-45 ${ax} ${ty})`}
                  >
                    {g.lines.map((line, j) => (
                      <tspan key={j} x={ax} dy={j === 0 ? 0 : 14}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              )
            })
          })()}
        </svg>
      </div>

      {/* ── 70-hr / 8-day recap ──────────────────────────────────────── */}
      <div className="border-t border-slate-300 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
            Recap
            <span className="ml-1 font-medium normal-case text-slate-500">— 70 hour / 8 day</span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <div className="font-mono text-sm font-semibold text-slate-900">
                {log.recap.on_duty_today}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                A. On-duty hours today (lines 3 &amp; 4)
              </div>
            </div>
            <div>
              <div className="font-mono text-sm font-semibold text-slate-900">
                {log.recap.total_last_8_days.toFixed(2)} hr
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                B. Total on duty last 8 days
              </div>
            </div>
            <div>
              <div className="font-mono text-sm font-semibold text-slate-900">
                {log.recap.available_tomorrow.toFixed(2)} hr
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                C. Hours available tomorrow (70 − B)
              </div>
            </div>
          </div>
          {log.recap.restart_completed && (
            <span className="rounded-full border border-emerald-600/40 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              34-hr restart completed — cycle reset to a fresh 70
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
