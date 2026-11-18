import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("masseur can bulk-cancel upcoming bookings and keep hours available", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await ensureBookingFixture("bulkCancel");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

  const countResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/bookings/bulk-cancel") &&
      res.request().method() === "GET",
    { timeout: 60_000 },
  );
  const availabilityResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/availability?") &&
      res.request().method() === "GET",
    { timeout: 60_000 },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const countRes = await countResponse;
  expect(countRes.ok()).toBeTruthy();
  await availabilityResponse;

  const section = page.locator("#bulk-cancel");
  await section.scrollIntoViewIfNeeded();
  await expect(
    section.getByText(/Upcoming bookings: 1|Майбутніх бронювань: 1/),
  ).toBeVisible({ timeout: 20_000 });

  if (fixture.needsNextWeek) {
    await page.getByRole("button", { name: "Next week" }).click();
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/masseur/availability?") &&
        res.request().method() === "GET",
      { timeout: 30_000 },
    );
  }

  await expect(page.locator(".fc-event-booked").first()).toBeVisible({
    timeout: 20_000,
  });

  await section
    .getByRole("button", {
      name: /Cancel all upcoming|Скасувати всі майбутні/,
    })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: /Cancel 1 upcoming booking|Скасувати майбутні бронювання \(1\)/,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel(/Keep hours available|Залишити години доступними/),
  ).toBeChecked();

  await dialog
    .getByRole("button", { name: /^Cancel all$|^Скасувати всі$/ })
    .click();

  await expect(
    page.getByText(
      /Cancelled 1 booking\(s\)\. Hours are available again\.|Скасовано бронювань: 1\. Години знову доступні\./,
    ),
  ).toBeVisible({ timeout: 15_000 });

  await expect(page.locator(".fc-event-booked")).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(page.locator(".fc-event-available").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    section.getByText(/Upcoming bookings: 0|Майбутніх бронювань: 0/),
  ).toBeVisible({ timeout: 15_000 });
});
