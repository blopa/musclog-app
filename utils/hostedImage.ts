import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { fetchPremiumConfig } from '@/services/premium/premiumService';
import {
  base64DecodedBytes,
  DEFAULT_HOSTED_IMAGE,
  effectiveImageLimits,
  type HostedImageLimits,
  nextQuality,
  planResize,
} from '@/utils/premium/hostedImagePlan';

const CONFIG_CACHE_MS = 5 * 60 * 1000;

let cachedLimits: HostedImageLimits | null = null;
let cachedAt = 0;

export function resetHostedImageConfigCache(): void {
  cachedLimits = null;
  cachedAt = 0;
}

async function loadLimits(): Promise<HostedImageLimits> {
  const now = Date.now();

  if (cachedLimits && now - cachedAt < CONFIG_CACHE_MS) {
    return cachedLimits;
  }

  let image: HostedImageLimits | null = null;

  try {
    const result = await fetchPremiumConfig();

    if (result.ok) {
      image = effectiveImageLimits(result.value.image);
    }
  } catch {
    image = null;
  }

  cachedLimits = image ?? effectiveImageLimits(DEFAULT_HOSTED_IMAGE);
  cachedAt = now;

  return cachedLimits;
}

function readSize(dataUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(dataUri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Resizes and re-encodes a photo for the hosted provider so the request fits the Worker's
 * body cap. Returns the input unchanged when it already fits, and the original input when
 * anything fails: a resize problem must never block a meal photo.
 */
export async function prepareHostedImage(
  base64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  const original = { base64, mimeType };

  try {
    const limits = await loadLimits();
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
