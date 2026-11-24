/**
 * Web counterpart of `llamaRuntime.ts`. llama.rn is native, so on web this only works under the
 * development server, where it forwards to a desktop `llama-server` (see `devWebBridge.ts`).
 * Anywhere else it reports the model as unavailable. Same exports as the native file
 * (`platformModuleParity`).
 */
import { AiCancelledError, OnDeviceUnavailableError } from '@/utils/aiErrors';

import { devLocalModelBaseUrl, isDevWebLocalModel } from './devWebBridge';
import type { LocalChatMessage, LocalGenerateParams, LocalGenerateResult } from './llamaRuntime';

export type { LocalChatMessage, LocalGenerateParams, LocalGenerateResult };

export const LOCAL_MODEL_IDLE_MS = 120_000;

let queue: Promise<unknown> = Promise.resolve();
let loaded = false;

export async function unloadLocalModel(): Promise<void> {
  loaded = false;
}

export function isLocalModelLoaded(): boolean {
  return loaded;
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
  if (!isDevWebLocalModel()) {
    throw new OnDeviceUnavailableError('notReady');
  }

  if (params.signal?.aborted) {
    throw new AiCancelledError();
  }

  const body = {
    messages: params.image ? withPhoto(params.messages, params.image) : params.messages,
    max_tokens: params.maxTokens ?? 1024,
    temperature: params.temperature ?? 0.2,
    stream: false,
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
    choices?: { message?: { content?: string } }[];
    timings?: {
      prompt_ms?: number;
      predicted_ms?: number;
      prompt_per_second?: number;
      predicted_per_second?: number;
    };
  };
  const reply = json.choices?.[0]?.message?.content ?? '';
  params.onDelta?.(reply);
  console.info('[devLocalModel] reply in', Date.now() - startedAt, 'ms:', reply);

  return {
    text: reply,
    timings: {
      promptMs: json.timings?.prompt_ms,
      predictedMs: json.timings?.predicted_ms,
      promptPerSecond: json.timings?.prompt_per_second,
      predictedPerSecond: json.timings?.predicted_per_second,
    },
  };
}

export function generateWithLocalModel(params: LocalGenerateParams): Promise<LocalGenerateResult> {
  const turn = queue.then(
    () => run(params),
    () => run(params)
  );
  queue = turn.catch(() => undefined);

  return turn;
}
