import path from "node:path";
import { expect, test } from "@playwright/test";
import { ensureBookingFixture } from "./helpers/ensure-booking-fixture";
import { signInAsMasseur } from "./helpers/masseur-auth";

const SAMPLE_PNG = path.join(__dirname, "fixtures", "gallery-sample.png");

test("masseur can upload, see, and delete a gallery photo", async ({ page }) => {
  test.setTimeout(90_000);
  const fixture = await ensureBookingFixture("gallery");

  await signInAsMasseur(page, fixture.masseurEmail, fixture.masseurPassword);
  await page.goto("/masseur/dashboard", { waitUntil: "domcontentloaded" });

  const gallery = page.locator("section").filter({
    has: page.getByRole("heading", { name: /Gallery|Галерея/i }),
  });
  await expect(
    gallery.getByRole("button", {
      name: /Add photo to gallery|Додати фото в галерею/i,
    }),
  ).toBeVisible({ timeout: 20_000 });

  await gallery
    .getByRole("button", {
      name: /Add photo to gallery|Додати фото в галерею/i,
    })
    .click();

  const cropDialog = page.getByRole("dialog");
  await expect(cropDialog).toBeVisible();
  await expect(
    cropDialog.getByRole("heading", {
      name: /Add gallery photo|Додати фото в галерею/i,
    }),
  ).toBeVisible();

  await cropDialog.locator('input[type="file"]').setInputFiles(SAMPLE_PNG);

  const savePhoto = cropDialog.getByRole("button", {
    name: /Save photo|Зберегти фото/i,
  });
  await expect(savePhoto).toBeEnabled({ timeout: 15_000 });
  await savePhoto.click();

  await expect(
    page.getByText(/Photo added to gallery\.|Фото додано до галереї\./),
  ).toBeVisible({ timeout: 20_000 });
  await expect(cropDialog).toBeHidden({ timeout: 10_000 });

  const photo = gallery.getByRole("button", {
    name: /^Photo 1$|^Фото 1$/i,
  });
  await expect(photo).toBeVisible({ timeout: 15_000 });
  await expect(gallery.locator("img").first()).toBeVisible();

  await gallery.getByRole("button", { name: /^Delete$|^Видалити$/i }).click();

  const confirmDialog = page.getByRole("dialog");
  await expect(
    confirmDialog.getByText(
      /Delete this photo from the gallery\?|Видалити це фото з галереї\?/i,
    ),
  ).toBeVisible();
  await confirmDialog
    .getByRole("button", { name: /Delete photo|Видалити фото/i })
    .click();

  await expect(
    page.getByText(/Photo removed from gallery\.|Фото видалено з галереї\./),
  ).toBeVisible({ timeout: 15_000 });
  await expect(gallery.locator("img")).toHaveCount(0, { timeout: 10_000 });
});
