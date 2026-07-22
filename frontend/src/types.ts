export type DutyStatus = 'off_duty' | 'sleeper' | 'driving' | 'on_duty'

export type StopType =
  | 'start'
  | 'pretrip'
  | 'pickup'
  | 'dropoff'
  | 'fuel'
  | 'break'
  | 'rest'
  | 'restart'

export interface Stop {
  type: StopType
  label: string
  lat: number
  lng: number
  arrival: string
  duration_hrs: number
}

export interface LogSegment {
  status: DutyStatus
  kind: string
  start_min: number
  end_min: number
  remark: string
}

export interface DailyLog {
  date: string
  segments: LogSegment[]
  totals: Record<DutyStatus, { minutes: number; label: string }>
  total_miles_driving: number
}

export interface TripSummaryData {
  start_time: string
  end_time: string
  total_distance_miles: number
  total_driving_hrs: number
  total_on_duty_hrs: number
  total_days: number
  rest_stops: number
  fuel_stops: number
  breaks: number
  restarts: number
  cycle_used_at_end: number | null
  locations: { current: string; pickup: string; dropoff: string }
}

export interface PlanTripResponse {
  route: { polyline: string; distance_miles: number; duration_hrs: number }
  stops: Stop[]
  logs: DailyLog[]
  summary: TripSummaryData
}

export interface PlanTripRequest {
  current_location: string
  pickup_location: string
  dropoff_location: string
  current_cycle_used: number
  start_time?: string
}
