import { expect, type Page } from "@playwright/test";
import { clearAuthRateLimits } from "./clear-auth-rate-limits";

export type RegisteredClient = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

/** Unique phone/email for a single Playwright run (UA mobile shape). */
export function uniqueClientCredentials(
  label = "register",
): RegisteredClient {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 900) + 100}`;
  const seven = stamp.slice(-7).padStart(7, "0");
  return {
    name: `E2E ${label} Client`,
    phone: `+38050${seven}`,
    email: `e2e-${label}-${stamp}@test.local`,
    password: "E2eClient123!",
  };
}

/** Stub Nominatim so register E2E does not depend on live geocode. */
export async function mockCityGeocodeKyiv(page: Page) {
  await page.route("**/api/geocode/city*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "e2e-kyiv",
            placeId: "e2e-place-kyiv",
            countryCode: "UA",
            label: "Kyiv",
            detail: "Ukraine",
            nameEn: "Kyiv",
            nameUk: "Київ",
            lat: 50.45,
            lon: 30.5233,
            timeZone: "Europe/Kyiv",
          },
        ],
      }),
    });
  });
}

async function pickKyivCity(page: Page) {
  const root = page.getByTestId("city-autocomplete");
  const cityInput = root.getByTestId("city-search-input");
  const search = root.getByTestId("city-search-button");

  // SSR markup is clickable before React handlers attach — wait for hydration.
  await expect(root).toHaveAttribute("data-hydrated", "true", {
    timeout: 15_000,
  });
  await expect(cityInput).toBeVisible();
  await expect(search).toBeEnabled();

  // fill() dispatches input events so React onChange stays in sync.
  await cityInput.fill("Kyiv");
  await expect(cityInput).toHaveValue("Kyiv");

  const geocodeResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/geocode/city") &&
      res.request().method() === "GET",
    { timeout: 15_000 },
  );
  await search.click();
  const response = await geocodeResponse;
  expect(response.ok(), `geocode ${response.status()}`).toBeTruthy();

  const option = page
    .locator('[role="listbox"] button')
    .filter({ hasText: "Kyiv" })
    .first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  await expect(cityInput).toHaveValue("Kyiv");
}

/**
 * Fill client register tab, submit, land authenticated on `/client`.
 * Caller should `mockCityGeocodeKyiv` before or this will call live Nominatim.
 */
export async function registerClientViaUi(
  page: Page,
  creds: RegisteredClient = uniqueClientCredentials(),
): Promise<RegisteredClient> {
  await clearAuthRateLimits();
  await page.goto("/client/login", { waitUntil: "domcontentloaded" });

  const registerTab = page.getByRole("tab", {
    name: /Register new user|Зареєструвати нового користувача/i,
  });
  await expect(registerTab).toBeVisible();
  if ((await registerTab.getAttribute("aria-selected")) !== "true") {
    await registerTab.click();
  }

  // Wait for client JS before filling — next-dev compile/HMR can remount the
  // form and wipe controlled fields if we type during the first paint.
  const cityRoot = page.getByTestId("city-autocomplete");
  await expect(cityRoot).toHaveAttribute("data-hydrated", "true", {
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);

  await page.locator("#name").fill(creds.name);
  await expect(page.locator("#name")).toHaveValue(creds.name);

  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.fill("");
  await phoneInput.fill(creds.phone);
  await expect
    .poll(async () => (await phoneInput.inputValue()).replace(/\s/g, ""))
    .toBe(creds.phone);

  await page.locator("#client-email").fill(creds.email);
  await expect(page.locator("#client-email")).toHaveValue(creds.email);

  await pickKyivCity(page);

  await page.locator("#password").fill(creds.password);
  await page.locator("#passwordConfirm").fill(creds.password);

  // Re-assert controlled fields survived city search (HMR / remount guard).
  await expect(page.locator("#name")).toHaveValue(creds.name);
  await expect(page.locator("#client-email")).toHaveValue(creds.email);
  await expect
    .poll(async () => (await phoneInput.inputValue()).replace(/\s/g, ""))
    .toBe(creds.phone);

  const registerResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/register") &&
      res.request().method() === "POST",
    { timeout: 30_000 },
  );

  await page
    .getByRole("button", { name: /Create account|Створити акаунт/i })
    .click();

  const response = await registerResponse;
  expect(
    response.ok(),
    `register POST ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  // SiteHeader hides Sign out on portal login routes; wait for auth redirect
  // off /client/login before asserting session chrome. Avoid a racing
  // page.goto while router.push("/client") is still settling (ERR_ABORTED).
  await expect(page).toHaveURL(/\/client(?!\/login)/, { timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/client\/?$/, { timeout: 15_000 });

  return creds;
}
