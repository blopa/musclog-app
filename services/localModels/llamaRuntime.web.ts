/**
 * Web counterpart of `llamaRuntime.ts`. llama.rn is native, so on web this only works under the
 * development server, where it forwards to a desktop `llama-server` (see `devWebBridge.ts`).
 * Anywhere else it reports the model as unavailable. Same exports as the native file
 * (`platformModuleParity`).
 */
import { DEFAULT_LOCAL_MODEL } from '@/constants/localModels';
import { AiCancelledError, OnDeviceUnavailableError } from '@/utils/aiErrors';
import { stripTemplateTokens } from '@/utils/localReplyShape';
import { createSerialQueue } from '@/utils/serialQueue';

import { devLocalModelBaseUrl, isDevWebLocalModel } from './devWebBridge';
import type {
  LocalChatMessage,
  LocalGenerateParams,
  LocalGenerateResult,
  LocalToolCall,
  LocalToolDefinition,
} from './llamaRuntime';
import { readToolCalls, toEngineMessages, toEngineTools } from './localToolMessages';

export type {
  LocalChatMessage,
  LocalGenerateParams,
  LocalGenerateResult,
  LocalToolCall,
  LocalToolDefinition,
};

export const LOCAL_MODEL_IDLE_MS = 120_000;
export const LOCAL_PROJECTOR_IDLE_MS = 15_000;

const queue = createSerialQueue();
let loaded = false;

export function unloadLocalModel(): Promise<void> {
  return queue.run(async () => {
    loaded = false;
  });
}

export function isLocalModelLoaded(): boolean {
  return loaded;
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

async function run(params: LocalGenerateParams): Promise<LocalGenerateResult> {
  if (params.tools && params.schema) {
    throw new Error('A local request takes tools or a schema, never both.');
  }

  if (!isDevWebLocalModel()) {
    throw new OnDeviceUnavailableError('notReady');
  }

  if (params.signal?.aborted) {
    throw new AiCancelledError();
  }

  // The same plain-text rule as the native runtime: a schema or a photo keeps the defaults.
  const plainSampling =
    !params.schema && !params.image && !params.tools ? DEFAULT_LOCAL_MODEL.textSampling : null;
  const body = {
    messages: params.image
      ? withPhoto(toEngineMessages(params.messages), params.image)
      : toEngineMessages(params.messages),
    max_tokens: params.maxTokens ?? 1024,
    temperature: params.temperature ?? plainSampling?.temperature ?? 0.2,
    stream: false,
    ...(plainSampling
      ? { min_p: plainSampling.minP, repeat_penalty: plainSampling.repeatPenalty }
      : {}),
    ...(params.tools
      ? {
          tools: toEngineTools(params.tools),
          tool_choice: 'auto',
        }
      : {}),
    ...(params.schema
      ? {
          response_format: {
            type: 'json_schema',
            json_schema: { strict: true, schema: params.schema },
          },
        }
      : {}),
  };

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${devLocalModelBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: params.signal,
    });
  } catch (error) {
    if (params.signal?.aborted) {
      throw new AiCancelledError();
    }

    console.warn(
      '[devLocalModel] llama-server is unreachable; start it with scripts/dev-local-model-server.sh',
      error
    );
    throw new OnDeviceUnavailableError('loadFailed');
  }

  const text = await response.text();
  if (!response.ok) {
    console.warn('[devLocalModel] llama-server answered', response.status, text);
    throw new OnDeviceUnavailableError('loadFailed');
  }

  loaded = true;
  const json = JSON.parse(text) as {
    choices?: { message?: { content?: string; tool_calls?: unknown } }[];
    timings?: {
      prompt_ms?: number;
      predicted_ms?: number;
      prompt_per_second?: number;
      predicted_per_second?: number;
    };
  };
  const reply = stripTemplateTokens(json.choices?.[0]?.message?.content ?? '');
  params.onDelta?.(reply);
  console.info('[devLocalModel] reply in', Date.now() - startedAt, 'ms:', reply);

  return {
    text: reply,
    ...(params.tools ? { toolCalls: readToolCalls(json.choices?.[0]?.message?.tool_calls) } : {}),
    timings: {
      promptMs: json.timings?.prompt_ms,
      predictedMs: json.timings?.predicted_ms,
      promptPerSecond: json.timings?.prompt_per_second,
      predictedPerSecond: json.timings?.predicted_per_second,
    },
  };
}

export function generateWithLocalModel(params: LocalGenerateParams): Promise<LocalGenerateResult> {
  return queue.run(() => run(params));
}
