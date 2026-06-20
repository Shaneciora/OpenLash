import { useEffect } from "react";
import { hostSounds, isE2eMode } from "../lib/sounds";

export function useButtonPressSound(): void {
  useEffect(() => {
    if (isE2eMode()) return;

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button || button.disabled) return;
      hostSounds.playButtonPress();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}
