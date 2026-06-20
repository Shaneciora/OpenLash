import { useEffect, useRef, useState } from "react";
import {
  applyCameraZoom,
  initCameraZoom,
  pinchZoomValue,
  touchDistance,
  type CameraZoomState,
} from "../../lib/cameraZoom";
import { captureVideoPhoto, startUserCamera, userCameraStartError } from "../../lib/userCamera";

type Props = {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
};

export function AvatarPhotoCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zoomRef = useRef<CameraZoomState>({ mode: "visual", value: 1, min: 1, max: 4 });
  const pinchRef = useRef({ distance: 0, zoom: 1 });
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [visualZoom, setVisualZoom] = useState(1);

  useEffect(() => {
    const abort = new AbortController();
    const video = videoRef.current;
    if (!video) {
      setError("Could not start the camera.");
      return;
    }

    void startUserCamera(
      video,
      abort.signal,
      (stream) => {
        streamRef.current = stream;
        zoomRef.current = initCameraZoom(stream);
        setReady(true);
      }
    ).catch((e) => {
      if (!abort.signal.aborted) {
        setError(userCameraStartError(e));
      }
    });

    return () => {
      abort.abort();
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !ready) return;

    const updateZoom = async (nextValue: number) => {
      const stream = streamRef.current;
      if (!stream) return;

      const nextState = { ...zoomRef.current, value: nextValue };
      const applied = await applyCameraZoom(stream, nextState);
      zoomRef.current = applied;

      if (applied.mode === "visual") {
        setVisualZoom(applied.value);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      pinchRef.current = {
        distance: touchDistance(event.touches),
        zoom: zoomRef.current.value,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      const { distance, zoom } = pinchRef.current;
      if (distance <= 0) return;

      const next = pinchZoomValue(
        distance,
        touchDistance(event.touches),
        zoom,
        zoomRef.current.min,
        zoomRef.current.max
      );
      void updateZoom(next);
    };

    wrap.addEventListener("touchstart", onTouchStart, { passive: false });
    wrap.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      wrap.removeEventListener("touchstart", onTouchStart);
      wrap.removeEventListener("touchmove", onTouchMove);
    };
  }, [ready]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const zoom = zoomRef.current.mode === "visual" ? zoomRef.current.value : 1;
    const photo = captureVideoPhoto(video, zoom);
    if (!photo) return;

    onCaptureRef.current(photo);
  };

  return (
    <div className="qr-scanner-overlay" data-testid="avatar-photo-overlay">
      <div className="qr-scanner-panel card">
        <h2 className="qr-scanner-title">Photo background</h2>
        <p className="qr-scanner-hint">Frame your face. Pinch to zoom, then take a photo.</p>
        <div
          ref={wrapRef}
          className="avatar-photo-video-wrap"
          data-testid="avatar-photo-video-wrap"
        >
          <video
            ref={videoRef}
            className="qr-scanner-video"
            style={
              zoomRef.current.mode === "visual" && visualZoom > 1
                ? { transform: `scale(${visualZoom})` }
                : undefined
            }
            playsInline
            muted
            autoPlay
          />
          {!ready && !error && (
            <p className="qr-scanner-loading" data-testid="avatar-photo-loading">
              Starting camera...
            </p>
          )}
        </div>
        {error && (
          <p className="play-error" data-testid="avatar-photo-error">
            {error}
          </p>
        )}
        <button
          type="button"
          className="primary"
          data-testid="avatar-photo-capture-btn"
          disabled={!ready || !!error}
          onClick={handleCapture}
        >
          Take photo
        </button>
        <button
          type="button"
          className="secondary"
          data-testid="avatar-photo-cancel-btn"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
