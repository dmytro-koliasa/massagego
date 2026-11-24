import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureDeleteClientFixture } from "./helpers/ensure-client-fixture";

async function switchToClientLoginTab(page: import("@playwright/test").Page) {
  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/i,
  });
  await expect(loginTab).toBeVisible();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await loginTab.click();
    if ((await loginTab.getAttribute("aria-selected")) === "true") {
      return;
    }
    await page.waitForTimeout(250);
  }
  await expect(loginTab).toHaveAttribute("aria-selected", "true");
}

test("client can delete their account and cannot sign in again", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await ensureDeleteClientFixture();

  await signInAsClient(page, fixture.phone, fixture.password);

  await page.goto("/client", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /Delete account|Видалити акаунт/i }),
  ).toBeVisible({ timeout: 20_000 });

  await page
    .getByRole("button", { name: /^Delete account$|^Видалити акаунт$/i })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(/Delete your account\?|Видалити акаунт\?/i),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: /^Delete$|^Видалити$/i })
    .click();

  await expect(
    page.getByText(/Account deleted\.|Акаунт видалено\./),
  ).toBeVisible({ timeout: 20_000 });

  await expect(page).toHaveURL(/\/client\/login\/?/, { timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toHaveCount(0);

  await page.goto("/client/login", { waitUntil: "domcontentloaded" });
  await switchToClientLoginTab(page);

  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.fill("");
  await phoneInput.fill(fixture.phone);
  await page.locator('input[type="password"]').first().fill(fixture.password);
  await page.getByRole("button", { name: /Sign in|Увійти/i }).click();

  // Soft-deleted clients must not get a session (invalid credentials toast or stay logged out).
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/client\/login/);
  await expect(
    page.getByText(
      /Invalid phone or password\.|Невірний телефон або пароль\.|Invalid email or password\./i,
    ),
  ).toBeVisible({ timeout: 5_000 });
});
