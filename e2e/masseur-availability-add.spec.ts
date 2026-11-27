import { expect, test } from "@playwright/test";
import { selectEmptyCalendarHour } from "./helpers/calendar-select";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

test("masseur can add an availability hour and keep it after save", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("availabilityAdd");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);
  await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });

  await page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/availability?") &&
      res.request().method() === "GET" &&
      res.status() < 500,
  );

  await page
    .getByRole("heading", {
      name: /Weekly availability|Тижнева доступність/i,
    })
    .scrollIntoViewIfNeeded();

  if (fixture.needsNextWeek) {
    await page
      .getByRole("button", { name: /Next week|Наступний тиждень/i })
      .click();
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/masseur/availability?") &&
        res.request().method() === "GET" &&
        res.status() < 500,
    );
  }

  await expect(page.locator(".fc-event-available")).toHaveCount(0, {
    timeout: 20_000,
  });

  await selectEmptyCalendarHour(page, fixture.slotStartIso);

  await expect(page.locator(".fc-event-available")).toHaveCount(1, {
    timeout: 10_000,
  });

  const availabilityPost = page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/availability") &&
      res.request().method() === "POST",
  );

  await page
    .getByRole("button", { name: /Save profile|Зберегти профіль/ })
    .click();

  const post = await availabilityPost;
  expect(
    post.ok(),
    `availability POST ${post.status()}: ${await post.text()}`,
  ).toBeTruthy();

  await expect(
    page.getByText(/Profile saved\.|Профіль збережено\./),
  ).toBeVisible({ timeout: 15_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForResponse(
    (res) =>
      res.url().includes("/api/masseur/availability?") &&
      res.request().method() === "GET" &&
      res.status() < 500,
  );
  if (fixture.needsNextWeek) {
    await page
      .getByRole("button", { name: /Next week|Наступний тиждень/i })
      .click();
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/masseur/availability?") &&
        res.request().method() === "GET" &&
        res.status() < 500,
    );
  }

  await expect(page.locator(".fc-event-available")).toHaveCount(1, {
    timeout: 20_000,
  });
});
