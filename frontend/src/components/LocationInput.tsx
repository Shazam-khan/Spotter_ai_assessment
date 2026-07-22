import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

import { searchLocations, type NominatimSuggestion } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export function LocationInput({ id, label, placeholder, value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const skipNextSearch = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    if (value.trim().length < 3) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      const results = await searchLocations(value)
      setSuggestions(results)
      setOpen(results.length > 0)
    }, 350)
    return () => clearTimeout(timer)
  }, [value])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          className="pl-8"
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          required
        />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
          {suggestions.map((s) => (
            <li key={`${s.lat},${s.lon}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  skipNextSearch.current = true
                  onChange(s.display_name)
                  setOpen(false)
                }}
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
