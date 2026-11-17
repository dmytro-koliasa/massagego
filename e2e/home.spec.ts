import { expect, test } from "@playwright/test";

test("home page loads with brand", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("MassageGo").first()).toBeVisible();
});
