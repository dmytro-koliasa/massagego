import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("client can file a complaint about a masseur from My sessions", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("complaint");

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
    .getByRole("button", { name: /Report|Поскаржитися/ })
    .click();

  const report = page.getByRole("dialog");
  await expect(
    report.getByRole("heading", {
      name: /Report this user|Поскаржитися на користувача/,
    }),
  ).toBeVisible();
  await report.locator("select").selectOption("rude");
  await report.locator("textarea").fill("E2E complaint about the session.");
  await report
    .getByRole("button", { name: /Submit report|Надіслати скаргу/ })
    .click();

  await expect(
    page.getByText(/Report submitted\.|Скаргу надіслано\./),
  ).toBeVisible({ timeout: 15_000 });
});
