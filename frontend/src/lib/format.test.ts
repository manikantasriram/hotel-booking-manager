import { formatDate, money, nightsBetween, percent } from "./format";

describe("format helpers", () => {
  it("formats rupees the Indian way", () => {
    expect(money(4890115)).toBe("₹48,90,115");
  });

  it("formats an ISO date without shifting the day", () => {
    expect(formatDate("2026-11-15")).toBe("15 Nov 2026");
  });

  it("counts nights between two dates", () => {
    expect(nightsBetween("2026-11-15", "2026-11-18")).toBe(3);
    expect(nightsBetween("2026-11-15", "2026-11-15")).toBe(0);
    expect(nightsBetween("", "2026-11-15")).toBe(0);
  });

  it("shows a fraction as a whole percent", () => {
    expect(percent(0.1428)).toBe("14%");
  });
});
