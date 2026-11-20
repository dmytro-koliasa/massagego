import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("client can request a password reset link", async ({ page }) => {
  test.setTimeout(60_000);
  const fixture = await ensureBookingFixture("book");

  const sessionReady = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/client/session") && res.status() < 500,
  );
  await page.goto("/client/login", { waitUntil: "domcontentloaded" });
  await sessionReady;

  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/i,
  });
  await loginTab.click();
  await expect(loginTab).toHaveAttribute("aria-selected", "true");

  await page
    .getByRole("button", { name: /Forgot password|Забув пароль/i })
    .click();

  const phoneInput = page.locator(".PhoneInputInput");
  await expect(phoneInput).toBeVisible();
  await phoneInput.fill(fixture.clientPhone);

  await page
    .getByRole("button", { name: /Send reset link|Надіслати посилання/ })
    .click();

  await expect(
    page.getByText(
      /If an account can reset its password, we sent a link\.|Якщо для цього акаунта можливе скидання пароля, ми надіслали посилання\./,
    ),
  ).toBeVisible({ timeout: 15_000 });

  // Forgot form returns to login after success.
  await expect(
    page.getByRole("button", { name: /Sign in|Увійти/i }),
  ).toBeVisible();
});
