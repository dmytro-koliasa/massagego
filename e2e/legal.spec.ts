import { expect, test } from "@playwright/test";

test("privacy page is reachable", async ({ page }) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Privacy Policy|Політика конфіденційності/,
    }),
  ).toBeVisible();
  await expect(page.getByText(/MassageGo/).first()).toBeVisible();
});

test("terms page is reachable", async ({ page }) => {
  await page.goto("/terms");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Terms of Service|Умови використання/,
    }),
  ).toBeVisible();
  await expect(page.getByText(/MassageGo/).first()).toBeVisible();
});
