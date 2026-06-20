export function canUseCamera(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

type CameraErrorContext = "qr" | "avatar";

export function cameraErrorMessage(
  error: unknown,
  context: CameraErrorContext = "qr"
): string {
  const fallback =
    context === "avatar"
      ? "Could not open the camera."
      : "Could not open the camera. Enter the room code manually.";

  if (!(error instanceof DOMException)) {
    return fallback;
  }

  switch (error.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return context === "avatar"
        ? "Camera access was denied. Allow camera permission to take a photo."
        : "Camera access was denied. Allow camera permission to scan the QR code on the TV.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Could not access the camera. It may be in use by another app.";
    case "SecurityError":
      return context === "avatar"
        ? "Camera access needs HTTPS."
        : "Camera scanning needs HTTPS. Enter the code manually, or scan the QR with your phone's camera app.";
    default:
      return fallback;
  }
}
