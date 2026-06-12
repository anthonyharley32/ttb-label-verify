// 1280px keeps label text crisp for the vision model while minimizing image
// tokens — fewer input tokens means faster extraction (hard < 5s requirement).
const MAX_DIMENSION = 1280;

export interface PreparedImage {
  base64: string;
  mediaType: string;
  previewUrl: string;
}

/**
 * Downscale large photos client-side before upload. Keeps the request payload
 * small (well under serverless body limits) and speeds up AI processing —
 * label text is still perfectly readable at 1600px.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 2 * 1024 * 1024) {
    // Small enough — send as-is
    const [, mediaType, base64] = dataUrl.match(/^data:(.+?);base64,(.*)$/) || [];
    if (base64 && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType)) {
      return { base64, mediaType, previewUrl: dataUrl };
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image in this browser.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const jpegUrl = canvas.toDataURL("image/jpeg", 0.88);
  const base64 = jpegUrl.split(",")[1];
  return { base64, mediaType: "image/jpeg", previewUrl: jpegUrl };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file does not appear to be a valid image."));
    img.src = src;
  });
}
