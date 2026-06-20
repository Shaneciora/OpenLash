import { useEffect, useRef, useState } from "react";
import { parseRoomCodeFromJoinQr } from "../../../shared/parseJoinQr";
import {
  applyCameraZoom,
  initCameraZoom,
  pinchZoomValue,
  touchDistance,
  type CameraZoomState,
} from "../../lib/cameraZoom";
import { qrScannerStartError, runRoomCodeQrScanner } from "../../lib/qrScannerEngine";

type Props = {
  onCode: (code: string) => void;
  onClose: () => void;
};

export function RoomCodeQrScanner({ onCode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zoomRef = useRef<CameraZoomState>({ mode: "visual", value: 1, min: 1, max: 4 });
  const pinchRef = useRef({ distance: 0, zoom: 1 });
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [visualZoom, setVisualZoom] = useState(1);

  useEffect(() => {
    const abort = new AbortController();
    let handled = false;
    let lastInvalid: string | null = null;

    const finishWithCode = (roomCode: string) => {
      if (handled) return;
      handled = true;
      abort.abort();
      window.setTimeout(() => onCodeRef.current(roomCode), 0);
    };

    const video = videoRef.current;
    if (!video) {
      setError("Could not start the camera. Enter the room code manually.");
      return;
    }

    void runRoomCodeQrScanner(
      video,
      (text) => {
        if (handled || abort.signal.aborted) return;

        const roomCode = parseRoomCodeFromJoinQr(text);
        if (roomCode) {
          finishWithCode(roomCode);
          return;
        }

        if (text !== lastInvalid) {
          lastInvalid = text;
          setScanError("That doesn't look like an OpenLash room code");
        }
      },
      abort.signal,
      (stream) => {
        streamRef.current = stream;
        zoomRef.current = initCameraZoom(stream);
        setReady(true);
      },
      () => (zoomRef.current.mode === "visual" ? zoomRef.current.value : 1)
    ).catch((e) => {
      if (!abort.signal.aborted) {
        setError(qrScannerStartError(e));
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

  return (
    <div className="qr-scanner-overlay" data-testid="qr-scanner-overlay">
      <div className="qr-scanner-panel card">
        <h2 className="qr-scanner-title">Scan QR Code</h2>
        <p className="qr-scanner-hint">Point your camera at the QR code on the TV. Pinch to zoom.</p>
        <div ref={wrapRef} className="qr-scanner-video-wrap" data-testid="qr-scanner-video-wrap">
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
            <p className="qr-scanner-loading" data-testid="qr-scanner-loading">
              Starting camera...
            </p>
          )}
        </div>
        {error && (
          <p className="play-error" data-testid="qr-scanner-error">
            {error}
          </p>
        )}
        {scanError && !error && (
          <p className="play-error" data-testid="qr-scan-invalid">
            {scanError}
          </p>
        )}
        <button
          type="button"
          className="secondary"
          data-testid="qr-scanner-close-btn"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
