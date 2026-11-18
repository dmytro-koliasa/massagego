import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("client can book a free masseur slot", async ({ page }) => {
  const fixture = await ensureBookingFixture("book");

  await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

  await page.goto(`/client/masseur/${fixture.masseurSlug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: fixture.masseurName }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /Choose time slots|Оберіть час/ }),
  ).toBeVisible();

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
});
