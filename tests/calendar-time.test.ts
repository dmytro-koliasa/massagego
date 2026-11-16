import { describe, expect, it } from "vitest";
import {
  alignToHourIso,
  formatCalendarTimeZoneLine,
  formatHourRange,
  formatWeekTitle,
  getWeekSlotStarts,
} from "@/lib/calendar-time";

const KYIV = "Europe/Kyiv";
const utc = (iso: string) => new Date(`${iso}Z`);

describe("calendar-time helpers", () => {
  it("aligns to the hour in the masseur's zone", () => {
    expect(alignToHourIso(utc("2027-01-10T08:45:00"), KYIV)).toBe(
      "2027-01-10T08:00:00.000Z",
    );
  });

  it("builds week slot starts in the masseur's zone across DST", () => {
    // Monday 2027-03-29 00:00 Kyiv (UTC+3 after the spring change) to Tuesday.
    const starts = getWeekSlotStarts(
      "2027-03-28T21:00:00.000Z",
      "2027-03-29T21:00:00.000Z",
      KYIV,
    );
    expect(starts[0]).toBe("2027-03-29T02:00:00.000Z"); // 05:00 Kyiv
    expect(starts.at(-1)).toBe("2027-03-29T19:00:00.000Z"); // 22:00 Kyiv
    expect(starts).toHaveLength(18);
  });

  it("formats the week title with dates from the masseur's zone", () => {
    // A UTC range that is Mon–Sun in Kyiv in winter.
    const title = formatWeekTitle(
      "2027-01-10T22:00:00.000Z",
      "2027-01-17T22:00:00.000Z",
      "en",
      KYIV,
    );
    expect(title).toBe("11 – 17 January 2027");
  });

  it("formats hours in the masseur's zone", () => {
    const hours = formatHourRange(
      utc("2027-07-10T07:00:00"),
      utc("2027-07-10T08:00:00"),
      "en",
      KYIV,
    );
    expect(hours).toEqual({ start: "10:00", end: "11:00" });
  });

  it("fills the calendar time-zone line", () => {
    expect(
      formatCalendarTimeZoneLine("Times in {label}", KYIV, utc("2027-01-10T08:00:00")),
    ).toBe("Times in Kyiv, UTC+2");
    expect(
      formatCalendarTimeZoneLine("Час: {label}", KYIV, utc("2027-07-10T08:00:00")),
    ).toBe("Час: Kyiv, UTC+3");
  });
});
