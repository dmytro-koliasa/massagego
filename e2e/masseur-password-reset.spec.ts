import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("masseur can request a password reset link", async ({ page }) => {
  test.setTimeout(60_000);
  const fixture = await ensureBookingFixture("masseurWalkIn");

  const sessionReady = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/masseur/session") && res.status() < 500,
  );
  await page.goto("/masseur/login", { waitUntil: "domcontentloaded" });
  await sessionReady;

  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/,
  });
  if ((await loginTab.getAttribute("aria-selected")) !== "true") {
    await loginTab.click();
  }

  await page
    .getByRole("button", { name: /Forgot password|Забув пароль/ })
    .click();

  await page.locator('input[type="email"]').fill(fixture.masseurEmail);
  await page
    .getByRole("button", { name: /Send reset link|Надіслати посилання/ })
    .click();

  await expect(
    page.getByText(
      /If an account can reset its password, we sent a link\.|Якщо для цього акаунта можливе скидання пароля, ми надіслали посилання\./,
    ),
  ).toBeVisible({ timeout: 15_000 });

  await expect(
    page.getByRole("button", { name: /Sign in|Увійти/ }),
  ).toBeVisible();
});
