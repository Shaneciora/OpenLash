export function clipCircle(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
}

export function paintAvatarBackground(
  ctx: CanvasRenderingContext2D,
  size: number,
  image: CanvasImageSource | null
) {
  ctx.save();
  clipCircle(ctx, size);
  if (image) {
    const width = "width" in image ? image.width : size;
    const height = "height" in image ? image.height : size;
    const scale = Math.max(size / width, size / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    ctx.drawImage(image, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
  }
  ctx.restore();
}

export function clearDrawLayer(ctx: CanvasRenderingContext2D, size: number) {
  ctx.clearRect(0, 0, size, size);
}

export function compositeAvatarCanvases(
  background: HTMLCanvasElement,
  drawing: HTMLCanvasElement,
  size: number
): string | null {
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  ctx.save();
  clipCircle(ctx, size);
  ctx.drawImage(background, 0, 0);
  ctx.drawImage(drawing, 0, 0);
  ctx.restore();

  return out.toDataURL("image/png");
}

export function isInsideCircle(x: number, y: number, size: number) {
  const radius = size / 2;
  const dx = x - radius;
  const dy = y - radius;
  return dx * dx + dy * dy <= radius * radius;
}
