import type { DutyStatus, StopType } from '@/types'

/** Duty-status series colors — validated categorical slots for dark surfaces.
 *  Off Duty is deliberately recessive (neutral state, not a "series"). */
export const DUTY: Record<DutyStatus, { label: string; color: string }> = {
  driving: { label: 'Driving', color: '#3987e5' },
  on_duty: { label: 'On Duty', color: '#d95926' },
  sleeper: { label: 'Sleeper Berth', color: '#199e70' },
  off_duty: { label: 'Off Duty', color: '#454f63' },
}

/** Lucide icon path data (24×24 stroke icons) rendered as raw SVG strings so
 *  the same artwork works in React and inside Leaflet divIcon HTML. */
const ICON_PATHS: Record<string, string> = {
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  clipboard:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  package:
    '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  coffee:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  rotate:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
}

export const STOP_META: Record<StopType, { title: string; color: string; icon: string }> = {
  start: { title: 'Trip start', color: '#64748b', icon: ICON_PATHS.truck },
  pretrip: { title: 'Pre-trip inspection', color: '#64748b', icon: ICON_PATHS.clipboard },
  pickup: { title: 'Pickup', color: '#3987e5', icon: ICON_PATHS.package },
  dropoff: { title: 'Dropoff', color: '#0ca30c', icon: ICON_PATHS.flag },
  fuel: { title: 'Fuel stop', color: '#c98500', icon: ICON_PATHS.fuel },
  break: { title: '30-min break', color: '#d95926', icon: ICON_PATHS.coffee },
  rest: { title: '10-hr rest', color: '#9085e9', icon: ICON_PATHS.bed },
  restart: { title: '34-hr restart', color: '#e66767', icon: ICON_PATHS.rotate },
}

export function iconSvg(icon: string, color: string, size = 14): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`
}

/** Circular chip marker HTML for Leaflet divIcon. */
export function markerHtml(type: StopType): string {
  const { color, icon } = STOP_META[type]
  return `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#121722;border:2px solid ${color};box-shadow:0 0 0 3px rgba(11,14,20,.65),0 0 14px ${color}66,0 2px 8px rgba(0,0,0,.6)">${iconSvg(icon, color, 15)}</div>`
}
