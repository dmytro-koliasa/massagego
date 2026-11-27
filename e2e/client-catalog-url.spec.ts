import { expect, test, type Page } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

async function signInOnCurrentClientLoginPage(
  page: Page,
  phone: string,
  password: string,
) {
  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/i,
  });
  await expect(loginTab).toBeVisible({ timeout: 15_000 });
  await loginTab.click();
  await expect(loginTab).toHaveAttribute("aria-selected", "true");

  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.fill("");
  await phoneInput.fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/i }).click();
}

test.describe("client catalog URL filters (#207)", () => {
  test.setTimeout(90_000);

  test("unauthenticated deep link restores city filter after login", async ({
    page,
  }) => {
    const fixture = await ensureBookingFixture("book");

    await page.goto("/client?city=all&page=1", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/client\/login/);
    const next = new URL(page.url()).searchParams.get("next");
    expect(next).toBe("/client?city=all&page=1");

    await signInOnCurrentClientLoginPage(
      page,
      fixture.clientPhone,
      fixture.clientPassword,
    );

    await expect(page).toHaveURL(/\/client\?city=all/, { timeout: 30_000 });
    const citySelect = page.getByLabel(/Locality|Населений пункт/i);
    await expect(citySelect).toBeVisible({ timeout: 15_000 });
    await expect(citySelect).toHaveValue("all");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/client\?city=all/);
    await expect(citySelect).toHaveValue("all");
  });

  test("changing city updates URL and browser back restores it", async ({
    page,
  }) => {
    const fixture = await ensureBookingFixture("book");
    await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

    const citySelect = page.getByLabel(/Locality|Населений пункт/i);
    await expect(citySelect).toBeVisible({ timeout: 15_000 });

    await citySelect.selectOption({ value: "all" });
    await expect(page).toHaveURL(/\/client\?city=all/);

    const values = await citySelect.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options)
        .map((o) => o.value)
        .filter((v) => v && v !== "all"),
    );
    test.skip(values.length === 0, "no city options in fixture catalog");

    const city = values[0]!;
    await citySelect.selectOption({ value: city });
    await expect(page).toHaveURL(/[?&]city=/);
    expect(new URL(page.url()).searchParams.get("city")).toBe(city);

    await page.goBack();
    await expect(page).toHaveURL(/\/client\?city=all/);
    await expect(citySelect).toHaveValue("all");
  });

  test("rejects malicious next destinations after login", async ({ page }) => {
    const fixture = await ensureBookingFixture("book");
    await page.goto(
      `/client/login?next=${encodeURIComponent("https://evil.example/phish")}`,
      { waitUntil: "domcontentloaded" },
    );

    await signInOnCurrentClientLoginPage(
      page,
      fixture.clientPhone,
      fixture.clientPassword,
    );

    await expect(page).toHaveURL(/\/client\/?$/, { timeout: 30_000 });
    expect(page.url()).not.toContain("evil.example");
  });
});
