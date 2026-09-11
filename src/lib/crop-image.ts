export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = src;
  });
}

export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: CropArea,
  mimeType = "image/jpeg",
  quality = 0.92,
) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round(pixelCrop.width));
  const height = Math.max(1, Math.round(pixelCrop.height));
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas_unavailable");
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mimeType, quality);
  });

  if (!blob) {
    throw new Error("blob_failed");
  }

  return { blob, width, height };
}
