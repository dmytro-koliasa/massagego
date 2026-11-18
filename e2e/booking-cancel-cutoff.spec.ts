import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("client cannot cancel after cutoff and sees masseur phone", async ({
  page,
}) => {
  const fixture = await ensureBookingFixture("cutoff");

  await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

  await page.goto(`/client/masseur/${fixture.masseurSlug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: fixture.masseurName }),
  ).toBeVisible({ timeout: 15_000 });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const mine = page.locator(".fc-event-booked-mine").first();
  await expect(mine).toBeVisible({ timeout: 15_000 });
  await mine.click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText(
      new RegExp(
        `Cancellation is no longer available in the app\\. Please call the masseur: ${fixture.masseurPhone.replace("+", "\\+")}|Скасувати запис у застосунку вже не можна\\. Зателефонуйте масажисту: ${fixture.masseurPhone.replace("+", "\\+")}`,
      ),
    ),
  ).toBeVisible({ timeout: 10_000 });
});
