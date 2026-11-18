import { expect, type Page } from "@playwright/test";

async function waitForClientSession(page: Page) {
  const sessionReady = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/client/session") && res.status() < 500,
  );
  await page.goto("/client/login", { waitUntil: "domcontentloaded" });
  await sessionReady;
}

async function switchToClientLoginTab(page: Page) {
  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/,
  });
  await expect(loginTab).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await loginTab.click();
    if ((await loginTab.getAttribute("aria-selected")) === "true") {
      return;
    }
    await page.waitForTimeout(250);
  }
  await expect(loginTab).toHaveAttribute("aria-selected", "true");
}

export async function signInAsClient(
  page: Page,
  phone: string,
  password: string,
) {
  await waitForClientSession(page);
  await switchToClientLoginTab(page);

  await expect(
    page.getByRole("button", { name: /Sign in|Увійти/ }),
  ).toBeVisible();

  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.fill("");
  await phoneInput.fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/ }).click();

  // Auth can succeed while the login page still shows the redirect preloader.
  // Prefer an explicit navigation once the session is clearly established.
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toBeVisible({ timeout: 20_000 });
  await page.goto("/client", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/client\/?$/, { timeout: 10_000 });
}
