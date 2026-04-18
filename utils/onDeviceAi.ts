import type { DownloadableModel, SetModelOptions } from 'expo-ai-kit';
import {
  deleteModel,
  downloadModel,
  getActiveModel,
  getBuiltInModels,
  getDownloadableModels,
  isAvailable,
  isPromptInferenceReady,
  sendMessage,
  setModel,
} from 'expo-ai-kit';
import { Platform } from 'react-native';

export type OnDeviceMessage = { role: 'user' | 'assistant'; content: string };
export type { DownloadableModel };

/** Gemma/LiteRT on Android often uses OpenCL for GPU; many devices ship without it. CPU is slower but works. */
function androidDownloadableSetOptions(): SetModelOptions | undefined {
  return Platform.OS === 'android' ? { backend: 'cpu' } : undefined;
}

function looksLikeOpenClOrGpuInferenceFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /OpenCL/i.test(msg) ||
    /INFERENCE_FAILED/i.test(msg) ||
    /Can not find OpenCL/i.test(msg)
  );
}

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
 * True when on-device inference can run with the stacks we support:
 * - Android: a compatible downloadable model (e.g. Gemma) is downloaded and loads (`ready`).
 * - iOS: Apple Foundation Models when the built-in stack is ready, or a `ready` downloadable model once shipped.
 */
export async function isOnDeviceAiAvailable(): Promise<boolean> {
  try {
    const basicAvailable = await isAvailable();
    if (!basicAvailable) {
      return false;
    }

    await tryRecoverStaleDownloadableModelStatus();
    const compatible = await getCompatibleDownloadableModels();
    const firstUsable = compatible.find(
      (m) => m.status === 'ready' || m.status === 'loading'
    );
    if (firstUsable) {
      try {
        await ensureActiveDownloadableModelForInference();
        return true;
      } catch {
        return false;
      }
    }

    if (Platform.OS === 'ios') {
      return await isPromptInferenceReady();
    }

    return false;
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

/**
 * After a cold start, expo-ai-kit can briefly report every model as `not-downloaded` even when
 * weights are still on disk. Probing `setModel` reattaches LiteRT and refreshes native status.
 * No-op when any model is already `ready` / `loading` / `downloading`.
 */
export async function tryRecoverStaleDownloadableModelStatus(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  let raw: DownloadableModel[];
  try {
    raw = await getDownloadableModels();
  } catch {
    return;
  }
  if (raw.length === 0) {
    return;
  }
  const busy = raw.some(
    (m) => m.status === 'ready' || m.status === 'loading' || m.status === 'downloading'
  );
  if (busy) {
    return;
  }
  const allReportNotDownloaded = raw.every((m) => m.status === 'not-downloaded');
  if (!allReportNotDownloaded) {
    return;
  }
  const opts = androidDownloadableSetOptions();
  const sorted = [...raw].sort((a, b) => a.sizeBytes - b.sizeBytes);
  for (const m of sorted) {
    try {
      await setModel(m.id, opts);
      return;
    } catch {
      // Try next candidate (e.g. user only installed the larger model).
    }
  }
}

export async function getBuiltInModelStatus(): Promise<{ id: string; available: boolean }[]> {
  try {
    return await getBuiltInModels();
  } catch {
    return [];
  }
}

/**
 * Picks a downloaded (`ready`) compatible model if needed so sendMessage uses Gemma instead of the default backend.
 */
export async function ensureActiveDownloadableModelForInference(): Promise<void> {
  await tryRecoverStaleDownloadableModelStatus();
  const compatible = await getCompatibleDownloadableModels();
  const usableList = compatible.filter((m) => m.status === 'ready' || m.status === 'loading');
  if (usableList.length === 0) {
    return;
  }
  const activeId = getActiveModel();
  const activeMatch = usableList.find((m) => m.id === activeId);
  const toLoad = activeMatch ?? usableList[0];
  const opts = androidDownloadableSetOptions();
  if (getActiveModel() !== toLoad.id) {
    await setModel(toLoad.id, opts);
  }
}

/** Download model weights to disk (progress 0–1). Does not load into memory. */
export async function downloadOnDeviceModelFiles(
  modelId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  await downloadModel(modelId, { onProgress });
}

/** Load a downloaded model for inference (can take a while after progress hits 100%). */
export async function activateOnDeviceModel(modelId: string): Promise<void> {
  await setModel(modelId, androidDownloadableSetOptions());
}

export async function downloadOnDeviceModel(
  modelId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  await downloadOnDeviceModelFiles(modelId, onProgress);
  await activateOnDeviceModel(modelId);
}

/**
 * Stops an in-flight download by removing partial or complete files for that model id (expo-ai-kit / native).
 */
export async function cancelOnDeviceModelDownload(modelId: string): Promise<void> {
  try {
    await deleteModel(modelId);
  } catch {
    // No-op if nothing to remove or native rejects mid-flight.
  }
}

export async function deleteDownloadedOnDeviceModel(modelId: string): Promise<void> {
  await deleteModel(modelId);
}

export async function sendOnDeviceMessage(
  messages: OnDeviceMessage[],
  systemPrompt?: string
): Promise<string> {
  await ensureActiveDownloadableModelForInference();
  try {
    const response = await sendMessage(messages, { systemPrompt });
    return response.text ?? '';
  } catch (e) {
    if (Platform.OS === 'android' && looksLikeOpenClOrGpuInferenceFailure(e)) {
      const compatible = await getCompatibleDownloadableModels();
      const ready = compatible.find((m) => m.status === 'ready' || m.status === 'loading');
      if (ready) {
        await setModel(ready.id, { backend: 'cpu' });
        const response = await sendMessage(messages, { systemPrompt });
        return response.text ?? '';
      }
    }
    throw e;
  }
}
