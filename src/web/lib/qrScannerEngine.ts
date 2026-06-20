import jsQR from "jsqr";
import { cameraErrorMessage } from "./camera";

type DetectHandler = (text: string) => void;

function drawVideoFrame(
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

function waitFrame(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const id = requestAnimationFrame(() => resolve());
    signal.addEventListener(
      "abort",
      () => {
        cancelAnimationFrame(id);
        resolve();
      },
      { once: true }
    );
  });
}

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

async function scanWithBarcodeDetector(
  video: HTMLVideoElement,
  onDetection: DetectHandler,
  signal: AbortSignal,
  getVisualZoom: () => number
) {
  const Detector = globalThis.BarcodeDetector;
  if (!Detector) return false;

  const detector = new Detector({ formats: ["qr_code"] });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  while (!signal.aborted) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      drawVideoFrame(video, canvas, ctx, getVisualZoom());
      try {
        const codes = await detector.detect(canvas);
        for (const code of codes) {
          if (signal.aborted) return true;
          onDetection(code.rawValue);
        }
      } catch {
        /* keep scanning */
      }
    }
    await waitFrame(signal);
  }

  return true;
}

async function scanWithJsQr(
  video: HTMLVideoElement,
  onDetection: DetectHandler,
  signal: AbortSignal,
  getVisualZoom: () => number
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported on this device.");
  }

  while (!signal.aborted) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      drawVideoFrame(video, canvas, ctx, getVisualZoom());
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (result?.data) {
        onDetection(result.data);
      }
    }
    await waitFrame(signal);
  }
}

export async function runRoomCodeQrScanner(
  video: HTMLVideoElement,
  onDetection: DetectHandler,
  signal: AbortSignal,
  onReady?: (stream: MediaStream) => void,
  getVisualZoom: () => number = () => 1
): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
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

  const usedNative = await scanWithBarcodeDetector(video, onDetection, signal, getVisualZoom);
  if (!usedNative && !signal.aborted) {
    await scanWithJsQr(video, onDetection, signal, getVisualZoom);
  }
}

export function qrScannerStartError(error: unknown): string {
  return cameraErrorMessage(error);
}
