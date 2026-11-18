import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("masseur can book a walk-in client on an available slot", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("masseurWalkIn");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

  await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const available = page.locator(".fc-event-available").first();
  await expect(available).toBeVisible({ timeout: 20_000 });
  await available.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", {
      name: /Book slot for a client|Забронювати слот для клієнта/,
    })
    .click();

  await dialog.getByRole("textbox", { name: /Client name|Ім’я клієнта/ }).fill(
    "Walk-in Client",
  );
  const phoneInput = dialog.locator(".PhoneInputInput");
  await expect(phoneInput).toBeVisible();
  await phoneInput.fill("+380501000099");

  await dialog
    .getByRole("button", { name: /Confirm booking|Підтвердити бронь/ })
    .click();

  await expect(
    page.getByText(
      /Slot booked for the client\.|Слот заброньовано для клієнта\./,
    ),
  ).toBeVisible({ timeout: 15_000 });
});
