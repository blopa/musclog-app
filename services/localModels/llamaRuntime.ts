/**
 * The only file that talks to `llama.rn`. It owns one loaded model at a time and the rules for
 * keeping it from costing the phone more than it must. Which model is chosen per request: a request
 * with a photo goes to the main (vision) model, every other request to the optional text model when
 * it is installed, else to the main model. Never two contexts: a request for the other model
 * unloads the loaded one completely (projector included) and then loads the other, so a switch
 * costs one unload and one load, and consecutive requests for the same model reuse its context.
 *
 * - Loaded lazily on the first request, never at boot.
 * - The photo projector is attached only for a request that carries a photo and kept for
 *   `LOCAL_PROJECTOR_IDLE_MS` after the last request (a meal reads up to five photos back to back),
 *   then released, so text chat does not pay its RAM for long.
 * - One request at a time (a second one waits its turn).
 * - Unloaded after `LOCAL_MODEL_IDLE_MS` without a request, when the app goes to the background,
 *   and on an iOS memory warning (the OS kills the app that holds memory it needs).
 * - A cancel stops generation natively and surfaces as `AiCancelledError`.
 *
 * `llama.rn` is required inline so Jest and the web bundle never load its native module.
 */
import { AppState, Platform } from 'react-native';

import type { LocalTextSampling } from '@/constants/localModels';
import { AiCancelledError, OnDeviceUnavailableError } from '@/utils/aiErrors';
import { reportAiEvent } from '@/utils/aiTelemetry';
import { handleError } from '@/utils/handleError';
import { stripTemplateTokens } from '@/utils/localReplyShape';
import { captureException } from '@/utils/sentry';
import { createSerialQueue } from '@/utils/serialQueue';

import {
  readToolCalls,
  toEngineMessages,
  toEngineTools,
  toolTemplateOverride,
} from './localToolMessages';
import type { InstalledLocalModel } from './modelFolders';
import { localModelStore, localTextModelStore, registerLocalModelUnloader } from './modelStore';

type LlamaModule = typeof import('llama.rn');
type LlamaContext = import('llama.rn').LlamaContext;

export const LOCAL_MODEL_IDLE_MS = 120_000;
export const LOCAL_PROJECTOR_IDLE_MS = 15_000;

/** One tool the model may call, in the model's own tool-call format. */
export type LocalToolDefinition = { name: string; description: string; parameters: object };
/** A call the model made; `arguments` is JSON text, as llama.cpp's parser returns it. */
export type LocalToolCall = { id?: string; name: string; arguments: string };
export type LocalChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: LocalToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string };

export type LocalGenerateParams = {
  messages: LocalChatMessage[];
  /** A JSON schema the reply must match: the engine compiles it to a grammar. Not with `tools`. */
  schema?: object;
  /** Tools the model may call; the engine's chat template and parser turn them into `toolCalls`. */
  tools?: LocalToolDefinition[];
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
  /** Present (possibly empty) exactly when the request carried tools. */
  toolCalls?: LocalToolCall[];
  /** Milliseconds, from the engine's own timers; used by the benchmark screen. */
  timings?: {
    promptMs?: number;
    predictedMs?: number;
    promptPerSecond?: number;
    predictedPerSecond?: number;
  };
};

let context: LlamaContext | null = null;
/** The loaded model's vendor sampling for plain-text replies; set with `context`, cleared with it. */
let textSampling: LocalTextSampling | null = null;
let projectorAttached = false;
/** The `modelPath` of the model `context` was loaded from; set with `context`, cleared with it. */
let loadedModelPath: string | null = null;
/** Every model operation (unload, projector release, generation) runs one at a time. */
const queue = createSerialQueue();
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let busy = false;
let projectorTimer: ReturnType<typeof setTimeout> | null = null;
/** Set when `unloadLocalModel` stopped the running completion: its text is cut short. */
let stoppedByUnload = false;
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

function clearProjectorTimer() {
  if (projectorTimer) {
    clearTimeout(projectorTimer);
    projectorTimer = null;
  }
}

async function releaseProjector(): Promise<void> {
  if (busy || !context || !projectorAttached) {
    return;
  }

  projectorAttached = false;
  try {
    await context.releaseMultimodal();
  } catch (error) {
    // The projector is already detached from our side; the model stays usable.
    void handleError(error, 'localModels.releaseProjector', { showSnackbar: false });
  }
}

function scheduleProjectorRelease() {
  clearProjectorTimer();
  if (!projectorAttached) {
    return;
  }

  projectorTimer = setTimeout(() => {
    projectorTimer = null;
    void queue.run(releaseProjector);
  }, LOCAL_PROJECTOR_IDLE_MS);
}

async function performUnload(): Promise<void> {
  clearIdleTimer();
  clearProjectorTimer();
  const current = context;
  context = null;
  textSampling = null;
  loadedModelPath = null;
  projectorAttached = false;
  if (!current) {
    return;
  }

  try {
    await current.releaseMultimodal().catch(() => undefined);
    await current.release();
  } catch (error) {
    // Never rejects: an unload that fails is reported, and nothing stays usable either way.
    void handleError(error, 'localModels.unload', { showSnackbar: false });
  }
}

/** Frees the model and everything attached to it. Safe to call when nothing is loaded. */
export function unloadLocalModel(): Promise<void> {
  clearIdleTimer();
  if (busy && context) {
    stoppedByUnload = true;
    void context.stopCompletion().catch(() => undefined);
  }

  return queue.run(performUnload);
}

function scheduleIdleUnload() {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
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

/** A photo needs the main model with its projector; everything else prefers the text model. */
async function chooseModel(params: LocalGenerateParams): Promise<InstalledLocalModel> {
  if (params.image) {
    const main = await localModelStore.getInstalled();
    if (!main?.projectorPath) {
      throw new OnDeviceUnavailableError('notReady');
    }

    return main;
  }

  const text = await localTextModelStore.getInstalled();
  const chosen = text ?? (await localModelStore.getInstalled());
  if (!chosen) {
    throw new OnDeviceUnavailableError('notReady');
  }

  return chosen;
}

async function ensureContext(installed: InstalledLocalModel): Promise<LlamaContext> {
  if (context && loadedModelPath === installed.modelPath) {
    return context;
  }

  if (context) {
    // The other model is wanted: never two contexts, so the loaded one goes first.
    await performUnload();
  }

  installLifecycle();
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
    loadedModelPath = installed.modelPath;
    textSampling = installed.manifest.textSampling;

    return next;
  } catch (error) {
    // Tags only: no prompt, path or content.
    void captureException(error, {
      captureContext: { tags: { context: 'localModels.load', model: installed.manifest.id } },
    });
    throw new OnDeviceUnavailableError('loadFailed');
  }
}

async function attachProjector(ctx: LlamaContext, path: string, imageMaxTokens: number) {
  if (projectorAttached) {
    return;
  }

  let ok = false;
  try {
    ok = await ctx.initMultimodal({
      path: plainPath(path),
      use_gpu: Platform.OS === 'ios',
      image_max_tokens: imageMaxTokens,
    });
  } catch (error) {
    // Tags only: no prompt, path or content.
    void captureException(error, {
      captureContext: { tags: { context: 'localModels.projector' } },
    });
  }

  if (!ok) {
    reportAiEvent('local-model-projector-failed', { platform: Platform.OS });
    throw new OnDeviceUnavailableError('loadFailed');
  }

  projectorAttached = true;
}

function withPhoto(messages: ReturnType<typeof toEngineMessages>, image: string) {
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

/** A plain-text reply (chat, insights): no schema to enforce, no photo, no tool call. */
function plainTextSampling(params: LocalGenerateParams): boolean {
  return !params.schema && !params.image && !params.tools;
}

async function run(params: LocalGenerateParams): Promise<LocalGenerateResult> {
  if (params.signal?.aborted) {
    throw new AiCancelledError();
  }

  clearIdleTimer();
  clearProjectorTimer();
  stoppedByUnload = false;
  busy = true;
  try {
    const installed = await chooseModel(params);
    const ctx = await ensureContext(installed);
    if (params.image && installed.projectorPath) {
      await attachProjector(ctx, installed.projectorPath, installed.manifest.imageMaxTokens);
    }

    const onAbort = () => {
      void ctx.stopCompletion();
    };

    params.signal?.addEventListener('abort', onAbort);
    try {
      if (params.signal?.aborted) {
        throw new AiCancelledError();
      }

      // A plain-text reply takes the vendor's sampling; a schema or a photo keeps the defaults.
      const plainSampling = plainTextSampling(params) ? textSampling : null;
      // Only a tool request: llama.cpp needs a hint to read this model's template for tools.
      const toolTemplate = params.tools
        ? toolTemplateOverride(
            (ctx.model?.metadata as Record<string, unknown> | undefined)?.[
              'tokenizer.chat_template'
            ]
          )
        : undefined;
      const result = await ctx.completion(
        {
          messages: params.image
            ? withPhoto(toEngineMessages(params.messages), params.image)
            : toEngineMessages(params.messages),
          jinja: true,
          n_predict: params.maxTokens ?? 1024,
          temperature: params.temperature ?? plainSampling?.temperature ?? 0.2,
          ...(plainSampling
            ? { min_p: plainSampling.minP, penalty_repeat: plainSampling.repeatPenalty }
            : {}),
          ...(params.tools
            ? {
                tools: toEngineTools(params.tools),
                tool_choice: 'auto',
                ...(toolTemplate ? { chat_template: toolTemplate } : {}),
              }
            : {}),
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

      if (params.signal?.aborted || stoppedByUnload) {
        throw new AiCancelledError();
      }

      // `content` is what llama.cpp's own chat parser left (what llama-server returns as the message);
      // `text` is the raw stream, control tokens included. Prefer the parsed one, clean either.
      const replyText = stripTemplateTokens(
        result.content?.trim() ? result.content : (result.text ?? '')
      );

      return {
        text: replyText,
        ...(params.tools
          ? { toolCalls: readToolCalls((result as { tool_calls?: unknown }).tool_calls) }
          : {}),
        timings: {
          promptMs: result.timings?.prompt_ms,
          predictedMs: result.timings?.predicted_ms,
          promptPerSecond: result.timings?.prompt_per_second,
          predictedPerSecond: result.timings?.predicted_per_second,
        },
      };
    } finally {
      params.signal?.removeEventListener('abort', onAbort);
    }
  } finally {
    busy = false;
    stoppedByUnload = false;
    scheduleProjectorRelease();
    scheduleIdleUnload();
  }
}

/** Runs one generation on the local model. Requests are served one at a time, in order. */
export function generateWithLocalModel(params: LocalGenerateParams): Promise<LocalGenerateResult> {
  if (params.tools && params.schema) {
    return Promise.reject(new Error('A local request takes tools or a schema, never both.'));
  }

  clearIdleTimer();
  clearProjectorTimer();
  return queue.run(() => run(params));
}

/** True while a request is generating or the model is loaded; used by the storage screen. */
export function isLocalModelLoaded(): boolean {
  return context !== null;
}

// Deleting the files must never pull them from under a loaded model.
registerLocalModelUnloader(unloadLocalModel);
