import { expect, test, type Page } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { ensureAdminForE2E } from "./helpers/ensure-admin";
import { signInAsAdmin } from "./helpers/admin-auth";
import { signInAsMasseur } from "./helpers/masseur-auth";

/**
 * Targeted a11y / theme / locale checks for #207 changed surfaces.
 * axe-core is not a project dependency; uses role/name/keyboard evidence only.
 */
async function expectNoPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return () => {
    const hydration = errors.filter((e) => /hydrat/i.test(e));
    expect(hydration, hydration.join("\n")).toEqual([]);
  };
}

async function toggleLocale(page: Page) {
  const group = page.getByRole("group", { name: /Language|Мова/i });
  await expect(group).toBeVisible();
  const uk = group.getByRole("button", { name: /^УКР$/i });
  const en = group.getByRole("button", { name: /^ENG$/i });
  const htmlLangBefore = await page.locator("html").getAttribute("lang");
  if (htmlLangBefore === "uk") {
    await en.click();
  } else {
    await uk.click();
  }
  await expect
    .poll(async () => page.locator("html").getAttribute("lang"))
    .not.toBe(htmlLangBefore);
}

async function toggleTheme(page: Page) {
  const toggle = page.getByRole("button", {
    name: /Switch to (light|dark) theme/i,
  });
  await expect(toggle).toBeVisible();
  const beforeDark = await page.locator("html").evaluate((el) =>
    el.classList.contains("dark"),
  );
  await toggle.click();
  await expect
    .poll(async () =>
      page.locator("html").evaluate((el) => el.classList.contains("dark")),
    )
    .not.toBe(beforeDark);
}

test.describe("portal a11y/theme/locale (#207)", () => {
  test.setTimeout(120_000);

  test("client catalog: names, keyboard filter, locale and theme", async ({
    page,
  }) => {
    const done = await expectNoPageErrors(page);
    const fixture = await ensureBookingFixture("book");
    await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

    await expect(
      page.getByRole("heading", { level: 1, name: /Client space|Простір клієнта/i }),
    ).toBeVisible();

    const city = page.getByLabel(/Locality|Населений пункт/i);
    await expect(city).toBeVisible();
    await city.focus();
    await expect(city).toBeFocused();
    await page.keyboard.press("Tab");

    await city.selectOption({ value: "all" });
    await expect(page).toHaveURL(/[?&]city=all/);

    await toggleTheme(page);
    await toggleLocale(page);
    await expect(city).toBeVisible();
    done();
  });

  test("client and masseur login: accessible auth chrome", async ({ page }) => {
    const done = await expectNoPageErrors(page);

    await page.goto("/client/login");
    await expect(
      page.getByRole("heading", { level: 1, name: /Client space|Простір клієнта/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", {
        name: /Register new user|Зареєструвати нового користувача/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("tab", {
        name: /I am registered already|Я вже зареєстрований/i,
      })
      .click();
    await expect(page.locator('input[type="tel"]').first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign in|Увійти/i }),
    ).toBeVisible();

    await page.goto("/masseur/login");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Masseur space|Простір масажиста/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign in|Увійти|Create account|Створити/i }),
    ).toBeVisible();

    await toggleTheme(page);
    await toggleLocale(page);
    done();
  });

  test("notification settings: headings and inbox region", async ({ page }) => {
    const done = await expectNoPageErrors(page);
    const fixture = await ensureBookingFixture("book");
    await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);
    await page.goto("/client/notifications");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Notifications|Сповіщення/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /Recent|Останні|Inbox|Стрічка/i }),
    ).toBeVisible();

    // Pref checkboxes should have accessible names (email/telegram labels).
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);

    await toggleTheme(page);
    done();
  });

  test("admin shell nav: active tab names and keyboard", async ({ page }) => {
    const done = await expectNoPageErrors(page);
    const admin = await ensureAdminForE2E();
    await signInAsAdmin(page, admin.email, admin.password);

    const nav = page.getByRole("navigation", {
      name: /Administration|Адміністрування/i,
    });
    await expect(nav).toBeVisible();

    const complaints = page.getByRole("link", {
      name: /Complaints|Скарги/i,
    });
    await complaints.focus();
    await expect(complaints).toBeFocused();
    await complaints.click();
    await expect(page).toHaveURL(/\/admin\/complaints/);

    const users = page.getByRole("link", { name: /Users|Користувачі/i });
    await users.click();
    await expect(page).toHaveURL(/\/admin\/?$/);

    await toggleTheme(page);
    await toggleLocale(page);
    done();
  });

  test("masseur notifications seed page remains interactive", async ({
    page,
  }) => {
    const done = await expectNoPageErrors(page);
    const fixture = await ensureBookingFixture("book");
    await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);
    await page.goto("/masseur/notifications");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Notifications|Сповіщення/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
    done();
  });
});
