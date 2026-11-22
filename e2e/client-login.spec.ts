import { expect, test } from "@playwright/test";

test("client login page is reachable", async ({ page }) => {
  await page.goto("/client/login");
  await expect(
    page.getByRole("heading", { level: 1, name: /Client space|Простір клієнта/ }),
  ).toBeVisible();

  // Client portal defaults to the register tab.
  await expect(
    page.getByRole("tab", { name: /I am registered already|Я вже зареєстрований/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /Register new user|Зареєструвати нового користувача/i }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel(/Full name|Повне ім.?я/i).first()).toBeVisible();
  await expect(page.locator('input[type="tel"], input[name="tel"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Create account|Створити акаунт/ }),
  ).toBeVisible();
});
