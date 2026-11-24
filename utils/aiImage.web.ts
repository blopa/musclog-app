// On web the photo goes to the provider unchanged: the image codec is a native module. This file
// exists so every export of `utils/aiImage.ts` resolves on every platform.
import { type AiImageTier, DEFAULT_AI_IMAGE_TIER } from '@/utils/aiImagePlan';
import type { HostedImageLimits } from '@/utils/premium/hostedImagePlan';

export type PreparedImage = { base64: string; mimeType: string };

export async function loadAiImageTier(): Promise<AiImageTier> {
  return DEFAULT_AI_IMAGE_TIER;
}

export async function resizeForAi(
  base64: string,
  mimeType: string,
  // Unused on web: nothing is resized.
  _limits: HostedImageLimits
): Promise<PreparedImage> {
  return { base64, mimeType };
}

export async function prepareOwnKeyImage(base64: string, mimeType: string): Promise<PreparedImage> {
  return { base64, mimeType };
}

export async function prepareOnDeviceImage(
  base64: string,
  mimeType: string
): Promise<PreparedImage> {
  return { base64, mimeType };
}
