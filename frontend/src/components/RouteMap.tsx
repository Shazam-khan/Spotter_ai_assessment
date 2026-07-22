import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import polyline from '@mapbox/polyline'

import type { Stop, StopType } from '@/types'
import { formatDateTime, formatDuration } from '@/lib/utils'

const STOP_STYLE: Record<StopType, { emoji: string; color: string; title: string }> = {
  start: { emoji: '🚛', color: '#334155', title: 'Trip start' },
  pretrip: { emoji: '📋', color: '#64748b', title: 'Pre-trip inspection' },
  pickup: { emoji: '📦', color: '#2563eb', title: 'Pickup' },
  dropoff: { emoji: '🏁', color: '#16a34a', title: 'Dropoff' },
  fuel: { emoji: '⛽', color: '#d97706', title: 'Fuel stop' },
  break: { emoji: '☕', color: '#9333ea', title: '30-min break' },
  rest: { emoji: '🛏️', color: '#dc2626', title: '10-hr rest' },
  restart: { emoji: '🔄', color: '#be123c', title: '34-hr restart' },
}

function stopIcon(type: StopType): L.DivIcon {
  const { emoji, color } = STOP_STYLE[type]
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:white;border:2.5px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.35);font-size:15px;line-height:1">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  })
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [36, 36] })
    }
  }, [map, positions])
  return null
}

interface Props {
  encodedPolyline: string
  stops: Stop[]
}

export function RouteMap({ encodedPolyline, stops }: Props) {
  const path = useMemo(
    () => polyline.decode(encodedPolyline) as [number, number][],
    [encodedPolyline],
  )
  // Pre-trip happens at the start marker's position — skip the duplicate pin.
  const visibleStops = stops.filter((s) => s.type !== 'pretrip')

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-border lg:h-[480px]">
      <MapContainer center={path[0] ?? [39.5, -95]} zoom={5} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={path} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }} />
      {visibleStops.map((stop, i) => (
        <Marker key={i} position={[stop.lat, stop.lng]} icon={stopIcon(stop.type)}>
          <Popup>
            <div className="min-w-44 space-y-0.5 text-[13px]">
              <div className="font-semibold">{STOP_STYLE[stop.type].title}</div>
              <div className="text-slate-600">{stop.label}</div>
              <div>
                <span className="font-medium">Arrive:</span> {formatDateTime(stop.arrival)}
              </div>
              {stop.duration_hrs > 0 && (
                <div>
                  <span className="font-medium">Duration:</span> {formatDuration(stop.duration_hrs)}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
        <FitBounds positions={path} />
      </MapContainer>
    </div>
  )
}

export function MapLegend() {
  const entries = Object.entries(STOP_STYLE).filter(([type]) => type !== 'pretrip')
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {entries.map(([type, { emoji, title }]) => (
        <span key={type} className="inline-flex items-center gap-1">
          <span>{emoji}</span> {title}
        </span>
      ))}
    </div>
  )
}
