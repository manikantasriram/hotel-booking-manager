// The shapes the API sends and receives. They mirror backend/app/schemas.py, so TypeScript
// can catch mistakes like a typo in a field name before the code ever runs.

export type Role = "admin" | "staff";
export type BookingStatus = "confirmed" | "cancelled";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export interface Hotel {
  id: number;
  name: string;
  city: string;
  address: string;
  stars: number;
  description: string;
  room_type_count: number;
  total_rooms: number;
}

export interface RatePlan {
  id: number;
  room_type_id: number;
  name: string;
  price_per_night: number;
  breakfast_included: boolean;
  refundable: boolean;
}

export interface RoomType {
  id: number;
  hotel_id: number;
  name: string;
  capacity: number;
  total_rooms: number;
  rate_plans: RatePlan[];
}

export interface HotelDetail extends Hotel {
  room_types: RoomType[];
}

export interface Booking {
  id: number;
  room_type_id: number;
  rate_plan_id: number;
  hotel_id: number;
  hotel_name: string;
  room_type_name: string;
  rate_plan_name: string;
  guest_name: string;
  guest_email: string;
  check_in: string; // "2026-11-15"
  check_out: string;
  nights: number;
  guests: number;
  status: BookingStatus;
  total_price: number;
  created_by: string | null;
  created_at: string;
}

export interface Availability {
  room_type_id: number;
  check_in: string;
  check_out: string;
  total_rooms: number;
  booked: number;
  available: number;
}

export interface Stats {
  hotels: number;
  rooms: number;
  arrivals_today: number;
  occupied_tonight: number;
  occupancy_tonight: number;
  upcoming_bookings: number;
  revenue_next_30_days: number;
}

// What the forms send
export type HotelInput = Pick<Hotel, "name" | "city" | "address" | "stars" | "description">;
export type RoomTypeInput = Pick<RoomType, "name" | "capacity" | "total_rooms">;
export type RatePlanInput = Omit<RatePlan, "id" | "room_type_id">;
export type BookingInput = Pick<
  Booking,
  "room_type_id" | "rate_plan_id" | "guest_name" | "guest_email" | "check_in" | "check_out" | "guests"
>;
