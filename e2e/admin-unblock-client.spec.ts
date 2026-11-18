import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/admin-auth";
import { signInAsClient } from "./helpers/client-auth";
import { ensureAdminForE2E } from "./helpers/ensure-admin";
import { ensureBlockTargetClient } from "./helpers/ensure-block-target";

test("admin can unblock a client and the client can sign in", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const admin = await ensureAdminForE2E();
  const client = await ensureBlockTargetClient("unblock");

  await signInAsAdmin(page, admin.email, admin.password);

  await page.goto(`/admin/users/${client.id}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", {
      name: /User detail|Картка користувача/,
    }),
  ).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText(/Blocked|Заблокований/).first()).toBeVisible();
  await page.getByRole("button", { name: /Unblock|Розблокувати/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: /Unblock this account\?|Розблокувати акаунт\?/,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Unblock|Розблокувати/ }).click();

  await expect(page.getByText(/Saved\.|Збережено\./)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Active|Активний/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Block$|^Заблокувати$/ }),
  ).toBeVisible();

  await signInAsClient(page, client.phone, client.password);
  await expect(page).toHaveURL(/\/client\/?$/);
});
