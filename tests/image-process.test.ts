import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  ImageProcessError,
  MAX_IMAGE_LONG_SIDE,
  MAX_UPLOAD_BYTES,
  processUploadImage,
} from "@/lib/image-process";

async function makePng(width: number, height: number, withAlpha = false) {
  const channels = withAlpha ? 4 : 3;
  const background = withAlpha
    ? { r: 20, g: 120, b: 80, alpha: 0.5 }
    : { r: 20, g: 120, b: 80 };
  return sharp({
    create: {
      width,
      height,
      channels,
      background,
    },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("processUploadImage", () => {
  it("accepts JPEG and returns jpeg without upsizing small images", async () => {
    const input = await makeJpeg(80, 40);
    const result = await processUploadImage(input);

    expect(result.contentType).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    expect(result.width).toBe(80);
    expect(result.height).toBe(40);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(80);
    expect(meta.height).toBe(40);
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });

  it("keeps PNG when the source has alpha", async () => {
    const input = await makePng(64, 48, true);
    const result = await processUploadImage(input);

    expect(result.contentType).toBe("image/png");
    expect(result.extension).toBe("png");
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
  });

  it("re-encodes opaque PNG as JPEG", async () => {
    const input = await makePng(32, 32, false);
    const result = await processUploadImage(input);

    expect(result.contentType).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
  });

  it("downscales so the long side is at most 2000px", async () => {
    const input = await makeJpeg(3000, 1500);
    const result = await processUploadImage(input);

    expect(result.width).toBe(MAX_IMAGE_LONG_SIDE);
    expect(result.height).toBe(1000);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(
      MAX_IMAGE_LONG_SIDE,
    );
  });

  it("rejects GIF by real format", async () => {
    const gif = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .gif()
      .toBuffer();

    await expect(processUploadImage(gif)).rejects.toMatchObject({
      name: "ImageProcessError",
      code: "invalid_type",
    } satisfies Partial<ImageProcessError>);
  });

  it("rejects non-image bytes", async () => {
    await expect(
      processUploadImage(Buffer.from("not-an-image")),
    ).rejects.toMatchObject({ code: "invalid_type" });
  });

  it("rejects oversized input", async () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1);
    await expect(processUploadImage(oversized)).rejects.toMatchObject({
      code: "too_large",
    });
  });

  it("strips embedded metadata", async () => {
    const base = await makeJpeg(40, 40);
    const withMeta = await sharp(base)
      .withMetadata({
        exif: {
          IFD0: { ImageDescription: "secret-location" },
        },
      })
      .jpeg()
      .toBuffer();

    const before = await sharp(withMeta).metadata();
    expect(before.exif).toBeDefined();

    const result = await processUploadImage(withMeta);
    const after = await sharp(result.buffer).metadata();
    expect(after.exif).toBeUndefined();
  });
});
