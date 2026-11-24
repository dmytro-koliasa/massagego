import { expect, test } from "@playwright/test";
import {
  mockCityGeocodeKyiv,
  registerClientViaUi,
  uniqueClientCredentials,
} from "./helpers/client-register";

test("new client can register and reach the client shell", async ({ page }) => {
  test.setTimeout(90_000);
  await mockCityGeocodeKyiv(page);

  const creds = uniqueClientCredentials("register");
  await registerClientViaUi(page, creds);

  await expect(page).toHaveURL(/\/client\/?$/);
  await expect(
    page.getByRole("button", { name: /Sign out|Вийти/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Client space|Простір клієнта/i }),
  ).toBeVisible();
});
