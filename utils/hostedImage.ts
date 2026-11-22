import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { fetchPremiumConfig } from '@/services/premium/premiumService';
import { HostedAiError } from '@/utils/hostedAiError';
import {
  base64DecodedBytes,
  DEFAULT_HOSTED_IMAGE,
  effectiveImageLimits,
  type HostedImageLimits,
  nextQuality,
  planResize,
} from '@/utils/premium/hostedImagePlan';

type HostedPhotoConfig = { limits: HostedImageLimits; visionEnabled: boolean | null };

/** The Worker's photo limits (cached by `fetchPremiumConfig`); defaults when it cannot be read. */
async function loadPhotoConfig(): Promise<HostedPhotoConfig> {
  try {
    const result = await fetchPremiumConfig();

    if (result.ok) {
      return {
        limits: effectiveImageLimits(result.value.image),
        visionEnabled: result.value.visionEnabled,
      };
    }
  } catch {
    // Fall through to the defaults: a config problem must never block a meal photo.
  }

  return { limits: effectiveImageLimits(DEFAULT_HOSTED_IMAGE), visionEnabled: null };
}

function readSize(dataUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(dataUri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Resizes and re-encodes a photo for the hosted provider so the request fits the Worker's
 * body cap. Returns the input unchanged when it already fits, and the original input when
 * a resize fails: a resize problem must never block a meal photo. Throws a hosted `unavailable`
 * error when the Worker has switched photos off.
 */
export async function prepareHostedImage(
  base64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  const original = { base64, mimeType };
  const { limits, visionEnabled } = await loadPhotoConfig();

  // The Worker says photos are off right now: say so instead of sending a request it will refuse.
  if (visionEnabled === false) {
    throw new HostedAiError('unavailable');
  }

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
    console.warn('Hosted image preparation failed; sending the original image.', error);

    return original;
  }
}
