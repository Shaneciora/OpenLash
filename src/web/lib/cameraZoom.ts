export type CameraZoomMode = "hardware" | "visual";

export type CameraZoomState = {
  mode: CameraZoomMode;
  value: number;
  min: number;
  max: number;
};

export function initCameraZoom(stream: MediaStream): CameraZoomState {
  const track = stream.getVideoTracks()[0];
  const caps = track?.getCapabilities?.() as MediaTrackCapabilities & {
    zoom?: { min: number; max: number; step?: number };
  };

  if (caps?.zoom) {
    const settings = track?.getSettings?.() as MediaTrackSettings & { zoom?: number };
    return {
      mode: "hardware",
      value: settings?.zoom ?? caps.zoom.min,
      min: caps.zoom.min,
      max: caps.zoom.max,
    };
  }

  return {
    mode: "visual",
    value: 1,
    min: 1,
    max: 4,
  };
}

export function clampZoom(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function applyCameraZoom(
  stream: MediaStream,
  state: CameraZoomState
): Promise<CameraZoomState> {
  const next = clampZoom(state.value, state.min, state.max);

  if (state.mode === "hardware") {
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({ zoom: next } as MediaTrackConstraints);
      } catch {
        try {
          await track.applyConstraints({ advanced: [{ zoom: next }] });
        } catch {
          return { ...state, mode: "visual", value: next, min: 1, max: 4 };
        }
      }
    }
    return { ...state, value: next };
  }

  return { ...state, value: next };
}

export function touchDistance(touches: TouchList | [Touch, Touch]): number {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function pinchZoomValue(
  startDistance: number,
  currentDistance: number,
  startZoom: number,
  min: number,
  max: number
): number {
  if (startDistance <= 0) return startZoom;
  return clampZoom(startZoom * (currentDistance / startDistance), min, max);
}
