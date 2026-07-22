import type { PlanTripRequest, PlanTripResponse } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function planTrip(req: PlanTripRequest): Promise<PlanTripResponse> {
  const resp = await fetch(`${API_BASE}/api/plan-trip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    const message =
      body?.error ??
      (body ? Object.values(body).flat().join(' ') : null) ??
      `Request failed (${resp.status})`
    throw new Error(String(message))
  }
  return body as PlanTripResponse
}

export interface NominatimSuggestion {
  display_name: string
  lat: string
  lon: string
}

export async function searchLocations(query: string): Promise<NominatimSuggestion[]> {
  if (query.trim().length < 3) return []
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    countrycodes: 'us,ca,mx',
  })
  const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) return []
  return (await resp.json()) as NominatimSuggestion[]
}
