import type { DownloadableModel } from 'expo-ai-kit';

export type OnDeviceMessage = { role: 'user' | 'assistant'; content: string };
export type { DownloadableModel };

export async function isOnDeviceAiCapable(): Promise<boolean> {
  return false;
}

export async function isOnDeviceAiAvailable(): Promise<boolean> {
  return false;
}

export async function getCompatibleDownloadableModels(): Promise<DownloadableModel[]> {
  return [];
}

export async function tryRecoverStaleDownloadableModelStatus(): Promise<void> {}

export async function getBuiltInModelStatus(): Promise<{ id: string; available: boolean }[]> {
  return [];
}

export async function downloadOnDeviceModelFiles(
  _modelId: string,
  _onProgress: (progress: number) => void
): Promise<void> {}

export async function activateOnDeviceModel(_modelId: string): Promise<void> {}

export async function downloadOnDeviceModel(
  _modelId: string,
  _onProgress: (progress: number) => void
): Promise<void> {}

export async function ensureActiveDownloadableModelForInference(): Promise<void> {}

export async function cancelOnDeviceModelDownload(_modelId: string): Promise<void> {}

export async function deleteDownloadedOnDeviceModel(_modelId: string): Promise<void> {}

export async function sendOnDeviceMessage(
  _messages: OnDeviceMessage[],
  _systemPrompt?: string
): Promise<string> {
  return '';
}
