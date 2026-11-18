import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("masseur credentials sign in to dashboard", async ({ page }) => {
  test.setTimeout(60_000);
  // Reuse walk-in masseur credentials (has passwordHash) without needing UI booking.
  const fixture = await ensureBookingFixture("masseurWalkIn");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

  await expect(page).toHaveURL(/\/masseur\/dashboard\/?$/);
  await expect(
    page.getByRole("heading", { name: /Masseur space|Простір масажиста/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toBeVisible();
});
