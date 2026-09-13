/** Client-safe helpers for uploaded image URLs (no Node/Blob SDK imports). */

export function isLocalUploadUrl(url: string | null | undefined) {
  return Boolean(url?.startsWith("/uploads/"));
}

/** Local disk uploads skip Next optimizer; Blob/CDN/Google use remotePatterns. */
export function shouldSkipImageOptimization(url: string | null | undefined) {
  return isLocalUploadUrl(url);
}
