import { expect, type Page } from "@playwright/test";

export async function signInAsAdmin(
  page: Page,
  email: string,
  password: string,
) {
  const sessionReady = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/admin/session") && res.status() < 500,
  );
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await sessionReady;

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/i }).click();

  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /Users|Користувачі/ }),
  ).toBeVisible();
}
