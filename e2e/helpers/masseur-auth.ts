import { expect, type Page } from "@playwright/test";

async function waitForMasseurSession(page: Page) {
  const sessionReady = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/masseur/session") && res.status() < 500,
  );
  await page.goto("/masseur/login", { waitUntil: "domcontentloaded" });
  await sessionReady;
}

export async function signInAsMasseur(
  page: Page,
  email: string,
  password: string,
) {
  await waitForMasseurSession(page);

  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/i,
  });
  if ((await loginTab.getAttribute("aria-selected")) !== "true") {
    await loginTab.click();
  }

  await expect(
    page.getByRole("button", { name: /Sign in|Увійти/i }),
  ).toBeVisible();

  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/i }).click();

  // Auth can succeed while the login page still shows the redirect preloader.
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toBeVisible({ timeout: 20_000 });
  await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/masseur\/dashboard\/?$/, { timeout: 10_000 });
}
