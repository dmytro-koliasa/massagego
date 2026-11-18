import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("client can cancel a booking from My sessions", async ({ page }) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("sessionsCancel");

  await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

  await page.goto("/client", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /My sessions|Мої сеанси/ }),
  ).toBeVisible({ timeout: 20_000 });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").last().click();
  }

  const session = page.locator(".fc-event-booked-mine").first();
  await expect(session).toBeVisible({ timeout: 20_000 });
  await session.click();

  const actions = page.getByRole("dialog");
  await expect(actions).toBeVisible();
  await actions
    .getByRole("button", { name: /Cancel booking|Скасувати бронювання/ })
    .click();

  const cancel = page.getByRole("dialog");
  await expect(cancel.locator("select")).toBeVisible();
  await cancel.locator("select").selectOption("changed_mind");
  await cancel
    .getByRole("button", { name: /Cancel booking|Скасувати бронювання/ })
    .click();

  await expect(
    page.getByText(/Booking cancelled\.|Бронювання скасовано\./),
  ).toBeVisible({ timeout: 15_000 });
});
