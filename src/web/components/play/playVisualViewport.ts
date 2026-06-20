export const PLAY_KEYBOARD_THRESHOLD_PX = 80;
const KEYBOARD_FIELD_PADDING_PX = 12;

export function isPlayKeyboardOpen(viewportHeight: number, windowHeight: number): boolean {
  return viewportHeight < windowHeight - PLAY_KEYBOARD_THRESHOLD_PX;
}

export function getScrollDeltaForField(
  fieldTop: number,
  fieldBottom: number,
  visibleTop: number,
  visibleBottom: number
): number {
  if (fieldBottom > visibleBottom) {
    return fieldBottom - visibleBottom;
  }
  if (fieldTop < visibleTop) {
    return fieldTop - visibleTop;
  }
  return 0;
}

export function syncPlayVisualViewport(app: HTMLElement): boolean {
  const vv = window.visualViewport;
  if (!vv) return false;

  app.style.setProperty("--play-vv-offset-top", `${vv.offsetTop}px`);
  app.style.setProperty("--play-vv-offset-left", `${vv.offsetLeft}px`);
  app.style.setProperty("--play-vv-width", `${vv.width}px`);
  app.style.setProperty("--play-vv-height", `${vv.height}px`);

  const keyboardOpen = isPlayKeyboardOpen(vv.height, window.innerHeight);
  app.classList.toggle("play-keyboard-open", keyboardOpen);
  return keyboardOpen;
}

export function clearPlayVisualViewport(app: HTMLElement) {
  app.classList.remove("play-keyboard-open");
  app.style.removeProperty("--play-vv-offset-top");
  app.style.removeProperty("--play-vv-offset-left");
  app.style.removeProperty("--play-vv-width");
  app.style.removeProperty("--play-vv-height");
}

export function getPlayScrollContainer(field: Element): HTMLElement | null {
  return field.closest(".play-screen");
}

export function scrollFieldAboveKeyboard(field: HTMLElement, scrollContainer?: HTMLElement | null) {
  const vv = window.visualViewport;
  if (!vv) return;

  const container = scrollContainer ?? getPlayScrollContainer(field);
  if (!container) {
    field.scrollIntoView({ block: "nearest" });
    return;
  }

  const visibleTop = vv.offsetTop + KEYBOARD_FIELD_PADDING_PX;
  const visibleBottom = vv.offsetTop + vv.height - KEYBOARD_FIELD_PADDING_PX;
  const fieldRect = field.getBoundingClientRect();
  const delta = getScrollDeltaForField(
    fieldRect.top,
    fieldRect.bottom,
    visibleTop,
    visibleBottom
  );
  if (delta !== 0) {
    container.scrollTop += delta;
  }
}

export function scrollPlayFormIntoView(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return;
  const field = target.closest("input, textarea, select");
  if (!(field instanceof HTMLElement)) return;

  const scroll = () => scrollFieldAboveKeyboard(field);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(scroll);
  });
}

export function resetPlayScreenScroll(app: HTMLElement) {
  app.querySelectorAll<HTMLElement>(".play-screen").forEach((screen) => {
    screen.scrollTop = 0;
  });
}
