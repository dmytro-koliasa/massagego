import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/admin-auth";
import { ensureAdminForE2E } from "./helpers/ensure-admin";
import { ensureBlockTargetClient } from "./helpers/ensure-block-target";

test("admin can block a client and the client cannot sign in", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const admin = await ensureAdminForE2E();
  const client = await ensureBlockTargetClient("block");

  await signInAsAdmin(page, admin.email, admin.password);

  await page.goto(`/admin/users/${client.id}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", {
      name: /User detail|Картка користувача/,
    }),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /^Block$|^Заблокувати$/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: /Block this account\?|Заблокувати акаунт\?/,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /^Block$|^Заблокувати$/ }).click();

  await expect(page.getByText(/Saved\.|Збережено\./)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Blocked|Заблокований/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Unblock|Розблокувати/ }),
  ).toBeVisible();

  await page.goto("/client/login", { waitUntil: "domcontentloaded" });
  // signInAsClient expects success; drive the form manually for the blocked case.
  const sessionReady = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/client/session") && res.status() < 500,
  );
  await sessionReady;

  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/,
  });
  await loginTab.click();
  await page.locator('input[type="tel"]').first().fill(client.phone);
  await page.locator('input[type="password"]').first().fill(client.password);
  await page.getByRole("button", { name: /Sign in|Увійти/ }).click();

  await expect(
    page.getByText(
      /Your account is blocked\. Contact support\.|Ваш акаунт заблоковано\. Зверніться в підтримку\./,
    ),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/client\/login/);
});
