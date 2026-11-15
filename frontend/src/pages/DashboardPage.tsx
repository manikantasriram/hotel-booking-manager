import { Link } from "react-router";
import { useAuth } from "../auth/useAuth";
import { Badge, Card, ErrorNote, PageHeader, Spinner } from "../components/ui";
import { formatDate, isoDate, money, percent } from "../lib/format";
import { useBookings, useStats } from "../lib/queries";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-mute">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-mute">{note}</p>}
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const stats = useStats();
  const bookings = useBookings({ status: "confirmed" });
  const today = isoDate();
  const arrivals = (bookings.data ?? [])
    .filter((b) => b.check_in >= today)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .slice(0, 6);

  return (
    <>
      <PageHeader title={`Hello, ${user?.full_name.split(" ")[0] ?? "there"}`} subtitle="Here's how your hotels look today." />

      <ErrorNote error={stats.error} />
      {stats.isPending ? (
        <Spinner label="Loading the numbers" />
      ) : stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Occupancy tonight" value={percent(stats.data.occupancy_tonight)} note={`${stats.data.occupied_tonight} of ${stats.data.rooms} rooms`} />
          <Stat label="Arrivals today" value={String(stats.data.arrivals_today)} />
          <Stat label="Upcoming bookings" value={String(stats.data.upcoming_bookings)} note={`across ${stats.data.hotels} hotels`} />
          <Stat label="Revenue, next 30 days" value={money(stats.data.revenue_next_30_days)} note="confirmed bookings" />
        </div>
      ) : null}

      <Card className="mt-8">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">Next arrivals</h2>
          <Link to="/bookings" className="text-sm font-medium text-brand hover:underline">
            All bookings
          </Link>
        </div>
        {bookings.isPending ? (
          <div className="px-5">
            <Spinner />
          </div>
        ) : arrivals.length === 0 ? (
          <p className="px-5 py-8 text-sm text-mute">No upcoming arrivals.</p>
        ) : (
          <ul className="divide-y divide-line">
            {arrivals.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{b.guest_name}</p>
                  <p className="text-mute">
                    {b.hotel_name} · {b.room_type_name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {b.check_in === today && <Badge tone="blue">Today</Badge>}
                  <span className="text-mute">
                    {formatDate(b.check_in)} · {b.nights} night{b.nights === 1 ? "" : "s"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
