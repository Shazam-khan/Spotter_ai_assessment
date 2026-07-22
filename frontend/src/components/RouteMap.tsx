import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import polyline from '@mapbox/polyline'

import type { Stop, StopType } from '@/types'
import { STOP_META, iconSvg, markerHtml } from '@/lib/statusStyles'
import { formatDateTime, formatDuration } from '@/lib/utils'

function stopIcon(type: StopType): L.DivIcon {
  return L.divIcon({
    className: '',
    html: markerHtml(type),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] })
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
    <div className="h-[440px] w-full overflow-hidden rounded-lg border border-border lg:h-[500px]">
      <MapContainer center={path[0] ?? [39.5, -95]} zoom={5} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        {/* Route: dark casing + glowing core */}
        <Polyline positions={path} pathOptions={{ color: '#0b0e14', weight: 9, opacity: 0.9 }} />
        <Polyline
          positions={path}
          className="route-glow"
          pathOptions={{ color: '#3987e5', weight: 4, opacity: 0.95 }}
        />
        {visibleStops.map((stop, i) => (
          <Marker key={i} position={[stop.lat, stop.lng]} icon={stopIcon(stop.type)}>
            <Popup>
              <div className="min-w-48 space-y-1 text-[13px]">
                <div className="flex items-center gap-2 font-semibold">
                  <span dangerouslySetInnerHTML={{ __html: iconSvg(STOP_META[stop.type].icon, STOP_META[stop.type].color, 14) }} />
                  {STOP_META[stop.type].title}
                </div>
                <div className="text-[#8b96ad]">{stop.label}</div>
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
  const entries = (Object.keys(STOP_META) as StopType[]).filter((t) => t !== 'pretrip')
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {entries.map((type) => (
        <span key={type} className="inline-flex items-center gap-1.5">
          <span
            className="inline-flex size-5 items-center justify-center rounded-full border"
            style={{ borderColor: STOP_META[type].color }}
            dangerouslySetInnerHTML={{ __html: iconSvg(STOP_META[type].icon, STOP_META[type].color, 10) }}
          />
          {STOP_META[type].title}
        </span>
      ))}
    </div>
  )
}
