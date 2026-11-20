import { afterAll, describe, expect, it } from "vitest";
import {
  CALENDAR_SLOT_DURATION,
  CALENDAR_SLOT_MAX_TIME,
  CALENDAR_SLOT_MIN_TIME,
  CLIENT_BOOKING_WINDOW_DAYS,
  DEFAULT_MASSEUR_TIME_ZONE,
  WEEKLY_COPY_MAX_WEEKS,
} from "@/lib/booking-constants";
import {
  addLocalWeeks,
  alignToHour,
  clientBookingWindowExclusiveEnd,
  currentLocalWeekRange,
  formatInMasseurTimeZone,
  isCurrentLocalWeekRange,
  isOutsideClientLeadTime,
  isValidTimeZone,
  isWithinClientBookingWindow,
  isWithinWorkingHours,
  resolveTimeZone,
  startOfLocalDay,
  timeZoneLabel,
} from "@/lib/masseur-time";

const KYIV = "Europe/Kyiv";
const utc = (iso: string) => new Date(`${iso}Z`);
const originalTz = process.env.TZ;

afterAll(() => {
  process.env.TZ = originalTz;
});

// The results must not depend on the server's own time zone.
describe.each(["UTC", "America/Los_Angeles", "Pacific/Auckland"])(
  "masseur time helpers with server TZ=%s",
  (serverTz) => {
    it("runs with the server time zone set", () => {
      process.env.TZ = serverTz;
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(serverTz);
    });

    it("aligns to the local hour of the masseur", () => {
      process.env.TZ = serverTz;
      expect(alignToHour(utc("2027-01-10T08:45:12.345"), KYIV)).toEqual(
        utc("2027-01-10T08:00:00.000"),
      );
      // A half-hour offset zone aligns to :30 in UTC.
      expect(alignToHour(utc("2027-01-10T05:10:00"), "Asia/Kolkata")).toEqual(
        utc("2027-01-10T04:30:00"),
      );
    });

    it("applies the 05:00-23:00 window in the masseur's zone (winter, UTC+2)", () => {
      process.env.TZ = serverTz;
      expect(isWithinWorkingHours(utc("2027-01-10T02:00:00"), KYIV)).toBe(false); // 04:00
      expect(isWithinWorkingHours(utc("2027-01-10T03:00:00"), KYIV)).toBe(true); // 05:00
      expect(isWithinWorkingHours(utc("2027-01-10T20:00:00"), KYIV)).toBe(true); // 22:00
      expect(isWithinWorkingHours(utc("2027-01-10T21:00:00"), KYIV)).toBe(false); // 23:00
    });

    it("applies the window in the masseur's zone (summer, UTC+3)", () => {
      process.env.TZ = serverTz;
      expect(isWithinWorkingHours(utc("2027-07-10T01:00:00"), KYIV)).toBe(false); // 04:00
      expect(isWithinWorkingHours(utc("2027-07-10T02:00:00"), KYIV)).toBe(true); // 05:00
      expect(isWithinWorkingHours(utc("2027-07-10T19:00:00"), KYIV)).toBe(true); // 22:00
      expect(isWithinWorkingHours(utc("2027-07-10T20:00:00"), KYIV)).toBe(false); // 23:00
    });

    it("keeps the local clock time across the spring DST change", () => {
      process.env.TZ = serverTz;
      // Kyiv switches to UTC+3 on 2027-03-28.
      const monday10 = utc("2027-03-22T08:00:00"); // 10:00 UTC+2
      expect(addLocalWeeks(monday10, 1, KYIV)).toEqual(utc("2027-03-29T07:00:00"));
      expect(addLocalWeeks(monday10, 2, KYIV)).toEqual(utc("2027-04-05T07:00:00"));
    });

    it("keeps the local clock time across the autumn DST change", () => {
      process.env.TZ = serverTz;
      // Kyiv switches back to UTC+2 on 2027-10-31.
      const monday10 = utc("2027-10-25T07:00:00"); // 10:00 UTC+3
      expect(addLocalWeeks(monday10, 1, KYIV)).toEqual(utc("2027-11-01T08:00:00"));
    });

    it("finds the start of the masseur's local day", () => {
      process.env.TZ = serverTz;
      expect(startOfLocalDay(utc("2027-03-28T12:00:00"), KYIV)).toEqual(
        utc("2027-03-27T22:00:00"),
      );
      // 23:30 UTC is already the next day in Kyiv.
      expect(startOfLocalDay(utc("2027-01-10T23:30:00"), KYIV)).toEqual(
        utc("2027-01-10T22:00:00"),
      );
    });

    it("labels the zone with the offset of the shown instant", () => {
      process.env.TZ = serverTz;
      expect(timeZoneLabel(KYIV, utc("2027-01-10T08:00:00"))).toBe("Kyiv, UTC+2");
      expect(timeZoneLabel(KYIV, utc("2027-07-10T08:00:00"))).toBe("Kyiv, UTC+3");
      expect(timeZoneLabel("America/New_York", utc("2027-01-10T08:00:00"))).toBe(
        "New York, UTC-5",
      );
      expect(timeZoneLabel("Asia/Kolkata", utc("2027-01-10T08:00:00"))).toBe(
        "Kolkata, UTC+5:30",
      );
    });

    it("formats a time in the masseur's zone with the label", () => {
      process.env.TZ = serverTz;
      const text = formatInMasseurTimeZone(utc("2027-07-10T07:00:00"), KYIV, "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      expect(text).toBe("10:00 (Kyiv, UTC+3)");
    });
  },
);

describe("time zone validation", () => {
  it("accepts IANA names and rejects anything else", () => {
    expect(isValidTimeZone("Europe/Kyiv")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it("falls back to the default zone", () => {
    expect(resolveTimeZone(null)).toBe(DEFAULT_MASSEUR_TIME_ZONE);
    expect(resolveTimeZone("not/a-zone")).toBe(DEFAULT_MASSEUR_TIME_ZONE);
    expect(resolveTimeZone("Europe/Warsaw")).toBe("Europe/Warsaw");
  });
});

describe("calendar constants", () => {
  it("derives the FullCalendar grid from the shared values", () => {
    expect(CALENDAR_SLOT_MIN_TIME).toBe("05:00:00");
    expect(CALENDAR_SLOT_MAX_TIME).toBe("23:00:00");
    expect(CALENDAR_SLOT_DURATION).toBe("01:00:00");
  });

  it("caps weekly copy near the 120-day client window", () => {
    expect(CLIENT_BOOKING_WINDOW_DAYS).toBe(120);
    expect(WEEKLY_COPY_MAX_WEEKS).toBe(17);
  });
});

describe("client lead time and booking window", () => {
  it("hides a slot at exactly start − lead (strict boundary)", () => {
    const slot = utc("2031-07-15T07:00:00"); // 10:00 Kyiv summer
    const leadHours = 1;
    expect(
      isOutsideClientLeadTime(slot, leadHours, utc("2031-07-15T05:59:59.999")),
    ).toBe(true);
    expect(
      isOutsideClientLeadTime(slot, leadHours, utc("2031-07-15T06:00:00.000")),
    ).toBe(false);
  });

  it("ends the client window at the end of today + 120 days in the masseur zone", () => {
    process.env.TZ = "UTC";
    const now = utc("2031-01-10T12:00:00");
    const end = clientBookingWindowExclusiveEnd(now, KYIV);
    // 2031-01-10 + 120 days = 2031-05-10; exclusive end is 2031-05-11 00:00 Kyiv = 2031-05-10 21:00 UTC (EEST? May is UTC+3)
    expect(end).toEqual(utc("2031-05-10T21:00:00"));

    const lastDaySlot = utc("2031-05-10T20:00:00"); // 23:00 Kyiv on May 10
    const nextDaySlot = utc("2031-05-10T21:00:00"); // 00:00 Kyiv on May 11
    expect(isWithinClientBookingWindow(lastDaySlot, KYIV, now)).toBe(true);
    expect(isWithinClientBookingWindow(nextDaySlot, KYIV, now)).toBe(false);
  });

  it("computes the Monday-based current local week (#129)", () => {
    process.env.TZ = "UTC";
    // 2031-07-14 is Monday; 12:00 Kyiv summer.
    const now = utc("2031-07-14T09:00:00");
    const week = currentLocalWeekRange(now, KYIV);
    expect(week.from).toEqual(utc("2031-07-13T21:00:00"));
    expect(week.to).toEqual(utc("2031-07-20T21:00:00"));
    expect(isCurrentLocalWeekRange(week.from, week.to, KYIV, now)).toBe(true);
    expect(
      isCurrentLocalWeekRange(
        week.from,
        utc("2031-07-27T21:00:00"),
        KYIV,
        now,
      ),
    ).toBe(false);
  });
});
