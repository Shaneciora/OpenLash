import { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from "react";
import {
  clearDrawLayer,
  compositeAvatarCanvases,
  isInsideCircle,
  paintAvatarBackground,
} from "../../lib/avatarCanvas";
import { canUseCamera } from "../../lib/camera";
import { AvatarPhotoCapture } from "./AvatarPhotoCapture";

interface Props {
  onSave: (dataUrl: string) => void;
}

export interface AvatarDrawHandle {
  save: () => void;
}

const COLORS = ["#000000", "#ff6b4a", "#2ec4b6", "#ffd166", "#9b5de5"];

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load photo"));
    image.src = dataUrl;
  });
}

export const AvatarDraw = forwardRef<AvatarDrawHandle, Props>(function AvatarDraw({ onSave }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [thickness, setThickness] = useState(4);
  const [drawing, setDrawing] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const showPhotoButton = canUseCamera();

  const paintBackground = useCallback(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    paintAvatarBackground(ctx, size, backgroundImageRef.current);
  }, []);

  const resizeCanvases = useCallback(() => {
    const wrap = wrapRef.current;
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!wrap || !bgCanvas || !drawCanvas) return;

    const size = Math.floor(Math.min(wrap.clientWidth, 320));
    if (size <= 0) return;

    if (bgCanvas.width === size && bgCanvas.height === size) return;

    bgCanvas.width = size;
    bgCanvas.height = size;
    drawCanvas.width = size;
    drawCanvas.height = size;
    paintBackground();
    clearDrawLayer(drawCanvas.getContext("2d")!, size);
  }, [paintBackground]);

  useEffect(() => {
    resizeCanvases();
    window.addEventListener("resize", resizeCanvases);
    return () => window.removeEventListener("resize", resizeCanvases);
  }, [resizeCanvases]);

  const getDrawCtx = () => drawCanvasRef.current?.getContext("2d");

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    setDrawing(true);
    const ctx = getDrawCtx();
    const canvas = drawCanvasRef.current;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ("touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left) * scaleX;
    const y = ("touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top) * scaleY;
    if (!isInsideCircle(x, y, canvas.width)) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const ctx = getDrawCtx();
    const canvas = drawCanvasRef.current;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ("touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left) * scaleX;
    const y = ("touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top) * scaleY;
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => setDrawing(false);

  const clear = () => {
    const canvas = drawCanvasRef.current;
    const ctx = getDrawCtx();
    if (!ctx || !canvas) return;
    clearDrawLayer(ctx, canvas.width);
  };

  const save = () => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!bgCanvas || !drawCanvas || drawCanvas.width <= 0) return;
    const dataUrl = compositeAvatarCanvases(bgCanvas, drawCanvas, drawCanvas.width);
    if (dataUrl) onSave(dataUrl);
  };

  const handlePhotoCapture = async (dataUrl: string) => {
    setShowPhotoCapture(false);
    try {
      const image = await loadImage(dataUrl);
      backgroundImageRef.current = image;
      paintBackground();
      clear();
    } catch {
      backgroundImageRef.current = null;
    }
  };

  useImperativeHandle(ref, () => ({ save }), [onSave]);

  return (
    <div className="avatar-draw" data-testid="avatar-draw">
      <div className="avatar-canvas-wrap" ref={wrapRef}>
        <canvas ref={bgCanvasRef} className="avatar-canvas avatar-canvas--bg" aria-hidden="true" />
        <canvas
          ref={drawCanvasRef}
          className="avatar-canvas avatar-canvas--draw"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="avatar-tools">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`avatar-swatch${color === c ? " avatar-swatch--selected" : ""}`}
            aria-label={`Color ${c}`}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            style={{ background: c }}
          />
        ))}
        {showPhotoButton && (
          <button
            type="button"
            data-testid="avatar-photo-bg-btn"
            onClick={() => setShowPhotoCapture(true)}
          >
            Photo background
          </button>
        )}
        <button type="button" onClick={clear}>
          Clear
        </button>
      </div>
      <label className="avatar-thickness">
        <span className="avatar-thickness-label">Pen</span>
        <input
          type="range"
          className="avatar-thickness-slider"
          min={1}
          max={16}
          step={1}
          value={thickness}
          data-testid="avatar-thickness-slider"
          aria-label="Pen thickness"
          onChange={(e) => setThickness(Number(e.target.value))}
        />
      </label>
      {showPhotoCapture && (
        <AvatarPhotoCapture
          onCapture={(dataUrl) => void handlePhotoCapture(dataUrl)}
          onClose={() => setShowPhotoCapture(false)}
        />
      )}
    </div>
  );
});
