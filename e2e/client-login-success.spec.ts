import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers/client-auth";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";

test("client credentials sign in to /client", async ({ page }) => {
  test.setTimeout(60_000);
  const fixture = await ensureBookingFixture("book");

  await signInAsClient(page, fixture.clientPhone, fixture.clientPassword);

  await expect(page).toHaveURL(/\/client\/?$/);
  await expect(
    page.getByRole("heading", { name: /My sessions|Мої сеанси/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toBeVisible();
});
