// Types and static data for the rides feature. Kept out of page.tsx so the
// route file only composes the feature components.

export interface Hotspot {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description?: string;
  popular?: boolean;
}

// The API returns each stop as an object ({place, sequence, status}); the
// create-ride form and some older paths use plain strings. Accept either, so a
// multi-stop ride does not crash the page.
export type RideStop = string | { place?: string; stop_name?: string; name?: string; id?: string };

export const stopPlace = (stop: RideStop): string =>
  typeof stop === "string"
    ? stop
    : (stop?.place ?? stop?.stop_name ?? stop?.name ?? stop?.id ?? "");

// Feature 18: what cancelling would cost, previewed before anything happens.
export interface CancelQuote {
  will_be_charged: boolean;
  penalty: number;
  exposure: number;
  dispatched: boolean;
  role: "driver" | "passenger";
  reason: string;
  wallet_balance: number;
  policy: {
    free_before_dispatch: boolean;
    penalty_rate: number;
    min_penalty: number;
    max_penalty: number;
  };
}

// The driver's view of who has asked for a seat. `id` is the ride_passengers
// row id, which is what POST /rides/{id}/accept/{passenger_id} expects.
export interface RidePassenger {
  id: string;
  passenger_id: string;
  passenger_name: string;
  seats: number;
  pickup_stop: string;
  dropoff_stop: string;
  status: string;
}

export interface StopInfo {
  id: string;
  stop_name: string;
  stop_order: number;
  status: "pending" | "reached" | "departed";
  reached_at?: string | null;
}

export interface RideInfo {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_gender?: string;
  source: string;
  destination: string;
  status: string;
  distance_km: number | null;
  base_fare: number;
  surge_multiplier: number;
  total_seats: number;
  available_seats?: number;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  female_only?: boolean;
  stops?: RideStop[];
  stop_details?: StopInfo[];
  my_seat_status?: "requested" | "accepted" | "completed" | "cancelled" | null;
}

export interface MatchResult {
  ride: RideInfo;
  match_score: number;
  score_percentage: number;
  reasons: string[];
  pickup_distance_km: number;
  dropoff_distance_km: number;
  time_difference_mins: number | null;
}

// Raw item from /api/rides/match: either a scored match (the ride nested
// under `ride`) or a plain ride with optional scoring fields alongside it.
export interface MatchCandidate {
  ride?: RideInfo;
  id?: string;
  driver_id?: string;
  driver_name?: string;
  source?: string;
  destination?: string;
  status?: string;
  distance_km?: number | null;
  base_fare?: number;
  surge_multiplier?: number;
  total_seats?: number;
  available_seats?: number;
  scheduled_at?: string | null;
  female_only?: boolean;
  stops?: RideStop[];
  match_score?: number;
  score_percentage?: number;
  reasons?: string[];
  match_reasons?: string[];
  pickup_distance_km?: number;
  dropoff_distance_km?: number;
  time_difference_mins?: number | null;
}

export interface SurgeInfo {
  hour: number;
  demand: number;
  active_rides: number;
  multiplier: number;
  label: string;
  message: string;
}

export interface SurgeHour {
  hour: number;
  demand: number;
  multiplier: number;
  label: string;
  is_current: boolean;
}

export interface SplitInfo {
  ride_id: string;
  source: string;
  destination: string;
  base_fare: number;
  surge_multiplier: number;
  total: number;
  total_seats: number;
  passenger_count: number;
  per_seat: number | null;
  breakdown: {
    passenger: string;
    seats: number;
    share: number;
    pickup_stop?: string;
    dropoff_stop?: string;
  }[];
}

export interface MeInfo {
  id: string;
  name?: string;
  role?: string;
  gender?: string;
}

export interface RideForm {
  source: string;
  destination: string;
  base_fare: string;
  total_seats: string;
  scheduled_at: string;
  female_only: boolean;
  stops: string[];
}

export const EMPTY_RIDE_FORM: RideForm = {
  source: "",
  destination: "",
  base_fare: "",
  total_seats: "4",
  scheduled_at: "",
  female_only: false,
  stops: [],
};

export const CLASS_SCHEDULES = [
  { label: "08:00 AM Class", time: "08:00" },
  { label: "09:30 AM Class", time: "09:30" },
  { label: "11:00 AM Class", time: "11:00" },
  { label: "02:00 PM Class", time: "14:00" },
  { label: "03:30 PM Class", time: "15:30" },
  { label: "05:00 PM Return", time: "17:00" },
];
