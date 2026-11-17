import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { del, put } from "@vercel/blob";
import {
  assertUploadSize,
  processUploadImage,
  type ProcessedUploadImage,
} from "@/lib/image-process";
import { isLocalUploadUrl } from "@/lib/upload-url";

export type UploadFolder = "gallery" | "masseurs" | "clients";

export type StoredUpload = {
  url: string;
  width: number;
  height: number;
};

export {
  isLocalUploadUrl,
  shouldSkipImageOptimization,
} from "@/lib/upload-url";

function usesBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function localUploadDir(folder: UploadFolder) {
  return path.join(process.cwd(), "public", "uploads", folder);
}

export function isBlobUploadUrl(url: string | null | undefined) {
  return Boolean(
    url &&
      (url.includes(".public.blob.vercel-storage.com") ||
        url.includes(".blob.vercel-storage.com")),
  );
}

async function writeProcessedUpload(options: {
  folder: UploadFolder;
  ownerId: string;
  processed: ProcessedUploadImage;
}): Promise<string> {
  const { folder, ownerId, processed } = options;
  const filename = `${ownerId}-${Date.now()}.${processed.extension}`;

  if (usesBlobStorage()) {
    const blob = await put(`${folder}/${filename}`, processed.buffer, {
      access: "public",
      contentType: processed.contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const dir = localUploadDir(folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), processed.buffer);
  return `/uploads/${folder}/${filename}`;
}

export async function storeUpload(options: {
  folder: UploadFolder;
  ownerId: string;
  file: File;
}): Promise<StoredUpload> {
  const { folder, ownerId, file } = options;
  assertUploadSize(file.size);

  const raw = Buffer.from(await file.arrayBuffer());
  const processed = await processUploadImage(raw);
  const url = await writeProcessedUpload({ folder, ownerId, processed });

  return {
    url,
    width: processed.width,
    height: processed.height,
  };
}

export async function deleteUpload(url: string | null | undefined) {
  if (!url) return;

  if (isBlobUploadUrl(url)) {
    if (!usesBlobStorage()) return;
    try {
      await del(url);
    } catch {
      // Object may already be gone.
    }
    return;
  }

  if (!isLocalUploadUrl(url)) return;

  const relative = url.replace(/^\//, "");
  if (!relative.startsWith("uploads/")) return;

  try {
    await unlink(path.join(process.cwd(), "public", relative));
  } catch {
    // File may already be gone.
  }
}
