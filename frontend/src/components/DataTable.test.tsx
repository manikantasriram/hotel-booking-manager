import { createColumnHelper } from "@tanstack/react-table";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "./DataTable";
import type { Features } from "./tableFeatures";

type Guest = { name: string; nights: number };
const col = createColumnHelper<Features, Guest>();
const columns = col.columns([col.accessor("name", { header: "Name" }), col.accessor("nights", { header: "Nights" })]);
const data: Guest[] = [
  { name: "Priya", nights: 3 },
  { name: "Arjun", nights: 1 },
  { name: "Meera", nights: 5 },
];

const firstColumn = () =>
  screen
    .getAllByRole("row")
    .slice(1) // skip the header row
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("DataTable", () => {
  it("filters rows as you type", async () => {
    render(<DataTable data={data} columns={columns} />);
    await userEvent.type(screen.getByRole("searchbox", { name: /search the table/i }), "mee");
    expect(firstColumn()).toEqual(["Meera"]);
    expect(screen.getByText("1 row")).toBeInTheDocument();
  });

  it("explains when nothing matches", async () => {
    render(<DataTable data={data} columns={columns} />);
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText('No rows match "zzz".')).toBeInTheDocument();
  });

  it("sorts when a header is clicked", async () => {
    render(<DataTable data={data} columns={columns} />);
    const nameHeader = screen.getByRole("button", { name: /name/i });
    await userEvent.click(nameHeader);
    expect(firstColumn()).toEqual(["Arjun", "Meera", "Priya"]);
    expect(screen.getByRole("columnheader", { name: /name/i })).toHaveAttribute("aria-sort", "ascending");
  });
});
