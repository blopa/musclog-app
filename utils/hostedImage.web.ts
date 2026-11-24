// The hosted provider is native-only, so web sends the photo unchanged. This file exists
// so every export of `utils/hostedImage.ts` resolves on every platform.
import { DEFAULT_HOSTED_MAX_IMAGES } from '@/utils/premium/hostedImagePlan';

export async function prepareHostedImage(
  base64: string,
  mimeType: string,
  // Unused on web: nothing is resized.
  _count: number = 1
): Promise<{ base64: string; mimeType: string }> {
  return { base64, mimeType };
}

export async function loadHostedMaxImages(): Promise<number> {
  return DEFAULT_HOSTED_MAX_IMAGES;
}
