import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import {
  type AiImageTier,
  DEFAULT_AI_IMAGE_TIER,
  limitsForTier,
  ON_DEVICE_IMAGE_CEILING,
  OWN_KEY_IMAGE_CEILING,
} from '@/utils/aiImagePlan';
import {
  base64DecodedBytes,
  type HostedImageLimits,
  nextQuality,
  planResize,
} from '@/utils/premium/hostedImagePlan';

export type PreparedImage = { base64: string; mimeType: string };

/** The tier the person picked; the default when it cannot be read, so a photo is never blocked by it. */
export async function loadAiImageTier(): Promise<AiImageTier> {
  try {
    return await SettingsService.get(SETTINGS.aiImageQuality);
  } catch {
    return DEFAULT_AI_IMAGE_TIER;
  }
}

function readSize(dataUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(dataUri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Shrinks and re-encodes a photo to fit `limits`. Returns the input unchanged when it already fits
 * (a photo is never enlarged), and the original input when the resize fails: a resize problem must
 * never block a meal photo.
 */
export async function resizeForAi(
  base64: string,
  mimeType: string,
  limits: HostedImageLimits
): Promise<PreparedImage> {
  const original = { base64, mimeType };

  try {
    const dataUri = `data:${mimeType};base64,${base64}`;
    const size = await readSize(dataUri);
    const plan = planResize(
      { width: size.width, height: size.height, bytes: base64DecodedBytes(base64) },
      limits
    );

    if (!plan.needsWork) {
      return original;
    }

    let best: { base64: string; bytes: number } | null = null;
    let quality: number | null = limits.quality;

    while (quality !== null) {
      const result = await ImageManipulator.manipulateAsync(
        dataUri,
        [{ resize: { width: plan.targetWidth, height: plan.targetHeight } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!result.base64) {
        return original;
      }

      const bytes = base64DecodedBytes(result.base64);

      if (!best || bytes < best.bytes) {
        best = { base64: result.base64, bytes };
      }

      if (bytes <= limits.maxBytes) {
        break;
      }

      quality = nextQuality(quality);
    }

    return best ? { base64: best.base64, mimeType: 'image/jpeg' } : original;
  } catch (error) {
    console.warn('Image preparation failed; sending the original image.', error);

    return original;
  }
}

/**
 * Prepares a photo for a provider the person pays for directly or the free tier: the tier they
 * picked in AI settings, with no provider limit above it. Musclog Iron has its own step
 * (`utils/hostedImage.ts`), which also holds the tier to the Worker's limits.
 */
export async function prepareOwnKeyImage(base64: string, mimeType: string): Promise<PreparedImage> {
  const tier = await loadAiImageTier();

  return resizeForAi(base64, mimeType, limitsForTier(tier, OWN_KEY_IMAGE_CEILING));
}

/** Prepares a photo for the downloaded on-device model: the person's tier, capped at what it can use. */
export async function prepareOnDeviceImage(
  base64: string,
  mimeType: string
): Promise<PreparedImage> {
  const tier = await loadAiImageTier();

  return resizeForAi(base64, mimeType, limitsForTier(tier, ON_DEVICE_IMAGE_CEILING));
}
