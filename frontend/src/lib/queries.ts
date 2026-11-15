// All server data goes through TanStack Query. It fetches, caches and re-fetches for us:
// - useQuery    reads data (it shows cached data instantly and refreshes in the background)
// - useMutation changes data, then we "invalidate" the affected queries so they reload.
// Query keys (["bookings", filters]) name each piece of cached data.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./api";
import type {
  Availability,
  Booking,
  BookingInput,
  BookingStatus,
  Hotel,
  HotelDetail,
  HotelInput,
  RatePlan,
  RatePlanInput,
  RoomType,
  RoomTypeInput,
  Stats,
} from "./types";

export const keys = {
  stats: ["stats"] as const,
  hotels: ["hotels"] as const,
  hotel: (id: number) => ["hotels", id] as const,
  bookings: (filters: BookingFilters = {}) => ["bookings", filters] as const,
  availability: (roomTypeId: number, checkIn: string, checkOut: string) =>
    ["availability", roomTypeId, checkIn, checkOut] as const,
};

// ---------- reads ----------
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: () => http.get<Stats>("/api/stats") });

export const useHotels = () => useQuery({ queryKey: keys.hotels, queryFn: () => http.get<Hotel[]>("/api/hotels") });

export const useHotel = (id: number) =>
  useQuery({
    queryKey: keys.hotel(id),
    queryFn: () => http.get<HotelDetail>(`/api/hotels/${id}`),
    enabled: Number.isInteger(id) && id > 0, // wait until a hotel is actually chosen
  });

export interface BookingFilters {
  hotel_id?: number;
  status?: BookingStatus;
}

export const useBookings = (filters: BookingFilters = {}) =>
  useQuery({
    queryKey: keys.bookings(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.hotel_id) params.set("hotel_id", String(filters.hotel_id));
      if (filters.status) params.set("status", filters.status);
      const qs = params.toString();
      return http.get<Booking[]>(`/api/bookings${qs ? `?${qs}` : ""}`);
    },
  });

export const useAvailability = (roomTypeId: number | undefined, checkIn: string, checkOut: string) =>
  useQuery({
    queryKey: keys.availability(roomTypeId ?? 0, checkIn, checkOut),
    queryFn: () =>
      http.get<Availability>(
        `/api/room-types/${roomTypeId}/availability?check_in=${checkIn}&check_out=${checkOut}`,
      ),
    // only ask once we have a room type and a valid date range
    enabled: Boolean(roomTypeId && checkIn && checkOut && checkOut > checkIn),
  });

// ---------- writes ----------
export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BookingInput) => http.post<Booking>("/api/bookings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

/**
 * Cancelling uses an OPTIMISTIC UPDATE: the row shows "cancelled" the instant you click,
 * before the server answers. If the server says no, we put the old data back.
 */
export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http.post<Booking>(`/api/bookings/${id}/cancel`),
    onMutate: async (id) => {
      // stop in-flight refreshes from overwriting our optimistic change
      await qc.cancelQueries({ queryKey: ["bookings"] });
      // remember every cached bookings list, then mark the booking cancelled in each
      const previous = qc.getQueriesData<Booking[]>({ queryKey: ["bookings"] });
      qc.setQueriesData<Booking[]>({ queryKey: ["bookings"] }, (list) =>
        list?.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data)); // roll back
    },
    onSettled: () => {
      // either way, re-sync with the server
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

function useHotelMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.hotels }); // also refreshes every ["hotels", id]
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export const useCreateHotel = () => useHotelMutation((body: HotelInput) => http.post<Hotel>("/api/hotels", body));
export const useUpdateHotel = () =>
  useHotelMutation(({ id, ...body }: HotelInput & { id: number }) => http.put<Hotel>(`/api/hotels/${id}`, body));
export function useDeleteHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http.delete(`/api/hotels/${id}`),
    onSuccess: () => {
      // Refresh only the list (exact), not ["hotels", id]: that hotel is gone, so re-fetching it
      // would just return 404 while its page is closing.
      qc.invalidateQueries({ queryKey: keys.hotels, exact: true });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export const useCreateRoomType = () =>
  useHotelMutation((body: RoomTypeInput & { hotel_id: number }) => http.post<RoomType>("/api/room-types", body));
export const useUpdateRoomType = () =>
  useHotelMutation(({ id, ...body }: RoomTypeInput & { id: number }) =>
    http.put<RoomType>(`/api/room-types/${id}`, body),
  );
export const useDeleteRoomType = () => useHotelMutation((id: number) => http.delete(`/api/room-types/${id}`));

export const useCreateRatePlan = () =>
  useHotelMutation((body: RatePlanInput & { room_type_id: number }) => http.post<RatePlan>("/api/rate-plans", body));
export const useUpdateRatePlan = () =>
  useHotelMutation(({ id, ...body }: RatePlanInput & { id: number }) =>
    http.put<RatePlan>(`/api/rate-plans/${id}`, body),
  );
export const useDeleteRatePlan = () => useHotelMutation((id: number) => http.delete(`/api/rate-plans/${id}`));
