import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/admin-auth";
import { ensureAdminForE2E } from "./helpers/ensure-admin";
import { ensureBlockTargetClient } from "./helpers/ensure-block-target";

test("Escape closes the admin ConfirmDialog without applying the action", async ({
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

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: /^Block$|^Заблокувати$/ }),
  ).toBeVisible();
  await expect(page.getByText(/Blocked|Заблокований/)).toHaveCount(0);
});
