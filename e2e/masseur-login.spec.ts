import { expect, test } from "@playwright/test";

test("masseur login page is reachable", async ({ page }) => {
  await page.goto("/masseur/login");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Masseur space|Простір масажиста/,
    }),
  ).toBeVisible();
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sign in|Увійти/ }),
  ).toBeVisible();
});
