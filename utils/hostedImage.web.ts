// The hosted provider is native-only, so web sends the photo unchanged. This file exists
// so every export of `utils/hostedImage.ts` resolves on every platform.

export function resetHostedImageConfigCache(): void {}

export async function prepareHostedImage(
  base64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  return { base64, mimeType };
}
