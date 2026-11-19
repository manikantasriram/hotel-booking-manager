import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { z } from "zod";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner } from "../components/ui";
import { addDays, isoDate, money, nightsBetween } from "../lib/format";
import { useAvailability, useCreateBooking, useHotel, useHotels } from "../lib/queries";

const MAX_NIGHTS = 60; // same limit as the API (backend/app/services.py)

const bookingSchema = z
  .object({
    room_type_id: z.number({ error: "Choose a room type" }).int().positive("Choose a room type"),
    rate_plan_id: z.number({ error: "Choose a rate" }).int().positive("Choose a rate"),
    guest_name: z.string().trim().min(1, "Enter the guest's name").max(120),
    guest_email: z.email("Enter a valid email"),
    check_in: z.iso.date("Choose a check-in date"),
    check_out: z.iso.date("Choose a check-out date"),
    guests: z.number().int().min(1).max(12),
  })
  .refine((v) => v.check_in >= isoDate(), { path: ["check_in"], message: "Check-in can't be in the past" })
  .refine((v) => v.check_out > v.check_in, { path: ["check_out"], message: "Check-out must be after check-in" })
  .refine((v) => nightsBetween(v.check_in, v.check_out) <= MAX_NIGHTS, {
    path: ["check_out"],
    message: `A booking can be at most ${MAX_NIGHTS} nights`,
  });

type FieldErrors = Partial<Record<string, string>>;

export function NewBookingPage() {
  const navigate = useNavigate();
  const hotels = useHotels();
  const [hotelId, setHotelId] = useState<number>();
  const hotel = useHotel(hotelId ?? 0);
  const create = useCreateBooking();

  const [form, setForm] = useState({
    room_type_id: 0,
    rate_plan_id: 0,
    guest_name: "",
    guest_email: "",
    check_in: isoDate(1),
    check_out: isoDate(3),
    guests: 2,
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  /** Update some fields and clear their error messages, so a fixed mistake stops showing. */
  const change = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const roomTypes = hotelId ? (hotel.data?.room_types ?? []) : [];
  const roomType = roomTypes.find((rt) => rt.id === form.room_type_id);
  const ratePlan = roomType?.rate_plans.find((rp) => rp.id === form.rate_plan_id);
  const nights = nightsBetween(form.check_in, form.check_out);
  const total = ratePlan && nights > 0 ? ratePlan.price_per_night * nights : null;
  const availability = useAvailability(roomType?.id, form.check_in, form.check_out);
  const soldOut = availability.data ? availability.data.available === 0 : false;

  // The day after check-in. (Worked out in local time: toISOString() would shift it a day east of UTC.)
  const minCheckOut = form.check_in ? addDays(form.check_in, 1) : undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = bookingSchema.safeParse(form);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    if (roomType && form.guests > roomType.capacity) {
      setErrors({ guests: `${roomType.name} fits at most ${roomType.capacity} guests` });
      return;
    }
    setErrors({});
    create.mutate(parsed.data, { onSuccess: () => navigate("/bookings") });
  }

  return (
    <>
      <PageHeader title="New booking" subtitle="Pick a room, check it's free for those dates, and book it." />
      {hotels.isPending ? (
        <Spinner label="Loading hotels" />
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Card className="space-y-5 p-6">
            <Field label="Hotel">
              {(id) => (
                <Select
                  id={id}
                  value={hotelId ?? ""}
                  onChange={(e) => {
                    setHotelId(e.target.value ? Number(e.target.value) : undefined);
                    change({ room_type_id: 0, rate_plan_id: 0 });
                  }}
                >
                  <option value="">Choose a hotel</option>
                  {hotels.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}, {h.city}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Room type" error={errors.room_type_id}>
                {(id, d) => (
                  <Select
                    id={id}
                    aria-describedby={d}
                    disabled={!hotelId || hotel.isPending}
                    value={form.room_type_id || ""}
                    onChange={(e) => change({ room_type_id: Number(e.target.value), rate_plan_id: 0 })}
                  >
                    <option value="">{hotelId ? "Choose a room type" : "Choose a hotel first"}</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} (up to {rt.capacity})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Rate" error={errors.rate_plan_id}>
                {(id, d) => (
                  <Select
                    id={id}
                    aria-describedby={d}
                    disabled={!roomType}
                    value={form.rate_plan_id || ""}
                    onChange={(e) => change({ rate_plan_id: Number(e.target.value) })}
                  >
                    <option value="">{roomType ? "Choose a rate" : "Choose a room type first"}</option>
                    {roomType?.rate_plans.map((rp) => (
                      <option key={rp.id} value={rp.id}>
                        {rp.name}: {money(rp.price_per_night)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Check-in" error={errors.check_in}>
                {(id, d) => (
                  <Input id={id} aria-describedby={d} type="date" min={isoDate()} value={form.check_in}
                    onChange={(e) => change({ check_in: e.target.value })} />
                )}
              </Field>
              <Field label="Check-out" error={errors.check_out}>
                {(id, d) => (
                  <Input id={id} aria-describedby={d} type="date" min={minCheckOut} value={form.check_out}
                    onChange={(e) => change({ check_out: e.target.value })} />
                )}
              </Field>
              <Field label="Guests" error={errors.guests}>
                {(id, d) => (
                  <Input id={id} aria-describedby={d} type="number" min={1} max={roomType?.capacity ?? 12} value={form.guests}
                    onChange={(e) => change({ guests: Number(e.target.value) })} />
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Guest name" error={errors.guest_name}>
                {(id, d) => (
                  <Input id={id} aria-describedby={d} autoComplete="off" value={form.guest_name}
                    onChange={(e) => change({ guest_name: e.target.value })} />
                )}
              </Field>
              <Field label="Guest email" error={errors.guest_email}>
                {(id, d) => (
                  <Input id={id} aria-describedby={d} type="email" autoComplete="off" value={form.guest_email}
                    onChange={(e) => change({ guest_email: e.target.value })} />
                )}
              </Field>
            </div>
          </Card>

          <Card className="h-fit space-y-4 p-6 lg:sticky lg:top-10">
            <h2 className="font-semibold">Summary</h2>
            <dl className="tabular space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-mute">Nights</dt>
                <dd>{nights > 0 ? nights : "–"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Rate</dt>
                <dd>{ratePlan ? money(ratePlan.price_per_night) : "–"}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{total !== null ? money(total) : "–"}</dd>
              </div>
            </dl>
            <p className="text-sm" aria-live="polite">
              {!roomType || nights <= 0 ? (
                <span className="text-mute">Choose a room and dates to check availability.</span>
              ) : availability.isFetching ? (
                <span className="text-mute">Checking availability…</span>
              ) : availability.error ? (
                <span className="font-medium text-bad">{availability.error.message}</span>
              ) : availability.data ? (
                soldOut ? (
                  <span className="font-medium text-bad">Sold out for these dates.</span>
                ) : (
                  <span className="font-medium text-ok">
                    {availability.data.available} of {availability.data.total_rooms} rooms free
                  </span>
                )
              ) : null}
            </p>
            <ErrorNote error={create.error} />
            <Button type="submit" className="w-full" disabled={create.isPending || soldOut}>
              {create.isPending ? "Booking…" : "Confirm booking"}
            </Button>
          </Card>
        </form>
      )}
    </>
  );
}
