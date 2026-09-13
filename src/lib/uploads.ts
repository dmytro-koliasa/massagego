import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { del, put } from "@vercel/blob";
import { isLocalUploadUrl } from "@/lib/upload-url";

export type UploadFolder = "gallery" | "masseurs" | "clients";

export {
  isLocalUploadUrl,
  shouldSkipImageOptimization,
} from "@/lib/upload-url";

function extensionFor(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

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

export async function storeUpload(options: {
  folder: UploadFolder;
  ownerId: string;
  file: File;
}): Promise<string> {
  const { folder, ownerId, file } = options;
  const extension = extensionFor(file.type);
  const filename = `${ownerId}-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (usesBlobStorage()) {
    const blob = await put(`${folder}/${filename}`, buffer, {
      access: "public",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const dir = localUploadDir(folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
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
