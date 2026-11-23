/**
 * Development-only bridge that lets the web build exercise the downloaded-model (`gguf`) engine.
 *
 * The real engine is llama.rn, a native module, so the browser cannot run it. Under the dev server
 * (`__DEV__` on web) the engine instead talks to a desktop `llama-server` (llama.cpp) started by
 * `scripts/dev-local-model-server.sh` with the same GGUF and projector files, so prompts, schemas,
 * photo handling and the model's answers can be debugged with browser devtools. It does NOT
 * exercise llama.rn itself (loading, the projector attach, memory), only everything around it.
 *
 * Opt-in (`npm run web:local-llm`): a plain `npm run web` never starts or contacts the server.
 * Production web never reaches this: `isDevWebLocalModel()` is false outside `__DEV__`.
 */
import { Platform } from 'react-native';

export const DEV_LOCAL_MODEL_DEFAULT_URL = 'http://localhost:8080';

/** Opt-in: only `npm run web:local-llm` sets `EXPO_PUBLIC_DEV_LOCAL_MODEL=1`. */
export function isDevWebLocalModel(): boolean {
  return Platform.OS === 'web' && __DEV__ && process.env.EXPO_PUBLIC_DEV_LOCAL_MODEL === '1';
}

export function devLocalModelBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_DEV_LOCAL_MODEL_URL?.trim();

  return (configured || DEV_LOCAL_MODEL_DEFAULT_URL).replace(/\/+$/, '');
}
