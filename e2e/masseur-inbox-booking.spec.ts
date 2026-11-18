import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("masseur sees inbox badge after client books and clears it on open", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const fixture = await ensureBookingFixture("inbox");

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  try {
    await signInAsClient(
      clientPage,
      fixture.clientPhone,
      fixture.clientPassword,
    );

    await clientPage.goto(`/client/masseur/${fixture.masseurSlug}`);
    await expect(
      clientPage.getByRole("heading", {
        level: 1,
        name: fixture.masseurName,
      }),
    ).toBeVisible({ timeout: 15_000 });

    if (fixture.needsNextWeek) {
      await clientPage.locator(".fc-next-button").click();
    }

    const available = clientPage.locator(".fc-event-available").first();
    await expect(available).toBeVisible({ timeout: 15_000 });
    await available.click();
    await clientPage
      .getByRole("button", { name: /Request booking|Надіслати заявку/ })
      .click();
    await expect(
      clientPage.getByText(
        /Booking request sent\.|Заявку на запис надіслано\./,
      ),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await clientContext.close();
  }

  const masseurContext = await browser.newContext();
  const page = await masseurContext.newPage();
  try {
    await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

    const unreadBadge = page.getByLabel(
      /1 unread notifications|1 непрочитаних сповіщень/,
    );
    await expect(unreadBadge).toBeVisible({ timeout: 20_000 });

    const inboxResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/notifications/inbox") &&
        !res.url().includes("unread") &&
        res.request().method() === "GET",
      { timeout: 60_000 },
    );
    await page
      .getByRole("link", { name: /Notifications|Сповіщення/ })
      .click();
    const inboxRes = await inboxResponse;
    expect(inboxRes.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/masseur\/notifications\/?$/);
    await expect(
      page.getByRole("heading", { name: /Recent|Останні/ }),
    ).toBeVisible({ timeout: 15_000 });

    const inboxRow = page.getByRole("button", {
      name: /New booking|Нове бронювання/,
    });
    await expect(inboxRow).toBeVisible({ timeout: 15_000 });
    await inboxRow.click();

    await expect(page).toHaveURL(/\/masseur\/dashboard\/?$/, {
      timeout: 15_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("link", { name: /Notifications|Сповіщення/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByLabel(/unread notifications|непрочитаних сповіщень/),
    ).toHaveCount(0);
  } finally {
    await masseurContext.close();
  }
});
