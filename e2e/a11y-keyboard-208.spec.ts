import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./helpers/admin-auth";
import { signInAsClient } from "./helpers/client-auth";
import { ensureAdminForE2E } from "./helpers/ensure-admin";
import { ensureBlockTargetClient } from "./helpers/ensure-block-target";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

/**
 * #208 keyboard / focus matrix (Playwright Chromium).
 * Complements axe scans — not a substitute for full WCAG or NVDA/VoiceOver.
 */

async function expectNoHydrationErrors(page: Page) {
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

async function setLocale(page: Page, locale: "en" | "uk") {
  await page.evaluate((next) => {
    localStorage.setItem("serein-locale", next);
    document.cookie = `serein-locale=${next};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = next === "uk" ? "uk" : "en";
  }, locale);
  const group = page.getByRole("group", { name: /Language|Мова/i });
  const target = group.getByRole("button", {
    name: locale === "uk" ? /^УКР$/i : /^ENG$/i,
  });
  if (await target.isVisible()) {
    await target.click();
  }
  await expect
    .poll(async () => page.locator("html").getAttribute("lang"))
    .toBe(locale === "uk" ? "uk" : "en");
}

test.describe("a11y keyboard matrix (#208)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("home and login: tab order reaches primary controls", async ({
    page,
  }) => {
    const done = await expectNoHydrationErrors(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press("Tab");
    const firstFocused = await page.evaluate(
      () => document.activeElement?.tagName ?? "",
    );
    expect(["A", "BUTTON", "INPUT", "SELECT"].includes(firstFocused)).toBe(
      true,
    );

    const brand = page.locator('header a[href="/"]').first();
    await brand.focus();
    await expect(brand).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/client/login", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Client space|Простір клієнта/i,
      }),
    ).toBeVisible({ timeout: 15_000 });

    const registerTab = page.getByRole("tab", {
      name: /Register new user|Зареєструвати нового користувача/i,
    });
    await registerTab.focus();
    await expect(registerTab).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(registerTab).toHaveAttribute("aria-selected", "true");

    await setLocale(page, "uk");
    await expect(
      page.getByRole("heading", { level: 1, name: /Простір клієнта/i }),
    ).toBeVisible();
    await setLocale(page, "en");

    done();
  });

  test("client catalog: filter focus, locale UK, theme toggle", async ({
    page,
  }) => {
    const done = await expectNoHydrationErrors(page);
    const fixture = await ensureBookingFixture("book");
    await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Client space|Простір клієнта/i,
      }),
    ).toBeVisible({ timeout: 15_000 });

    const city = page.getByLabel(/Locality|Населений пункт/i);
    await city.focus();
    await expect(city).toBeFocused();
    await page.keyboard.press("Tab");

    await setLocale(page, "uk");
    await expect(
      page.getByRole("heading", { level: 1, name: /Простір клієнта/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/Населений пункт/i)).toBeVisible();

    const themeToggle = page.getByRole("button", {
      name: /Switch to (light|dark) theme/i,
    });
    await themeToggle.focus();
    await expect(themeToggle).toBeFocused();
    const beforeDark = await page.locator("html").evaluate((el) =>
      el.classList.contains("dark"),
    );
    await page.keyboard.press("Enter");
    await expect
      .poll(async () =>
        page.locator("html").evaluate((el) => el.classList.contains("dark")),
      )
      .not.toBe(beforeDark);

    await setLocale(page, "en");
    done();
  });

  test("masseur dashboard: primary actions are keyboard-focusable", async ({
    page,
  }) => {
    const done = await expectNoHydrationErrors(page);
    const fixture = await ensureBookingFixture("book");
    await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

    await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2").first()).toBeVisible({
      timeout: 15_000,
    });

    const signOut = page.getByRole("button", { name: /Sign out|Вийти/i });
    await signOut.focus();
    await expect(signOut).toBeFocused();

    await setLocale(page, "uk");
    await expect(page.getByRole("button", { name: /Вийти/i })).toBeVisible();
    await setLocale(page, "en");

    done();
  });

  test("admin ConfirmDialog: focus moves in, Escape restores", async ({
    page,
  }) => {
    const done = await expectNoHydrationErrors(page);
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

    const blockBtn = page.getByRole("button", {
      name: /^Block$|^Заблокувати$/,
    });
    await blockBtn.focus();
    await expect(blockBtn).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect
      .poll(async () =>
        dialog.evaluate((el) => el.contains(document.activeElement)),
      )
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(blockBtn).toBeFocused();

    done();
  });
});
