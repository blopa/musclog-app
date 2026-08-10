/**
 * Optical transfer — "is this food scanner looking at an optical stream?"
 *
 * The food barcode scanners list `qr` among their code types, so pointing one at a sending phone
 * hands `useBarcodeScanner` a fountain frame and it goes looking for a product with that barcode.
 * The lookup fails, the camera tears down for a "food not found" sheet, and the user is told the
 * wrong thing about a transfer that is working perfectly. This is the cheap check that catches it
 * and lets the UI offer the optical reader instead.
 *
 * Deliberately NOT `OpticalReceiver` from `./receiverSession.ts`: that allocates an `LTDecoder`
 * and accumulates blocks, which is exactly the work we do not want to do on a scanner that is
 * only being asked "should I still treat this as a barcode?". Nothing here reads a frame's
 * payload — only its header — so a stream can never be half-received by a scanner that has no
 * intention of finishing it.
 *
 * TWO FRAMES, NOT ONE, before prompting. A single parse is already near-impossible to hit by
 * accident — the text must decode as base44 (which rules out any lowercase character, so most
 * QR payloads die at the first byte), then carry the 0xD1 0x0C magic, then have a length that
 * matches its own declared `blockLen`. Requiring a second frame with the SAME `streamIdentity`
 * costs about 60 ms at any sane frame rate and turns "essentially impossible" into "impossible",
 * which matters because a false prompt would appear over a camera the user is actively using.
 */

import { base44Decode } from './base44';
import { parseFrame, streamIdentity } from './frameProtocol';

export const OPTICAL_PROBE_MIN_FRAMES = 2;

export type OpticalProbeResult =
  /** Not one of our frames. The caller should treat the code as an ordinary barcode. */
  | 'ignored'
  /** One of ours, but the caller should stay quiet: below the threshold, or already dismissed. */
  | 'frame'
  /** One of ours, and this is the call that crossed the threshold. Fires at most once per stream. */
  | 'detected';

/** The stream a scanned code belongs to, or null when it is not one of our frames at all. */
export function readOpticalStreamIdentity(text: string): null | string {
  const bytes = base44Decode(text);
  if (!bytes) {
    return null;
  }

  const parsed = parseFrame(bytes);
  return parsed ? streamIdentity(parsed.header) : null;
}

export class OpticalFrameProbe {
  private identity: null | string = null;
  private frames = 0;
  private dismissedIdentity: null | string = null;

  /**
   * `'frame'` and `'detected'` both mean "this was one of ours" — the caller must suppress the
   * barcode lookup for both, including the very first frame, which arrives before we are willing
   * to prompt. Letting that one through would open the food-not-found sheet and tear the camera
   * down, so the second frame this needs would never arrive.
   */
  observe(text: string): OpticalProbeResult {
    const identity = readOpticalStreamIdentity(text);
    if (!identity) {
      return 'ignored';
    }

    if (identity !== this.identity) {
      this.identity = identity;
      this.frames = 0;
    }
    this.frames++;

    // A dismissal is per stream, so a sender that restarts on a different payload gets to ask
    // again while merely holding the phone still does not.
    if (identity === this.dismissedIdentity || this.frames !== OPTICAL_PROBE_MIN_FRAMES) {
      return 'frame';
    }

    return 'detected';
  }

  /** The user said no to the current stream. Frames keep being swallowed; the prompt stops. */
  dismiss(): void {
    this.dismissedIdentity = this.identity;
  }

  reset(): void {
    this.identity = null;
    this.frames = 0;
    this.dismissedIdentity = null;
  }
}
