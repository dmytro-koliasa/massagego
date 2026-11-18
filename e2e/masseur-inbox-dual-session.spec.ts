import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("dual portal cookies: masseur inbox works; bare fetch is ambiguous", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await ensureBookingFixture("inboxDual");

  // One browser context keeps both Auth.js portal cookies.
  await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

  await page.goto(`/client/masseur/${fixture.masseurSlug}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: fixture.masseurName,
    }),
  ).toBeVisible({ timeout: 15_000 });

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const available = page.locator(".fc-event-available").first();
  await expect(available).toBeVisible({ timeout: 15_000 });
  await available.click();
  await page
    .getByRole("button", { name: /Request booking|Надіслати заявку/ })
    .click();
  await expect(
    page.getByText(/Booking request sent\.|Заявку на запис надіслано\./),
  ).toBeVisible({ timeout: 15_000 });

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

  const unreadBadge = page.getByLabel(
    /1 unread notifications|1 непрочитаних сповіщень/,
  );
  await expect(unreadBadge).toBeVisible({ timeout: 20_000 });

  const inboxResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/notifications/inbox") &&
      !res.url().includes("unread") &&
      res.request().method() === "GET" &&
      res.request().headers()["x-portal"] === "masseur",
    { timeout: 60_000 },
  );
  await page.getByRole("link", { name: /Notifications|Сповіщення/ }).click();
  const inboxRes = await inboxResponse;
  expect(inboxRes.ok()).toBeTruthy();

  await expect(page).toHaveURL(/\/masseur\/notifications\/?$/);
  await expect(
    page.getByRole("heading", { name: /Recent|Останні/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: /New booking|Нове бронювання/ }),
  ).toBeVisible({ timeout: 15_000 });

  const bare = await page.evaluate(async () => {
    const response = await fetch("/api/notifications/inbox");
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { status: response.status, error: body?.error ?? null };
  });
  expect(bare).toEqual({ status: 409, error: "ambiguous_portal" });
});
