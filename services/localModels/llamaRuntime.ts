/**
 * The only file that talks to `llama.rn`. It owns one loaded model at a time and the rules for
 * keeping it from costing the phone more than it must:
 *
 * - Loaded lazily on the first request, never at boot.
 * - The photo projector is attached only for a request that carries a photo and released right
 *   after, so text chat never pays its RAM.
 * - One request at a time (a second one waits its turn).
 * - Unloaded after `LOCAL_MODEL_IDLE_MS` without a request, when the app goes to the background,
 *   and on an iOS memory warning (the OS kills the app that holds memory it needs).
 * - A cancel stops generation natively and surfaces as `AiCancelledError`.
 *
 * `llama.rn` is required inline so Jest and the web bundle never load its native module.
 */
import { AppState, Platform } from 'react-native';

import { AiCancelledError, OnDeviceUnavailableError } from '@/utils/aiErrors';
import { captureException } from '@/utils/sentry';

import { getInstalledLocalModel, registerLocalModelUnloader } from './modelStore';
import {
  clearLocalRun,
  describeLogError,
  LOCAL_MODEL_LOG_TAG,
  logLocal,
  markLocalRun,
  traceLocalModel,
} from './runTrace';

type LlamaModule = typeof import('llama.rn');
type LlamaContext = import('llama.rn').LlamaContext;

export const LOCAL_MODEL_IDLE_MS = 120_000;

export type LocalChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type LocalGenerateParams = {
  messages: LocalChatMessage[];
  /** A JSON schema the reply must match: the engine compiles it to a grammar. */
  schema?: object;
  /** A photo (a `file://` path or a `data:` URL) attached to the last user message. Needs the projector. */
  image?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Each new piece of text as it is written. */
  onDelta?: (delta: string) => void;
};

export type LocalGenerateResult = {
  text: string;
  /** Milliseconds, from the engine's own timers; used by the benchmark screen. */
  timings?: {
    promptMs?: number;
    predictedMs?: number;
    promptPerSecond?: number;
    predictedPerSecond?: number;
  };
};

let context: LlamaContext | null = null;
let projectorAttached = false;
let queue: Promise<unknown> = Promise.resolve();
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let busy = false;
let lifecycleInstalled = false;

function llama(): LlamaModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('llama.rn');
}

function plainPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/** Frees the model and everything attached to it. Safe to call when nothing is loaded. */
export async function unloadLocalModel(): Promise<void> {
  logLocal('unloading model', { loaded: context !== null });
  clearIdleTimer();
  const current = context;
  context = null;
  projectorAttached = false;
  if (!current) {
    return;
  }

  try {
    await current.releaseMultimodal().catch(() => undefined);
    await current.release();
  } catch {
    // Already released; nothing is held either way.
  }
}

function scheduleIdleUnload() {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    logLocal('idle timeout reached; unloading', { busy });
    if (!busy) {
      void unloadLocalModel();
    }
  }, LOCAL_MODEL_IDLE_MS);
}

function installLifecycle() {
  if (lifecycleInstalled) {
    return;
  }

  lifecycleInstalled = true;
  AppState.addEventListener('change', (next) => {
    logLocal('app state', next, { busy, loaded: context !== null });
    if (next === 'background' && !busy) {
      void unloadLocalModel();
    }
  });
  if (Platform.OS === 'ios') {
    AppState.addEventListener('memoryWarning', () => {
      if (!busy) {
        void unloadLocalModel();
      }
    });
  }
}

async function ensureContext(): Promise<LlamaContext> {
  if (context) {
    return context;
  }

  const installed = await getInstalledLocalModel();
  if (!installed) {
    throw new OnDeviceUnavailableError('notReady');
  }

  installLifecycle();
  const loadStartedAt = Date.now();
  traceLocalModel('load-start', { model: installed.manifest.id });
  logLocal('load params', {
    modelPath: installed.modelPath,
    projectorPath: installed.projectorPath,
    contextTokens: installed.manifest.contextTokens,
    imageMaxTokens: installed.manifest.imageMaxTokens,
    gpuLayers: Platform.OS === 'ios' ? 99 : 0,
    platform: Platform.OS,
  });
  try {
    const next = await llama().initLlama({
      model: plainPath(installed.modelPath),
      n_ctx: installed.manifest.contextTokens,
      // Metal on iOS. Android runs on the CPU until the OpenCL backend is measured on real phones.
      n_gpu_layers: Platform.OS === 'ios' ? 99 : 0,
      use_mlock: false,
      // Required by llama.rn when a projector is attached.
      ctx_shift: false,
    });
    context = next;
    traceLocalModel('load-done', { ms: Date.now() - loadStartedAt });

    return next;
  } catch (error) {
    console.log(LOCAL_MODEL_LOG_TAG, 'load failed', describeLogError(error));
    // Tags only: no prompt, path or content.
    void captureException(error, {
      captureContext: { tags: { context: 'localModels.load', model: installed.manifest.id } },
    });
    throw new OnDeviceUnavailableError('loadFailed');
  }
}

async function attachProjector(
  ctx: LlamaContext,
  path: string,
  imageMaxTokens: number,
  model: string
) {
  if (projectorAttached) {
    return;
  }

  const startedAt = Date.now();
  traceLocalModel('projector-start', { model, imageMaxTokens });
  let ok = false;
  try {
    ok = await ctx.initMultimodal({
      path: plainPath(path),
      use_gpu: Platform.OS === 'ios',
      image_max_tokens: imageMaxTokens,
    });
  } catch (error) {
    console.log(LOCAL_MODEL_LOG_TAG, 'projector threw', describeLogError(error));
    void captureException(error, {
      captureContext: { tags: { context: 'localModels.projector', model } },
    });
    throw error;
  }

  if (!ok) {
    console.log(LOCAL_MODEL_LOG_TAG, 'projector returned false');
    const failure = new OnDeviceUnavailableError('loadFailed', 'initMultimodal returned false');
    void captureException(failure, {
      captureContext: { tags: { context: 'localModels.projector', model } },
    });
    throw failure;
  }

  projectorAttached = true;
  traceLocalModel('projector-done', { ms: Date.now() - startedAt });
}

function withPhoto(messages: LocalChatMessage[], image: string) {
  const lastUser = [...messages].reverse().findIndex((m) => m.role === 'user');
  const index = lastUser === -1 ? -1 : messages.length - 1 - lastUser;

  return messages.map((message, position) =>
    position === index
      ? {
          role: message.role,
          content: [
            { type: 'text', text: message.content },
            { type: 'image_url', image_url: { url: image } },
          ],
        }
      : message
  );
}

async function run(params: LocalGenerateParams): Promise<LocalGenerateResult> {
  if (params.signal?.aborted) {
    throw new AiCancelledError();
  }

  clearIdleTimer();
  busy = true;
  const hasImage = Boolean(params.image);
  const imageChars = params.image?.length ?? 0;
  const modelId = (await getInstalledLocalModel().catch(() => null))?.manifest.id ?? 'unknown';
  // Written before each native call: a process that dies inside one leaves it for the next boot.
  logLocal('request', {
    messages: params.messages.map((message) => `${message.role}:${message.content.length}`),
    structured: Boolean(params.schema),
    schemaKeys: params.schema ? Object.keys(params.schema) : [],
    maxTokens: params.maxTokens ?? 1024,
    temperature: params.temperature ?? 0.2,
    image: params.image ? `${params.image.slice(0, 30)}… (${params.image.length} chars)` : null,
    queued: queue !== undefined,
    loaded: context !== null,
    projectorAttached,
  });
  const mark = (phase: 'load' | 'projector' | 'completion') =>
    markLocalRun({ phase, model: modelId, hasImage, imageChars });
  try {
    if (!context) {
      await mark('load');
    }

    const ctx = await ensureContext();
    let usedProjector = false;
    if (params.image) {
      const installed = await getInstalledLocalModel();
      if (!installed?.projectorPath) {
        traceLocalModel('projector-missing', { model: modelId });
        throw new OnDeviceUnavailableError('notReady');
      }

      await mark('projector');
      await attachProjector(
        ctx,
        installed.projectorPath,
        installed.manifest.imageMaxTokens,
        modelId
      );
      usedProjector = true;
    }

    await mark('completion');
    traceLocalModel('completion-start', {
      hasImage,
      imageChars,
      structured: Boolean(params.schema),
      messages: params.messages.length,
      promptChars: params.messages.reduce((total, message) => total + message.content.length, 0),
    });

    const onAbort = () => {
      void ctx.stopCompletion();
    };

    params.signal?.addEventListener('abort', onAbort);
    try {
      const result = await ctx.completion(
        {
          messages: params.image ? withPhoto(params.messages, params.image) : params.messages,
          jinja: true,
          n_predict: params.maxTokens ?? 1024,
          temperature: params.temperature ?? 0.2,
          ...(params.schema
            ? {
                response_format: {
                  type: 'json_schema' as const,
                  json_schema: { strict: true, schema: params.schema },
                },
              }
            : {}),
        },
        (data) => {
          if (data.token) {
            params.onDelta?.(data.token);
          }
        }
      );

      if (params.signal?.aborted) {
        throw new AiCancelledError();
      }

      logLocal('reply', { chars: (result.text ?? '').length, text: result.text });
      logLocal('timings', result.timings);
      traceLocalModel('completion-done', {
        replyChars: (result.text ?? '').length,
        promptMs: result.timings?.prompt_ms,
        predictedMs: result.timings?.predicted_ms,
        promptTokens: result.timings?.prompt_n,
        predictedTokens: result.timings?.predicted_n,
      });

      return {
        text: result.text ?? '',
        timings: {
          promptMs: result.timings?.prompt_ms,
          predictedMs: result.timings?.predicted_ms,
          promptPerSecond: result.timings?.prompt_per_second,
          predictedPerSecond: result.timings?.predicted_per_second,
        },
      };
    } catch (error) {
      // A native failure while generating (a cancel is the caller's own doing).
      if (!(error instanceof AiCancelledError) && !params.signal?.aborted) {
        console.log(LOCAL_MODEL_LOG_TAG, 'completion threw', describeLogError(error));
        void captureException(error, {
          captureContext: {
            tags: { context: 'localModels.completion', model: modelId, hasImage: String(hasImage) },
            extra: { imageChars, structured: Boolean(params.schema) },
          },
        });
      }

      throw error;
    } finally {
      params.signal?.removeEventListener('abort', onAbort);
      if (usedProjector) {
        // Photos are rare; the projector's RAM is not worth keeping for the next text turn.
        await ctx.releaseMultimodal().catch(() => undefined);
        projectorAttached = false;
      }
    }
  } finally {
    busy = false;
    void clearLocalRun();
    scheduleIdleUnload();
  }
}

/** Runs one generation on the local model. Requests are served one at a time, in order. */
export function generateWithLocalModel(params: LocalGenerateParams): Promise<LocalGenerateResult> {
  const turn = queue.then(
    () => run(params),
    () => run(params)
  );
  queue = turn.catch(() => undefined);

  return turn;
}

/** True while a request is generating or the model is loaded; used by the storage screen. */
export function isLocalModelLoaded(): boolean {
  return context !== null;
}

// Deleting the files must never pull them from under a loaded model.
registerLocalModelUnloader(unloadLocalModel);
