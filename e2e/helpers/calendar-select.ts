import { expect, type Page } from "@playwright/test";
import { DateTime } from "luxon";

const ZONE = "Europe/Kyiv";

/**
 * FullCalendar timeGrid select via pointer drag.
 *
 * Sticky site chrome can sit over early morning lanes after scrollIntoView.
 * Mouse events that hit the header never reach FullCalendar, so
 * `.fc-event-available` stays at 0 (#216).
 */
export async function selectEmptyCalendarHour(
  page: Page,
  slotStartIso: string,
) {
  const local = DateTime.fromISO(slotStartIso, { zone: "utc" }).setZone(ZONE);
  const dateStr = local.toFormat("yyyy-MM-dd");
  const timeStr = local.toFormat("HH:mm:ss");

  const lane = page.locator(`.fc-timegrid-slot-lane[data-time="${timeStr}"]`);
  const col = page.locator(`.fc-timegrid-col[data-date="${dateStr}"]`);
  await expect(lane).toBeVisible({ timeout: 20_000 });
  await expect(col).toBeVisible({ timeout: 20_000 });

  await lane.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
  });

  async function boxes() {
    const laneBox = await lane.boundingBox();
    const colBox = await col.boundingBox();
    if (!laneBox || !colBox) {
      throw new Error(`Missing calendar boxes for ${dateStr} ${timeStr}`);
    }
    return { laneBox, colBox };
  }

  let { laneBox, colBox } = await boxes();

  const headerBox = await page.locator("header").first().boundingBox();
  const headerBottom = headerBox ? headerBox.y + headerBox.height : 0;
  if (laneBox.y < headerBottom + 8) {
    await page.evaluate(
      (dy) => window.scrollBy(0, dy),
      headerBottom + 8 - laneBox.y + Math.max(laneBox.height, 24),
    );
    ({ laneBox, colBox } = await boxes());
  }

  const x = colBox.x + colBox.width / 2;
  const yStart = laneBox.y + Math.min(4, Math.max(laneBox.height / 4, 2));
  const yEnd =
    laneBox.y + Math.max(laneBox.height - 4, Math.min(laneBox.height * 0.75, 20));

  const topHit = await page.evaluate(
    ({ clientX, clientY }) => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return "none";
      if (el.closest("header")) return "header";
      if (el.closest(".fc")) return "calendar";
      return el.tagName.toLowerCase();
    },
    { clientX: x, clientY: yStart },
  );
  expect(
    topHit,
    `calendar drag start at ${dateStr} ${timeStr} hit "${topHit}" (need calendar, not sticky header)`,
  ).toBe("calendar");

  // FullCalendar `select` needs a drag, not a bare click.
  await page.mouse.move(x, yStart);
  await page.mouse.down();
  await page.mouse.move(x, yEnd, { steps: 8 });
  await page.mouse.up();
}
