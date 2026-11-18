import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("masseur can mark a free slot unavailable and save", async ({ page }) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("slotUnavailable");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

  await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const available = page.locator(".fc-event-available");
  await expect(available).toHaveCount(1, { timeout: 20_000 });
  await available.first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: /Make unavailable|Зробити недоступним/ })
    .click();

  await expect(page.locator(".fc-event-available")).toHaveCount(0, {
    timeout: 10_000,
  });

  await page
    .getByRole("button", { name: /Save profile|Зберегти профіль/ })
    .click();
  await expect(
    page.getByText(/Profile saved\.|Профіль збережено\./),
  ).toBeVisible({ timeout: 15_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }
  await expect(page.locator(".fc-event-available")).toHaveCount(0, {
    timeout: 20_000,
  });
});
