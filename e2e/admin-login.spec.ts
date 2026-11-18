import { expect, test } from "@playwright/test";
import { ensureAdminForE2E } from "./helpers/ensure-admin";

test("admin login page is reachable", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Admin sign-in|Вхід адміністратора/,
    }),
  ).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("admin bootstrap credentials sign in to /admin", async ({ page }) => {
  const { email, password } = await ensureAdminForE2E();

  // Wait for portal SessionProvider hydration before submit — otherwise the
  // form does a native GET to `/admin/login?` without React onSubmit.
  const sessionReady = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/admin/session") && res.status() < 500,
  );
  await page.goto("/admin/login");
  await sessionReady;

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/ }).click();

  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /Users|Користувачі/ }),
  ).toBeVisible();
});
