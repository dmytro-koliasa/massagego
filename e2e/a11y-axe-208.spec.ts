import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./helpers/admin-auth";
import {
  scanPageWcagAa,
  writeAxeSummary,
  type AxeScanSummary,
} from "./helpers/axe";
import { signInAsClient } from "./helpers/client-auth";
import { ensureAdminForE2E } from "./helpers/ensure-admin";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

/**
 * #208 automated WCAG A/AA axe scans (sanitized reports).
 * Serious/critical violations fail the test; moderate/minor are recorded for triage.
 * Automated scans alone do not prove full WCAG compliance.
 */

async function assertNoSeriousA11y(page: Page, label: string, fileName: string) {
  const summary = await scanPageWcagAa(page, label);
  writeAxeSummary(summary, fileName);
  expect(
    summary.seriousOrCritical,
    formatSerious(summary),
  ).toEqual([]);
}

function formatSerious(summary: AxeScanSummary): string {
  if (summary.seriousOrCritical.length === 0) return "";
  return summary.seriousOrCritical
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.description} (${v.nodes} nodes) ${v.helpUrl}`,
    )
    .join("\n");
}

test.describe("axe WCAG AA public (#208)", () => {
  test.setTimeout(120_000);

  test("public marketing and legal pages", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(page, "home", "axe-home.json");

    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(page, "privacy", "axe-privacy.json");

    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(page, "terms", "axe-terms.json");
  });

  test("client and masseur login pages", async ({ page }) => {
    await page.goto("/client/login", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: /Client space|Простір клієнта/i }),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(page, "client-login", "axe-client-login.json");

    await page.goto("/masseur/login", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Masseur space|Простір масажиста/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(page, "masseur-login", "axe-masseur-login.json");
  });

  test("admin login page", async ({ page }) => {
    // Admin login RSC may query the DB (bootstrap presence); requires Postgres up.
    await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Admin sign-in|Вхід адміністратора/,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(page, "admin-login", "axe-admin-login.json");
  });
});

/**
 * Serial: parallel fixture upserts + Next RSC against local Postgres briefly
 * terminate connections under 6 workers (harness, not product). Keep CI retries.
 */
test.describe("axe WCAG AA authenticated (#208)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("authenticated client catalog and notifications", async ({ page }) => {
    const fixture = await ensureBookingFixture("book");
    await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

    await expect(
      page.getByRole("heading", { level: 1, name: /Client space|Простір клієнта/i }),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(page, "client-catalog", "axe-client-catalog.json");

    await page.goto("/client/notifications", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: /Notifications|Сповіщення/i }),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(
      page,
      "client-notifications",
      "axe-client-notifications.json",
    );
  });

  test("authenticated masseur dashboard and notifications", async ({ page }) => {
    const fixture = await ensureBookingFixture("book");
    await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);

    await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(
      page,
      "masseur-dashboard",
      "axe-masseur-dashboard.json",
    );

    await page.goto("/masseur/notifications", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: /Notifications|Сповіщення/i }),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(
      page,
      "masseur-notifications",
      "axe-masseur-notifications.json",
    );
  });

  test("authenticated admin shell", async ({ page }) => {
    const admin = await ensureAdminForE2E();
    await signInAsAdmin(page, admin.email, admin.password);

    await expect(
      page.getByRole("heading", { name: /Users|Користувачі/ }),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(page, "admin-users", "axe-admin-users.json");

    await page.goto("/admin/complaints", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Complaints|Скарги/ }),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousA11y(
      page,
      "admin-complaints",
      "axe-admin-complaints.json",
    );
  });

  test("home and client catalog: dark theme + mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    const themeToggle = page.getByRole("button", {
      name: /Switch to (light|dark) theme/i,
    });
    await expect(themeToggle).toBeVisible();
    const beforeDark = await page.locator("html").evaluate((el) =>
      el.classList.contains("dark"),
    );
    if (!beforeDark) {
      await themeToggle.click();
    }
    const toggledDark = await page
      .locator("html")
      .evaluate((el) => el.classList.contains("dark"))
      .catch(() => false);
    if (!toggledDark) {
      // Fallback only if the control click did not apply (harness race).
      await page.evaluate(() => {
        localStorage.setItem("serein-theme", "dark");
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
        document.cookie =
          "serein-theme=dark;path=/;max-age=31536000;samesite=lax";
      });
    }
    await expect
      .poll(
        async () =>
          page.locator("html").evaluate((el) => el.classList.contains("dark")),
        { timeout: 10_000 },
      )
      .toBe(true);
    await assertNoSeriousA11y(page, "home-dark-mobile", "axe-home-dark-mobile.json");

    const fixture = await ensureBookingFixture("book");
    await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);
    await expect(
      page.getByRole("heading", { level: 1, name: /Client space|Простір клієнта/i }),
    ).toBeVisible({ timeout: 15_000 });
    const portalDark = await page.locator("html").evaluate((el) =>
      el.classList.contains("dark"),
    );
    if (!portalDark) {
      const portalToggle = page.getByRole("button", {
        name: /Switch to (light|dark) theme/i,
      });
      if (await portalToggle.isVisible()) {
        await portalToggle.click();
      }
    }
    await expect
      .poll(
        async () =>
          page.locator("html").evaluate((el) => el.classList.contains("dark")),
        { timeout: 10_000 },
      )
      .toBe(true);
    await assertNoSeriousA11y(
      page,
      "client-catalog-dark-mobile",
      "axe-client-catalog-dark-mobile.json",
    );
  });
});
