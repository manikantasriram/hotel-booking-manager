import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { Link } from "react-router";
import { DataTable } from "../components/DataTable";
import type { Features } from "../components/tableFeatures";
import { buttonClass } from "../components/classes";
import { Badge, Button, ErrorNote, PageHeader, Select, Spinner } from "../components/ui";
import { formatDate, money } from "../lib/format";
import { useBookings, useCancelBooking, useHotels, type BookingFilters } from "../lib/queries";
import type { Booking, BookingStatus } from "../lib/types";

const col = createColumnHelper<Features, Booking>();

export function BookingsPage() {
  const [filters, setFilters] = useState<BookingFilters>({});
  const bookings = useBookings(filters);
  const hotels = useHotels();
  const cancel = useCancelBooking();

  const columns = col.columns([
    col.accessor("guest_name", {
      header: "Guest",
      cell: (info) => (
        <div>
          <p className="font-medium">{info.getValue()}</p>
          <p className="text-xs text-mute">{info.row.original.guest_email}</p>
        </div>
      ),
    }),
    col.accessor("hotel_name", {
      header: "Hotel & room",
      cell: (info) => (
        <div>
          <p>{info.getValue()}</p>
          <p className="text-xs text-mute">
            {info.row.original.room_type_name} · {info.row.original.rate_plan_name}
          </p>
        </div>
      ),
    }),
    col.accessor("check_in", {
      header: "Check-in",
      cell: (info) => <span className="whitespace-nowrap">{formatDate(info.getValue())}</span>,
    }),
    col.accessor("nights", { header: "Nights" }),
    col.accessor("guests", { header: "Guests" }),
    col.accessor("total_price", {
      header: "Total",
      cell: (info) => <span className="whitespace-nowrap">{money(info.getValue())}</span>,
    }),
    col.accessor("status", {
      header: "Status",
      cell: (info) =>
        info.getValue() === "confirmed" ? <Badge tone="green">Confirmed</Badge> : <Badge tone="red">Cancelled</Badge>,
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        row.original.status === "confirmed" ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Cancel booking for ${row.original.guest_name}`}
            disabled={cancel.isPending && cancel.variables === row.original.id}
            onClick={() => confirm(`Cancel ${row.original.guest_name}'s booking?`) && cancel.mutate(row.original.id)}
          >
            Cancel
          </Button>
        ) : null,
    }),
  ]);

  const filterBar = (
    <>
      <Select
        aria-label="Filter by hotel"
        className="w-full sm:w-56"
        value={filters.hotel_id ?? ""}
        onChange={(e) => setFilters((f) => ({ ...f, hotel_id: e.target.value ? Number(e.target.value) : undefined }))}
      >
        <option value="">All hotels</option>
        {hotels.data?.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by status"
        className="w-full sm:w-40"
        value={filters.status ?? ""}
        onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as BookingStatus | undefined }))}
      >
        <option value="">Any status</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
      </Select>
    </>
  );

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Sort by any column, search by guest, or filter by hotel and status."
        actions={
          <Link to="/bookings/new" className={buttonClass()}>
            New booking
          </Link>
        }
      />
      {(bookings.error || cancel.error) && (
        <div className="mb-4">
          <ErrorNote error={bookings.error ?? cancel.error} />
        </div>
      )}
      {bookings.isPending ? (
        <Spinner label="Loading bookings" />
      ) : (
        <DataTable
          data={bookings.data ?? []}
          columns={columns}
          toolbar={filterBar}
          searchPlaceholder="Search guests, hotels…"
          initialSorting={[{ id: "check_in", desc: false }]}
          emptyMessage="No bookings match these filters."
          label="Bookings"
        />
      )}
    </>
  );
}
