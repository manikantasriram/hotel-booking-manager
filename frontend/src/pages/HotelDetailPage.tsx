import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../auth/useAuth";
import { HotelForm } from "../components/HotelForm";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorNote,
  Field,
  Icon,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Stars,
} from "../components/ui";
import { money } from "../lib/format";
import {
  useCreateRatePlan,
  useCreateRoomType,
  useDeleteHotel,
  useDeleteRatePlan,
  useDeleteRoomType,
  useHotel,
  useUpdateHotel,
  useUpdateRatePlan,
  useUpdateRoomType,
} from "../lib/queries";
import type { RatePlan, RatePlanInput, RoomType, RoomTypeInput } from "../lib/types";

// What the modal is currently editing (null = closed)
type Editing =
  | { kind: "hotel" }
  | { kind: "roomType"; roomType?: RoomType }
  | { kind: "ratePlan"; roomTypeId: number; ratePlan?: RatePlan }
  | null;

export function HotelDetailPage() {
  const hotelId = Number(useParams().hotelId);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const hotel = useHotel(hotelId);
  const [editing, setEditing] = useState<Editing>(null);

  const updateHotel = useUpdateHotel();
  const deleteHotel = useDeleteHotel();
  const deleteRoomType = useDeleteRoomType();
  const deleteRatePlan = useDeleteRatePlan();
  const deleteError = deleteHotel.error ?? deleteRoomType.error ?? deleteRatePlan.error;

  if (hotel.isPending) return <Spinner label="Loading hotel" />;
  if (hotel.error) return <ErrorNote error={hotel.error} />;
  const h = hotel.data;
  const close = () => setEditing(null);

  return (
    <>
      <Link to="/hotels" className="-ml-1 inline-flex h-8 items-center gap-1 rounded-lg px-1 text-sm font-medium text-mute hover:text-ink">
        <Icon name="back" />
        All hotels
      </Link>
      <div className="mt-3">
        <PageHeader
          title={h.name}
          subtitle={`${h.address}, ${h.city}`}
          actions={
            isAdmin && (
              <>
                <Button variant="secondary" onClick={() => setEditing({ kind: "hotel" })}>
                  Edit hotel
                </Button>
                <Button
                  variant="danger"
                  disabled={deleteHotel.isPending}
                  onClick={() => {
                    if (confirm(`Delete ${h.name}? This can't be undone.`)) {
                      deleteHotel.mutate(h.id, { onSuccess: () => navigate("/hotels") });
                    }
                  }}
                >
                  Delete
                </Button>
              </>
            )
          }
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-mute">
        <Stars count={h.stars} />
        <span className="tabular">
          {h.room_type_count} room {h.room_type_count === 1 ? "type" : "types"} · {h.total_rooms} rooms
        </span>
      </div>
      {h.description && <p className="mb-6 max-w-2xl text-sm text-mute">{h.description}</p>}
      <ErrorNote error={deleteError} />

      <div className="mt-2 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Room types & rates</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => setEditing({ kind: "roomType" })}>
            Add room type
          </Button>
        )}
      </div>

      {h.room_types.length === 0 && (
        <Card>
          <EmptyState title="No room types yet">
            {isAdmin ? "Add a room type, then give it one or more rates." : "An admin can add room types and rates."}
          </EmptyState>
        </Card>
      )}
      <div className="space-y-4">
        {h.room_types.map((rt) => (
          <Card key={rt.id}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h3 className="font-semibold">{rt.name}</h3>
                <p className="text-sm text-mute">
                  Up to {rt.capacity} guests · {rt.total_rooms} rooms
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Add rate to ${rt.name}`}
                    onClick={() => setEditing({ kind: "ratePlan", roomTypeId: rt.id })}
                  >
                    Add rate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${rt.name}`}
                    onClick={() => setEditing({ kind: "roomType", roomType: rt })}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${rt.name}`}
                    onClick={() => confirm(`Delete ${rt.name}?`) && deleteRoomType.mutate(rt.id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
            <ul className="divide-y divide-line">
              {rt.rate_plans.map((rp) => (
                <li key={rp.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{rp.name}</span>
                    {rp.breakfast_included && <Badge tone="green">Breakfast</Badge>}
                    <Badge tone={rp.refundable ? "slate" : "amber"}>{rp.refundable ? "Refundable" : "Non-refundable"}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular font-semibold">
                      {money(rp.price_per_night)} <span className="font-normal text-mute">/ night</span>
                    </span>
                    {isAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${rp.name} for ${rt.name}`}
                          onClick={() => setEditing({ kind: "ratePlan", roomTypeId: rt.id, ratePlan: rp })}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${rp.name} for ${rt.name}`}
                          onClick={() => confirm(`Delete ${rp.name}?`) && deleteRatePlan.mutate(rp.id)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
              {rt.rate_plans.length === 0 && <li className="px-5 py-3 text-sm text-mute">No rates yet.</li>}
            </ul>
          </Card>
        ))}
      </div>

      <Modal open={editing?.kind === "hotel"} title="Edit hotel" onClose={close}>
        <HotelForm
          initial={h}
          submitLabel="Save changes"
          busy={updateHotel.isPending}
          error={updateHotel.error}
          onSubmit={(values) => updateHotel.mutate({ id: h.id, ...values }, { onSuccess: close })}
        />
      </Modal>
      <Modal
        open={editing?.kind === "roomType"}
        title={editing?.kind === "roomType" && editing.roomType ? "Edit room type" : "Add room type"}
        onClose={close}
      >
        {editing?.kind === "roomType" && <RoomTypeForm hotelId={h.id} roomType={editing.roomType} onDone={close} />}
      </Modal>
      <Modal
        open={editing?.kind === "ratePlan"}
        title={editing?.kind === "ratePlan" && editing.ratePlan ? "Edit rate" : "Add rate"}
        onClose={close}
      >
        {editing?.kind === "ratePlan" && (
          <RatePlanForm roomTypeId={editing.roomTypeId} ratePlan={editing.ratePlan} onDone={close} />
        )}
      </Modal>
    </>
  );
}

function RoomTypeForm({ hotelId, roomType, onDone }: { hotelId: number; roomType?: RoomType; onDone: () => void }) {
  const create = useCreateRoomType();
  const update = useUpdateRoomType();
  const mutation = roomType ? update : create;
  const [values, setValues] = useState<RoomTypeInput>({
    name: roomType?.name ?? "",
    capacity: roomType?.capacity ?? 2,
    total_rooms: roomType?.total_rooms ?? 10,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (roomType) update.mutate({ id: roomType.id, ...values }, { onSuccess: onDone });
    else create.mutate({ hotel_id: hotelId, ...values }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name">
        {(id) => <Input id={id} required maxLength={80} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Guests per room">
          {(id) => (
            <Input id={id} type="number" min={1} max={12} required value={values.capacity}
              onChange={(e) => setValues({ ...values, capacity: Number(e.target.value) })} />
          )}
        </Field>
        <Field label="Number of rooms">
          {(id) => (
            <Input id={id} type="number" min={1} max={1000} required value={values.total_rooms}
              onChange={(e) => setValues({ ...values, total_rooms: Number(e.target.value) })} />
          )}
        </Field>
      </div>
      <ErrorNote error={mutation.error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : roomType ? "Save changes" : "Add room type"}
        </Button>
      </div>
    </form>
  );
}

function RatePlanForm({ roomTypeId, ratePlan, onDone }: { roomTypeId: number; ratePlan?: RatePlan; onDone: () => void }) {
  const create = useCreateRatePlan();
  const update = useUpdateRatePlan();
  const mutation = ratePlan ? update : create;
  const [values, setValues] = useState<RatePlanInput>({
    name: ratePlan?.name ?? "",
    price_per_night: ratePlan?.price_per_night ?? 5000,
    breakfast_included: ratePlan?.breakfast_included ?? false,
    refundable: ratePlan?.refundable ?? true,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (ratePlan) update.mutate({ id: ratePlan.id, ...values }, { onSuccess: onDone });
    else create.mutate({ room_type_id: roomTypeId, ...values }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" hint='For example "Flexible, breakfast included"'>
        {(id, d) => (
          <Input id={id} aria-describedby={d} required maxLength={80} value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })} />
        )}
      </Field>
      <Field label="Price per night (₹)">
        {(id) => (
          <Input id={id} type="number" min={1} step="0.01" required value={values.price_per_night}
            onChange={(e) => setValues({ ...values, price_per_night: Number(e.target.value) })} />
        )}
      </Field>
      <fieldset className="flex flex-wrap gap-6">
        <legend className="sr-only">Rate options</legend>
        <Checkbox
          label="Breakfast included"
          checked={values.breakfast_included}
          onChange={(e) => setValues({ ...values, breakfast_included: e.target.checked })}
        />
        <Checkbox
          label="Refundable"
          checked={values.refundable}
          onChange={(e) => setValues({ ...values, refundable: e.target.checked })}
        />
      </fieldset>
      <ErrorNote error={mutation.error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : ratePlan ? "Save changes" : "Add rate"}
        </Button>
      </div>
    </form>
  );
}
