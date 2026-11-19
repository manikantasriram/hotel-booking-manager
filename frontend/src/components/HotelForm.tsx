import { useState, type FormEvent } from "react";
import { z } from "zod";
import type { HotelInput } from "../lib/types";
import { Button, ErrorNote, Field, Input, Select, Textarea } from "./ui";

// Zod describes what valid input looks like. The same rules exist on the server; checking here
// too means the user sees mistakes instantly instead of after a round trip.
const hotelSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  city: z.string().trim().min(1, "Enter a city").max(80),
  address: z.string().trim().min(1, "Enter an address").max(255),
  stars: z.coerce.number().int().min(1).max(5),
  description: z.string().trim().max(2000),
});

type Errors = Partial<Record<keyof HotelInput, string>>;

export function HotelForm({
  initial,
  submitLabel,
  onSubmit,
  error,
  busy,
}: {
  initial?: HotelInput;
  submitLabel: string;
  onSubmit: (values: HotelInput) => void;
  error: unknown;
  busy: boolean;
}) {
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    city: initial?.city ?? "",
    address: initial?.address ?? "",
    stars: String(initial?.stars ?? 4),
    description: initial?.description ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = (field: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // the user is fixing it
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = hotelSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof HotelInput] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Hotel name" error={errors.name}>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} value={values.name} onChange={set("name")} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="City" error={errors.city}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.city} value={values.city} onChange={set("city")} />}
        </Field>
        <Field label="Stars" error={errors.stars}>
          {(id) => (
            <Select id={id} value={values.stars} onChange={set("stars")}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Address" error={errors.address}>
        {(id, d) => (
          <Input id={id} aria-describedby={d} aria-invalid={!!errors.address} value={values.address} onChange={set("address")} />
        )}
      </Field>
      <Field label="Description" optional error={errors.description}>
        {(id, d) => (
          <Textarea id={id} aria-describedby={d} rows={3} maxLength={2000} value={values.description} onChange={set("description")} />
        )}
      </Field>
      <ErrorNote error={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
