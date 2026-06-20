import { cameraErrorMessage } from "./camera";

function releaseStream(video: HTMLVideoElement) {
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
  video.srcObject = null;
  video.load();
}

export function drawVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  visualZoom: number
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  canvas.width = vw;
  canvas.height = vh;

  if (visualZoom <= 1) {
    ctx.drawImage(video, 0, 0);
    return;
  }

  const cropW = vw / visualZoom;
  const cropH = vh / visualZoom;
  const sx = (vw - cropW) / 2;
  const sy = (vh - cropH) / 2;
  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, vw, vh);
}

export function captureVideoPhoto(video: HTMLVideoElement, visualZoom = 1): string | null {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  drawVideoFrame(video, canvas, ctx, visualZoom);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function startUserCamera(
  video: HTMLVideoElement,
  signal: AbortSignal,
  onReady?: (stream: MediaStream) => void
): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "user" } },
  });

  const cleanup = () => releaseStream(video);
  signal.addEventListener("abort", cleanup, { once: true });

  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;

  try {
    await video.play();
  } catch {
    /* Safari may already be playing */
  }

  onReady?.(stream);

  await new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

export function userCameraStartError(error: unknown): string {
  return cameraErrorMessage(error, "avatar");
}
