import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("client can cancel their own booking", async ({ page }) => {
  const fixture = await ensureBookingFixture("cancel");

  await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

  await page.goto(`/client/masseur/${fixture.masseurSlug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: fixture.masseurName }),
  ).toBeVisible({ timeout: 15_000 });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const available = page.locator(".fc-event-available").first();
  await expect(available).toBeVisible({ timeout: 15_000 });
  await available.click();
  await page.getByRole("button", { name: /Request booking|Надіслати заявку/ }).click();
  await expect(
    page.getByText(/Booking request sent\.|Заявку на запис надіслано\./),
  ).toBeVisible({ timeout: 15_000 });

  const mine = page.locator(".fc-event-booked-mine").first();
  await expect(mine).toBeVisible({ timeout: 15_000 });
  await mine.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("select").selectOption("cant_make_it");
  await dialog
    .getByRole("button", { name: /Cancel booking|Скасувати бронювання/ })
    .click();

  await expect(
    page.getByText(/Booking cancelled\.|Бронювання скасовано\./),
  ).toBeVisible({ timeout: 15_000 });
});
