import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/admin-auth";
import { ensureAdminForE2E } from "./helpers/ensure-admin";
import { ensureOpenComplaint } from "./helpers/ensure-open-complaint";

test("admin can dismiss an open complaint", async ({ page }) => {
  test.setTimeout(90_000);
  const admin = await ensureAdminForE2E();
  const complaint = await ensureOpenComplaint("dismiss");

  await signInAsAdmin(page, admin.email, admin.password);

  await page.goto("/admin/complaints", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /Complaints|Скарги/ }),
  ).toBeVisible({ timeout: 15_000 });

  const card = page.locator("li").filter({ hasText: complaint.body });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: /Dismissed|Відхилено/ }).click();

  await expect(
    page.getByText(/Complaint updated\.|Скаргу оновлено\./),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator("li").filter({ hasText: complaint.body }),
  ).toHaveCount(0, { timeout: 15_000 });

  await page
    .getByRole("button", { name: /^Dismissed$|^Відхилено$/ })
    .first()
    .click();
  await expect(
    page.locator("li").filter({ hasText: complaint.body }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page
      .locator("li")
      .filter({ hasText: complaint.body })
      .getByText(/Dismissed|Відхилено/)
      .first(),
  ).toBeVisible();
});
