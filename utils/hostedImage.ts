import { fetchPremiumConfig } from '@/services/premium/premiumService';
import { loadAiImageTier, type PreparedImage, resizeForAi } from '@/utils/aiImage';
import { limitsForTier } from '@/utils/aiImagePlan';
import { HostedAiError } from '@/utils/hostedAiError';
import {
  DEFAULT_HOSTED_IMAGE,
  effectiveImageLimits,
  type HostedImageLimits,
} from '@/utils/premium/hostedImagePlan';

type HostedPhotoConfig = { limits: HostedImageLimits; visionEnabled: boolean | null };

/**
 * The limits for this photo: the person's tier, held to the Worker's photo limits (cached by
 * `fetchPremiumConfig`), which also keep the request under its body cap. Defaults when the config
 * cannot be read.
 */
async function loadPhotoConfig(): Promise<HostedPhotoConfig> {
  const tier = await loadAiImageTier();

  try {
    const result = await fetchPremiumConfig();

    if (result.ok) {
      return {
        limits: limitsForTier(tier, effectiveImageLimits(result.value.image)),
        visionEnabled: result.value.visionEnabled,
      };
    }
  } catch {
    // Fall through to the defaults: a config problem must never block a meal photo.
  }

  return {
    limits: limitsForTier(tier, effectiveImageLimits(DEFAULT_HOSTED_IMAGE)),
    visionEnabled: null,
  };
}

/**
 * Prepares a photo for Musclog Iron: the tier the person picked, held to the Worker's limits so the
 * request fits its body cap. Throws a hosted `unavailable` error when the Worker has switched
 * photos off. A resize problem never blocks a photo (see `resizeForAi`).
 */
export async function prepareHostedImage(base64: string, mimeType: string): Promise<PreparedImage> {
  const { limits, visionEnabled } = await loadPhotoConfig();

  // The Worker says photos are off right now: say so instead of sending a request it will refuse.
  if (visionEnabled === false) {
    throw new HostedAiError('unavailable');
  }

  return resizeForAi(base64, mimeType, limits);
}
