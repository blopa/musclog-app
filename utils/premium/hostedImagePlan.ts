/**
 * Pure sizing rules for photos sent to the hosted AI Worker. No React Native imports:
 * `utils/hostedImage.ts` does the native work, these functions decide what it does.
 */

// The Worker rejects a request body above 512 KB before any D1 work (plan section 4).
export const HOSTED_REQUEST_BODY_CAP_BYTES = 512 * 1024;

// The prompt, system text and JSON schema share the body with the image.
export const HOSTED_BODY_OVERHEAD_BYTES = 24 * 1024;

export const DEFAULT_HOSTED_IMAGE = { maxPx: 1024, maxBytes: 300 * 1024, quality: 0.7 } as const;

const MIN_QUALITY = 0.3;
const MAX_QUALITY = 0.95;
const MIN_PX = 256;
const MAX_PX = 4096;
const QUALITY_STEP = 0.1;

// The image travels as base64, which inflates it by 4/3, so the decoded image may be at
// most this many bytes for the whole body to fit under the cap.
const HOSTED_DECODED_BYTES_LIMIT = Math.floor(
  ((HOSTED_REQUEST_BODY_CAP_BYTES - HOSTED_BODY_OVERHEAD_BYTES) * 3) / 4
);

export type HostedImageLimits = { maxPx: number; maxBytes: number; quality: number };

export type ImageDimensions = { width: number; height: number; bytes: number };

export type ResizePlan = { targetWidth: number; targetHeight: number; needsWork: boolean };

export function base64DecodedBytes(base64: string): number {
  let padding = 0;

  if (base64.endsWith('==')) {
    padding = 2;
  } else if (base64.endsWith('=')) {
    padding = 1;
  }

  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function effectiveImageLimits(
  config: { maxPx: number; maxBytes: number; quality: number } | null
): HostedImageLimits {
  const source = config ?? DEFAULT_HOSTED_IMAGE;

  return {
    maxPx: Math.round(clamp(finiteOr(source.maxPx, DEFAULT_HOSTED_IMAGE.maxPx), MIN_PX, MAX_PX)),
    maxBytes: Math.min(
      finiteOr(source.maxBytes, DEFAULT_HOSTED_IMAGE.maxBytes),
      HOSTED_DECODED_BYTES_LIMIT
    ),
    quality: clamp(
      finiteOr(source.quality, DEFAULT_HOSTED_IMAGE.quality),
      MIN_QUALITY,
      MAX_QUALITY
    ),
  };
}

export function planResize(input: ImageDimensions, limits: HostedImageLimits): ResizePlan {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(input.height));
  const longest = Math.max(width, height);
  // Never upscale: a scale above 1 is clamped to 1.
  const scale = Math.min(1, limits.maxPx / longest);

  return {
    targetWidth: Math.max(1, Math.round(width * scale)),
    targetHeight: Math.max(1, Math.round(height * scale)),
    needsWork: longest > limits.maxPx || input.bytes > limits.maxBytes,
  };
}

export function nextQuality(quality: number): number | null {
  if (quality <= MIN_QUALITY) {
    return null;
  }

  const stepped = Math.round((quality - QUALITY_STEP) * 10) / 10;

  return Math.max(MIN_QUALITY, stepped);
}
