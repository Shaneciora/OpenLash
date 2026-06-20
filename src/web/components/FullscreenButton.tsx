import { useFullscreen } from "../hooks/useFullscreen";

interface Props {
  variant?: "light" | "dark";
}

export function FullscreenButton({ variant = "light" }: Props) {
  const { isFullscreen, toggle, supported } = useFullscreen();

  if (!supported) return null;

  return (
    <button
      type="button"
      className={`fullscreen-btn fullscreen-btn--${variant}`}
      data-testid="fullscreen-btn"
      onClick={() => void toggle()}
      aria-pressed={isFullscreen}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
    </button>
  );
}
