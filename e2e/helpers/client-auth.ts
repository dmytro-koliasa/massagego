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
    name: /I am registered already|Я вже зареєстрований/i,
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
    page.getByRole("button", { name: /Sign in|Увійти/i }),
  ).toBeVisible();

  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.fill("");
  await phoneInput.fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/i }).click();

  // SiteHeader hides Sign out on portal login routes (#161). Wait until auth
  // navigation leaves /client/login, then assert session chrome. Do not race a
  // hard goto against the in-flight router.push from sign-in.
  await expect(page).toHaveURL(/\/client(?!\/login)/, { timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/client\/?$/, { timeout: 15_000 });
}
