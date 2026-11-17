import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_LONG_SIDE = 2000;
export const JPEG_QUALITY = 85;

export type ImageProcessErrorCode =
  | "invalid_type"
  | "too_large"
  | "process_failed";

export class ImageProcessError extends Error {
  readonly code: ImageProcessErrorCode;

  constructor(code: ImageProcessErrorCode) {
    super(code);
    this.name = "ImageProcessError";
    this.code = code;
  }
}

export type ProcessedUploadImage = {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  extension: "jpg" | "png";
};

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export function assertUploadSize(byteLength: number) {
  if (byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageProcessError("too_large");
  }
}

/**
 * Validate real image content, normalize orientation, strip metadata,
 * optionally downscale, and re-encode for safe storage.
 */
export async function processUploadImage(
  input: Buffer,
): Promise<ProcessedUploadImage> {
  assertUploadSize(input.byteLength);

  let metadata;
  try {
    metadata = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new ImageProcessError("invalid_type");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new ImageProcessError("invalid_type");
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageProcessError("invalid_type");
  }

  const keepPng = metadata.format === "png" && Boolean(metadata.hasAlpha);

  try {
    // rotate() applies EXIF orientation; omitting withMetadata() strips GPS/EXIF.
    let pipeline = sharp(input, { failOn: "error" }).rotate().resize({
      width: MAX_IMAGE_LONG_SIDE,
      height: MAX_IMAGE_LONG_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    });

    pipeline = keepPng
      ? pipeline.png()
      : pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) {
      throw new ImageProcessError("process_failed");
    }

    return {
      buffer: data,
      contentType: keepPng ? "image/png" : "image/jpeg",
      width: info.width,
      height: info.height,
      extension: keepPng ? "png" : "jpg",
    };
  } catch (error) {
    if (error instanceof ImageProcessError) throw error;
    throw new ImageProcessError("process_failed");
  }
}
