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
    name: /I am registered already|Я вже зареєстрований/,
  });
  if ((await loginTab.getAttribute("aria-selected")) !== "true") {
    await loginTab.click();
  }

  await expect(
    page.getByRole("button", { name: /Sign in|Увійти/ }),
  ).toBeVisible();

  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/ }).click();

  await expect(page).toHaveURL(/\/masseur\/dashboard\/?$/, { timeout: 20_000 });
}
