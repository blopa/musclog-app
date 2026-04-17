import type { DownloadableModel } from 'expo-ai-kit';
import {
  downloadModel,
  getBuiltInModels,
  getDownloadableModels,
  isAvailable,
  sendMessage,
  setModel,
} from 'expo-ai-kit';

export type OnDeviceMessage = { role: 'user' | 'assistant'; content: string };
export type { DownloadableModel };

/**
 * Fast check — device supports on-device AI at all (no inference probe).
 * Use this for UI visibility decisions.
 */
export async function isOnDeviceAiCapable(): Promise<boolean> {
  try {
    return await isAvailable();
  } catch {
    return false;
  }
}

/**
 * isAvailable() from expo-ai-kit returns true even when the underlying
 * ML Kit model is DOWNLOADABLE or DOWNLOADING (not yet ready for inference).
 * We probe with a short test message to confirm the model actually responds.
 */
export async function isOnDeviceAiAvailable(): Promise<boolean> {
  try {
    const basicAvailable = await isAvailable();
    if (!basicAvailable) {
      return false;
    }

    const probe = await Promise.race<{ text: string }>([
      sendMessage([{ role: 'user', content: 'Hi' }]),
      new Promise<{ text: string }>((resolve) => setTimeout(() => resolve({ text: '' }), 8000)),
    ]);
    return probe.text.length > 0;
  } catch {
    return false;
  }
}

export async function getCompatibleDownloadableModels(): Promise<DownloadableModel[]> {
  try {
    const models = await getDownloadableModels();
    return models.filter((m) => m.meetsRequirements);
  } catch {
    return [];
  }
}

export async function getBuiltInModelStatus(): Promise<{ id: string; available: boolean }[]> {
  try {
    return await getBuiltInModels();
  } catch {
    return [];
  }
}

export async function downloadOnDeviceModel(
  modelId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  await downloadModel(modelId, { onProgress });
  await setModel(modelId);
}

export async function sendOnDeviceMessage(
  messages: OnDeviceMessage[],
  systemPrompt?: string
): Promise<string> {
  const response = await sendMessage(messages, { systemPrompt });
  return response.text ?? '';
}
