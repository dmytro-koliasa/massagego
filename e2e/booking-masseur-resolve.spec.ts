import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("masseur can cancel a booking and keep the slot available", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("masseurResolve");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

  await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const booked = page.locator(".fc-event-booked").first();
  await expect(booked).toBeVisible({ timeout: 20_000 });
  await booked.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: /Make available|Зробити доступним/ })
    .click();

  await expect(
    page.getByText(
      /Booking cancelled\. The slot is available again\.|Бронь скасовано\. Слот знову доступний\./,
    ),
  ).toBeVisible({ timeout: 15_000 });
});
