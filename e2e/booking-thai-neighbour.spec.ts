import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("cancelling one Thai slot hints to cancel the neighbour", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("thai");

  await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

  await page.goto(`/client/masseur/${fixture.masseurSlug}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { level: 1, name: fixture.masseurName }),
  ).toBeVisible({ timeout: 20_000 });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const mine = page.locator(".fc-event-booked-mine");
  await expect(mine).toHaveCount(2, { timeout: 15_000 });
  await mine.first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("select").selectOption("cant_make_it");
  await dialog
    .getByRole("button", { name: /Cancel booking|Скасувати бронювання/ })
    .click();

  await expect(
    page.getByText(/Booking cancelled\.|Бронювання скасовано\./),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(
      /You cancelled one Thai slot\. Consider cancelling the neighbouring hour too\.|Ви скасували один слот тайського масажу\. Рекомендуємо скасувати й сусідню годину\./,
    ),
  ).toBeVisible({ timeout: 10_000 });
});
