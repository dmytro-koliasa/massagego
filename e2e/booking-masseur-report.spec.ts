import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("masseur can report a client from a booked slot", async ({ page }) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("masseurReport");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

  await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const booked = page.locator(".fc-event-booked").first();
  await expect(booked).toBeVisible({ timeout: 20_000 });
  await booked.click();

  const slotDialog = page.getByRole("dialog");
  await expect(slotDialog).toBeVisible();
  await slotDialog
    .getByRole("button", { name: /Report|Поскаржитися/ })
    .click();

  const report = page.getByRole("dialog");
  await expect(
    report.getByRole("heading", {
      name: /Report this user|Поскаржитися на користувача/,
    }),
  ).toBeVisible();
  await report.locator("select").selectOption("spam");
  await report.locator("textarea").fill("E2E masseur report about the client.");
  await report
    .getByRole("button", { name: /Submit report|Надіслати скаргу/ })
    .click();

  await expect(
    page.getByText(/Report submitted\.|Скаргу надіслано\./),
  ).toBeVisible({ timeout: 15_000 });
});
