import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/useAuth";
import { DataTable } from "../components/DataTable";
import type { Features } from "../components/tableFeatures";
import { HotelForm } from "../components/HotelForm";
import { Button, ErrorNote, Modal, PageHeader, Spinner, Stars } from "../components/ui";
import { useCreateHotel, useHotels } from "../lib/queries";
import type { Hotel } from "../lib/types";

const col = createColumnHelper<Features, Hotel>();

const columns = col.columns([
  col.accessor("name", {
    header: "Hotel",
    cell: (info) => (
      <Link to={`/hotels/${info.row.original.id}`} className="font-medium text-ink hover:text-brand">
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor("city", { header: "City" }),
  col.accessor("stars", { header: "Rating", cell: (info) => <Stars count={info.getValue()} /> }),
  col.accessor("room_type_count", { header: "Room types" }),
  col.accessor("total_rooms", { header: "Rooms" }),
  col.display({
    id: "open",
    header: "",
    cell: (info) => (
      <Link to={`/hotels/${info.row.original.id}`} className="text-sm font-medium text-brand hover:underline">
        Manage
      </Link>
    ),
  }),
]);

export function HotelsPage() {
  const { isAdmin } = useAuth();
  const hotels = useHotels();
  const create = useCreateHotel();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Hotels"
        subtitle="Every property, its room types and how many rooms it has."
        actions={isAdmin && <Button onClick={() => setAdding(true)}>Add hotel</Button>}
      />
      <ErrorNote error={hotels.error} />
      {hotels.isPending ? (
        <Spinner label="Loading hotels" />
      ) : (
        <DataTable
          data={hotels.data ?? []}
          columns={columns}
          searchPlaceholder="Search hotels or cities…"
          initialSorting={[{ id: "name", desc: false }]}
          emptyMessage="No hotels yet."
        />
      )}

      <Modal open={adding} title="Add a hotel" onClose={() => setAdding(false)}>
        <HotelForm
          submitLabel="Add hotel"
          busy={create.isPending}
          error={create.error}
          onSubmit={(values) => create.mutate(values, { onSuccess: () => setAdding(false) })}
        />
      </Modal>
    </>
  );
}
