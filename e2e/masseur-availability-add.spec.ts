import { expect, type Page, test } from "@playwright/test";
import { DateTime } from "luxon";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

const ZONE = "Europe/Kyiv";

async function selectEmptyCalendarHour(page: Page, slotStartIso: string) {
  const local = DateTime.fromISO(slotStartIso, { zone: "utc" }).setZone(ZONE);
  const dateStr = local.toFormat("yyyy-MM-dd");
  const timeStr = local.toFormat("HH:mm:ss");

  const lane = page.locator(`.fc-timegrid-slot-lane[data-time="${timeStr}"]`);
  const col = page.locator(`.fc-timegrid-col[data-date="${dateStr}"]`);
  await expect(lane).toBeVisible({ timeout: 20_000 });
  await expect(col).toBeVisible({ timeout: 20_000 });
  await lane.scrollIntoViewIfNeeded();

  const laneBox = await lane.boundingBox();
  const colBox = await col.boundingBox();
  if (!laneBox || !colBox) {
    throw new Error(`Missing calendar boxes for ${dateStr} ${timeStr}`);
  }

  const x = colBox.x + colBox.width / 2;
  const yStart = laneBox.y + 2;
  const yEnd = laneBox.y + Math.max(laneBox.height - 2, 12);

  // FullCalendar `select` needs a drag, not a bare click.
  await page.mouse.move(x, yStart);
  await page.mouse.down();
  await page.mouse.move(x, yEnd, { steps: 6 });
  await page.mouse.up();
}

test("masseur can add an availability hour and keep it after save", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("availabilityAdd");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);
  await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });

  await page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/availability?") &&
      res.request().method() === "GET" &&
      res.status() < 500,
  );

  await page
    .getByRole("heading", {
      name: /Weekly availability|Тижнева доступність/i,
    })
    .scrollIntoViewIfNeeded();

  if (fixture.needsNextWeek) {
    await page
      .getByRole("button", { name: /Next week|Наступний тиждень/i })
      .click();
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/masseur/availability?") &&
        res.request().method() === "GET" &&
        res.status() < 500,
    );
  }

  await expect(page.locator(".fc-event-available")).toHaveCount(0, {
    timeout: 20_000,
  });

  await selectEmptyCalendarHour(page, fixture.slotStartIso);

  await expect(page.locator(".fc-event-available")).toHaveCount(1, {
    timeout: 10_000,
  });

  const availabilityPost = page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/availability") &&
      res.request().method() === "POST",
  );

  await page
    .getByRole("button", { name: /Save profile|Зберегти профіль/ })
    .click();

  const post = await availabilityPost;
  expect(
    post.ok(),
    `availability POST ${post.status()}: ${await post.text()}`,
  ).toBeTruthy();

  await expect(
    page.getByText(/Profile saved\.|Профіль збережено\./),
  ).toBeVisible({ timeout: 15_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/availability?") &&
      res.request().method() === "GET" &&
      res.status() < 500,
  );
  if (fixture.needsNextWeek) {
    await page
      .getByRole("button", { name: /Next week|Наступний тиждень/i })
      .click();
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/masseur/availability?") &&
        res.request().method() === "GET" &&
        res.status() < 500,
    );
  }

  await expect(page.locator(".fc-event-available")).toHaveCount(1, {
    timeout: 20_000,
  });
});
