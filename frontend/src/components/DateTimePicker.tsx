import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** value format: "YYYY-MM-DDTHH:mm" (local, matches datetime-local) */
function parseValue(value: string): Date {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${ampm}`
}

interface Props {
  id: string
  value: string
  onChange: (value: string) => void
}

export function DateTimePicker({ id, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseValue(value), [value])
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())
  const containerRef = useRef<HTMLDivElement>(null)
  const timeListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // When opening, sync the visible month and scroll the time list to selection.
  useEffect(() => {
    if (!open) return
    setViewYear(selected.getFullYear())
    setViewMonth(selected.getMonth())
    const idx = (selected.getHours() * 60 + selected.getMinutes()) / 15
    requestAnimationFrame(() => {
      timeListRef.current?.scrollTo({ top: Math.max(0, idx * 32 - 64) })
    })
  }, [open, selected])

  const firstDayOffset = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const today = new Date()
  const selectedMinutes = selected.getHours() * 60 + selected.getMinutes()

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const pickDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day, selected.getHours(), selected.getMinutes())
    onChange(toValue(d))
  }

  const pickTime = (minutes: number) => {
    const d = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate(),
      Math.floor(minutes / 60),
      minutes % 60,
    )
    onChange(toValue(d))
    setOpen(false)
  }

  const isSelectedDay = (day: number) =>
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day
  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-card px-3 py-1 text-left text-sm shadow-sm transition-colors',
          'hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-ring/60 ring-2 ring-ring',
        )}
      >
        <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {selected.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            ...(selected.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
          })}
          <span className="text-muted-foreground"> · </span>
          {timeLabel(selectedMinutes)}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute right-0 z-30 mt-1.5 flex w-[19.5rem] overflow-hidden rounded-lg border border-border bg-panel shadow-2xl"
        >
          {/* Calendar */}
          <div className="flex-1 p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="text-xs font-semibold">
                {MONTHS[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1 text-[10px] font-medium text-muted-foreground">
                  {d}
                </span>
              ))}
              {Array.from({ length: firstDayOffset }, (_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pickDay(day)}
                    className={cn(
                      'mx-auto flex size-7 items-center justify-center rounded-md text-xs transition-colors',
                      isSelectedDay(day)
                        ? 'bg-primary font-semibold text-primary-foreground shadow-[0_0_10px_rgba(57,135,229,0.45)]'
                        : 'hover:bg-accent',
                      !isSelectedDay(day) && isToday(day) && 'border border-primary/50 text-primary',
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 15-min time list */}
          <div className="w-[6.75rem] border-l border-border">
            <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="size-3" />
              Time
            </div>
            <div ref={timeListRef} className="h-56 overflow-y-auto pb-2">
              {Array.from({ length: 96 }, (_, i) => {
                const minutes = i * 15
                const active = minutes === selectedMinutes
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => pickTime(minutes)}
                    className={cn(
                      'flex h-8 w-full items-center px-3 font-mono text-xs transition-colors',
                      active
                        ? 'bg-primary/15 font-semibold text-primary'
                        : 'text-secondary-foreground hover:bg-accent',
                    )}
                  >
                    {timeLabel(minutes)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
