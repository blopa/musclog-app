/**
 * Pure rules for how much detail a photo keeps when it is sent to an AI model, for every provider
 * (Musclog Iron, the free tier and the person's own key). No React Native imports: `utils/aiImage.ts`
 * does the native work, these functions decide what it does. The sizing helpers it reuses
 * (`planResize`, `nextQuality`) live in `utils/premium/hostedImagePlan.ts`.
 */
import type { HostedImageLimits } from '@/utils/premium/hostedImagePlan';

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
export const OWN_KEY_IMAGE_CEILING: HostedImageLimits = {
  maxPx: 4096,
  maxBytes: 4 * 1024 * 1024,
  quality: 0.95,
};

/**
 * What the downloaded on-device model is given: its vision encoder takes 512 px tiles, so more
 * pixels cost time and memory without adding detail it can use. Lowers the tier, never raises it.
 */
export const ON_DEVICE_IMAGE_CEILING: HostedImageLimits = {
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
export function limitsForTier(tier: AiImageTier, ceiling: HostedImageLimits): HostedImageLimits {
  const wanted = AI_IMAGE_TIERS[tier];

  return {
    maxPx: Math.min(wanted.maxPx, ceiling.maxPx),
    maxBytes: ceiling.maxBytes,
    quality: Math.min(wanted.quality, ceiling.quality),
  };
}
