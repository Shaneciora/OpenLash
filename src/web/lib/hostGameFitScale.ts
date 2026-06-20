import { clampHostScale, HOST_SCALE_DEFAULT, HOST_SCALE_MAX, HOST_SCALE_MIN } from "./hostScale";

export function measureHostGameFitScale(
  outerW: number,
  outerH: number,
  baseW: number,
  baseH: number,
  userScale: number
): number {
  if (outerW <= 0 || outerH <= 0 || baseW <= 0 || baseH <= 0) {
    return clampHostScale(userScale);
  }
  return clampHostScale(Math.min(userScale, outerW / baseW, outerH / baseH));
}

export function measureInverseFillScale(
  outerW: number,
  outerH: number,
  contentW: number,
  contentH: number,
  userScale: number
): number {
  if (outerW <= 0 || outerH <= 0) {
    return clampHostScale(userScale);
  }

  const logicalW = outerW / userScale;
  const logicalH = outerH / userScale;

  if (contentW <= logicalW + 1 && contentH <= logicalH + 1) {
    return clampHostScale(userScale);
  }

  let effective = userScale;
  if (contentH > 0) {
    effective = Math.min(effective, outerH / contentH);
  }
  if (contentW > logicalW) {
    effective = Math.min(effective, outerW / contentW);
  }

  return clampHostScale(effective);
}

export { HOST_SCALE_DEFAULT, HOST_SCALE_MAX, HOST_SCALE_MIN };
