import { describe, it, expect } from "vitest";
import { captureVideoPhoto } from "../../src/web/lib/userCamera";
import { cameraErrorMessage } from "../../src/web/lib/camera";

describe("userCamera", () => {
  it("returns null when the video has no frame yet", () => {
    const video = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
    expect(captureVideoPhoto(video)).toBeNull();
  });

  it("uses avatar-specific camera errors", () => {
    expect(cameraErrorMessage(new DOMException("denied", "NotAllowedError"), "avatar")).toContain(
      "take a photo"
    );
  });
});
