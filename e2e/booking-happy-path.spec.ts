import { expect, test, type Page } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

async function waitForClientSession(page: Page) {
  const sessionReady = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/client/session") && res.status() < 500,
  );
  await page.goto("/client/login");
  await sessionReady;
}

async function switchToClientLoginTab(page: Page) {
  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/,
  });
  await expect(loginTab).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await loginTab.click();
    if ((await loginTab.getAttribute("aria-selected")) === "true") {
      return;
    }
    await page.waitForTimeout(250);
  }
  await expect(loginTab).toHaveAttribute("aria-selected", "true");
}

async function signInAsClient(
  page: Page,
  phone: string,
  password: string,
) {
  await waitForClientSession(page);
  await switchToClientLoginTab(page);

  await expect(
    page.getByRole("button", { name: /Sign in|Увійти/ }),
  ).toBeVisible();

  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.fill("");
  await phoneInput.fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/ }).click();

  await expect(page).toHaveURL(/\/client\/?$/, { timeout: 15_000 });
}

test("client can book a free masseur slot", async ({ page }) => {
  const fixture = await ensureBookingFixture();

  await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

  await page.goto(`/client/masseur/${fixture.masseurSlug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: fixture.masseurName }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /Choose time slots|Оберіть час/ }),
  ).toBeVisible();

  if (fixture.needsNextWeek) {
    await page.locator(".fc-next-button").click();
  }

  const available = page.locator(".fc-event-available").first();
  await expect(available).toBeVisible({ timeout: 15_000 });
  await available.click();

  await page.getByRole("button", { name: /Request booking|Надіслати заявку/ }).click();

  await expect(
    page.getByText(/Booking request sent\.|Заявку на запис надіслано\./),
  ).toBeVisible({ timeout: 15_000 });
});
