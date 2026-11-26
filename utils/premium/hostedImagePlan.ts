/**
 * Pure sizing rules for photos sent to the hosted AI Worker. No React Native imports:
 * `utils/hostedImage.ts` does the native work, these functions decide what it does.
 */
import { type ImageLimits, MIN_IMAGE_QUALITY } from '@/utils/aiImagePlan';

// The Worker rejects a request body above 512 KB before any D1 work (plan section 4).
export const HOSTED_REQUEST_BODY_CAP_BYTES = 512 * 1024;

// Everything in the body that is not a photo: the system prompt (with the full foundation food list),
// the schema and the user text. `utils/premium/__tests__/hostedBodyOverhead.test.ts` measures the
// largest such request (five photos, the longest meal context and first look: about 30 KB) and
// keeps this above it plus `HOSTED_CUSTOM_PROMPT_ALLOWANCE_BYTES`, with about 10% to spare.
export const HOSTED_BODY_OVERHEAD_BYTES = 42 * 1024;

// Room kept inside the overhead for the person's custom prompts, which `withCustomPrompts` appends
// to the system prompt without a limit. Custom prompts beyond this can push a five-photo request
// over the cap.
export const HOSTED_CUSTOM_PROMPT_ALLOWANCE_BYTES = 8 * 1024;

export const DEFAULT_HOSTED_IMAGE = { maxPx: 1024, maxBytes: 300 * 1024, quality: 0.7 } as const;

const MAX_QUALITY = 0.95;
const MIN_PX = 256;
const MAX_PX = 4096;

// The image travels as base64, which inflates it by 4/3, so the decoded image may be at
// most this many bytes for the whole body to fit under the cap.
// The overhead is counted once, and the rest is shared by the images of the request.
export function hostedDecodedBytesLimit(
  bodyCapBytes: number = HOSTED_REQUEST_BODY_CAP_BYTES,
  count: number = 1
): number {
  const images = Math.max(1, Math.floor(count) || 1);

  return Math.floor(((bodyCapBytes - HOSTED_BODY_OVERHEAD_BYTES) * 3) / 4 / images);
}

// How many photos one request carries when the Worker does not say.
export const DEFAULT_HOSTED_MAX_IMAGES = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function effectiveImageLimits(
  config: ImageLimits | null,
  options?: { count?: number; bodyMaxBytes?: number | null }
): ImageLimits {
  const source = config ?? DEFAULT_HOSTED_IMAGE;

  return {
    maxPx: Math.round(clamp(finiteOr(source.maxPx, DEFAULT_HOSTED_IMAGE.maxPx), MIN_PX, MAX_PX)),
    maxBytes: Math.min(
      finiteOr(source.maxBytes, DEFAULT_HOSTED_IMAGE.maxBytes),
      hostedDecodedBytesLimit(
        options?.bodyMaxBytes ?? HOSTED_REQUEST_BODY_CAP_BYTES,
        options?.count
      )
    ),
    quality: clamp(
      finiteOr(source.quality, DEFAULT_HOSTED_IMAGE.quality),
      MIN_IMAGE_QUALITY,
      MAX_QUALITY
    ),
  };
}
