/**
 * Pure rules for how much detail a photo keeps when it is sent to an AI model, for every provider
 * (Musclog Iron, the free tier and the person's own key), plus the generic sizing helpers
 * (`base64DecodedBytes`, `planResize`, `nextQuality`). No React Native imports: `utils/aiImage.ts`
 * does the native work, these functions decide what it does.
 */

export type ImageLimits = { maxPx: number; maxBytes: number; quality: number };

export type ImageDimensions = { width: number; height: number; bytes: number };

export type ResizePlan = { targetWidth: number; targetHeight: number; needsWork: boolean };

export const MIN_IMAGE_QUALITY = 0.3;
const QUALITY_STEP = 0.1;

export function base64DecodedBytes(base64: string): number {
  let padding = 0;

  if (base64.endsWith('==')) {
    padding = 2;
  } else if (base64.endsWith('=')) {
    padding = 1;
  }

  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function planResize(input: ImageDimensions, limits: ImageLimits): ResizePlan {
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
  if (quality <= MIN_IMAGE_QUALITY) {
    return null;
  }

  const stepped = Math.round((quality - QUALITY_STEP) * 10) / 10;

  return Math.max(MIN_IMAGE_QUALITY, stepped);
}

/**
 * Chosen by the person. A larger photo reads small print and mixed plates better, but it is more
 * image tokens on every request: more of the Musclog Iron allowance, or of what their own key is
 * billed for, and a little more waiting.
 */
export type AiImageTier = 'low' | 'medium' | 'high' | 'max';

/** Lowest to highest: the order the picker shows them in. */
export const AI_IMAGE_TIER_ORDER: readonly AiImageTier[] = ['low', 'medium', 'high', 'max'];

/** The second lowest: enough to read a plate, and well short of the biggest photo. */
export const DEFAULT_AI_IMAGE_TIER: AiImageTier = 'medium';

/** What each tier asks for. A provider's own limits can only lower these (`limitsForTier`). */
export const AI_IMAGE_TIERS: Record<AiImageTier, { maxPx: number; quality: number }> = {
  low: { maxPx: 512, quality: 0.7 },
  medium: { maxPx: 768, quality: 0.75 },
  high: { maxPx: 1024, quality: 0.8 },
  max: { maxPx: 1568, quality: 0.85 },
};

/**
 * What a provider the person pays for directly accepts. Far above every tier, so it never lowers
 * one: the biggest request limit among them is Claude's 5 MB per image, which this stays under.
 */
export const OWN_KEY_IMAGE_CEILING: ImageLimits = {
  maxPx: 4096,
  maxBytes: 4 * 1024 * 1024,
  quality: 0.95,
};

/**
 * What the downloaded on-device model is given: its vision encoder takes 512 px tiles, so more
 * pixels cost time and memory without adding detail it can use. Lowers the tier, never raises it.
 */
export const ON_DEVICE_IMAGE_CEILING: ImageLimits = {
  maxPx: 768,
  maxBytes: 4 * 1024 * 1024,
  quality: 0.85,
};

/** Reads a stored tier, treating anything unrecognized (a newer build, a hand-edited backup) as the default. */
export function parseAiImageTier(raw: string | null | undefined): AiImageTier {
  return AI_IMAGE_TIER_ORDER.find((tier) => tier === raw) ?? DEFAULT_AI_IMAGE_TIER;
}

/**
 * The limits one photo is prepared with: what the person's tier asks for, held to what the provider
 * allows. Musclog Iron's ceiling is the Worker's advertised limits (so lowering them remotely
 * shrinks every tier); an own key or the free tier uses `OWN_KEY_IMAGE_CEILING`.
 */
export function limitsForTier(tier: AiImageTier, ceiling: ImageLimits): ImageLimits {
  const wanted = AI_IMAGE_TIERS[tier];

  return {
    maxPx: Math.min(wanted.maxPx, ceiling.maxPx),
    maxBytes: ceiling.maxBytes,
    quality: Math.min(wanted.quality, ceiling.quality),
  };
}

/** Below this share of the byte budget per photo, the pixel size is lowered too. */
export const MULTI_IMAGE_MIN_SHARE_BYTES = 120 * 1024;

const MULTI_IMAGE_MAX_PX = 768;

/**
 * The limits each photo is prepared with when `count` photos share one request: the byte budget is
 * split evenly, and a small share also caps the pixel size (never raises it).
 */
export function limitsForImageCount(limits: ImageLimits, count: number): ImageLimits {
  const images = Math.max(1, Math.floor(count) || 1);
  const maxBytes = Math.floor(limits.maxBytes / images);

  return {
    ...limits,
    maxBytes,
    maxPx:
      maxBytes < MULTI_IMAGE_MIN_SHARE_BYTES
        ? Math.min(limits.maxPx, MULTI_IMAGE_MAX_PX)
        : limits.maxPx,
  };
}
