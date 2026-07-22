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

export interface Recap {
  on_duty_today: string
  total_last_8_days: number
  available_tomorrow: number
  restart_completed: boolean
}

export interface DailyLog {
  date: string
  segments: LogSegment[]
  totals: Record<DutyStatus, { minutes: number; label: string }>
  total_miles_driving: number
  start_miles: number
  end_miles: number
  from_location: string
  to_location: string
  recap: Recap
}

/** Client-side header details for the log sheets (not sent to the API). */
export interface TripDetails {
  driver_name: string
  carrier_name: string
  truck_number: string
  trailer_number: string
  shipper: string
  commodity: string
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
  cycle_used_at_end: number
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
