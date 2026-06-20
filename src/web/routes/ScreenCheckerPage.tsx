import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HostViewport } from "../components/screenChecker/HostViewport";
import { HostGameScale } from "../components/screenChecker/HostGameScale";
import { HostScreenSample } from "../components/screenChecker/HostScreenSample";
import {
  clampHostScale,
  getHostScale,
  HOST_SCALE_MAX,
  HOST_SCALE_MIN,
  setHostScale,
} from "../lib/hostScale";

const SCALE_STEP = 0.05;

export function ScreenCheckerPage() {
  const [scale, setScalePreview] = useState(() => getHostScale());
  const [savedScale, setSavedScale] = useState(() => getHostScale());
  const [justSaved, setJustSaved] = useState(false);

  const scalePercent = Math.round(scale * 100);

  useEffect(() => {
    document.body.classList.add("screen-checker-active");
    return () => document.body.classList.remove("screen-checker-active");
  }, []);

  const handleScaleChange = (value: number) => {
    setScalePreview(clampHostScale(value));
    setJustSaved(false);
  };

  const handleSave = () => {
    const next = setHostScale(scale);
    setSavedScale(next);
    setScalePreview(next);
    setJustSaved(true);
  };

  const isDirty = scale !== savedScale;

  return (
    <div className="screen-checker-page" data-testid="screen-checker-page">
      <HostViewport layout="game" className="screen-checker-viewport">
        <HostGameScale scale={scale}>
          <HostScreenSample />
        </HostGameScale>
      </HostViewport>

      <Link to="/" className="back-link" data-testid="screen-checker-back">
        Back
      </Link>

      <div className="screen-checker-overlay" data-testid="screen-checker-overlay">
        <div className="screen-checker-controls">
          <button
            type="button"
            className="screen-checker-zoom-btn"
            data-testid="scale-down-btn"
            aria-label="Zoom out"
            onClick={() => handleScaleChange(scale - SCALE_STEP)}
          >
            −
          </button>
          <input
            type="range"
            className="screen-checker-slider"
            min={HOST_SCALE_MIN * 100}
            max={HOST_SCALE_MAX * 100}
            step={5}
            value={scalePercent}
            data-testid="scale-slider"
            aria-label="Display scale"
            onChange={(e) => handleScaleChange(Number(e.target.value) / 100)}
          />
          <button
            type="button"
            className="screen-checker-zoom-btn"
            data-testid="scale-up-btn"
            aria-label="Zoom in"
            onClick={() => handleScaleChange(scale + SCALE_STEP)}
          >
            +
          </button>
          <span className="screen-checker-percent" data-testid="scale-percent">
            {scalePercent}%
          </span>
          <button
            type="button"
            className="primary screen-checker-save-btn"
            data-testid="scale-save-btn"
            onClick={handleSave}
          >
            {justSaved && !isDirty ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
