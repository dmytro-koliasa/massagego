import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("found deep-link slot briefly pulses on the calendar", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await ensureBookingFixture("slotDeepLinkPulse");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

  const cancellationsResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/cancellations") &&
      res.request().method() === "GET",
    { timeout: 60_000 },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const cancellationsRes = await cancellationsResponse;
  expect(cancellationsRes.ok()).toBeTruthy();

  const list = page.getByRole("heading", {
    name: /Recent cancellations|Недавні скасування/,
  });
  await expect(list).toBeVisible({ timeout: 20_000 });
  await list.scrollIntoViewIfNeeded();

  const rowLink = page.getByRole("link", {
    name: /Open .+ on the calendar|Відкрити .+ у календарі/,
  });
  await expect(rowLink).toBeVisible({ timeout: 15_000 });
  await rowLink.click();

  await expect(page.locator(".fc-event-deep-link-pulse").first()).toBeVisible({
    timeout: 20_000,
  });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(
    dialog.getByText(
      /What do you want to do with this slot\?|Що зробити з цим слотом\?/,
    ),
  ).toBeVisible();

  await expect
    .poll(() => {
      const url = new URL(page.url());
      return (
        /\/masseur\/dashboard\/?$/.test(url.pathname) &&
        !url.searchParams.has("slot")
      );
    })
    .toBe(true);
});
