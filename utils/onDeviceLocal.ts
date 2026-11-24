/**
 * The downloaded-model engine behind the `on-device` provider, with the same call shapes as the
 * Apple engine (`utils/onDeviceAi*.ts`) so `coachAI` picks one by `config.engine` and nothing else
 * differs. The runtime is required inline: importing this file never loads llama.rn.
 */
import type { LocalGenerateParams } from '@/services/localModels/llamaRuntime';
import type { ChatPenalties } from '@/utils/providerPolicy';

export type LocalMessage = { role: 'user' | 'assistant'; content: string };

function runtime(): typeof import('@/services/localModels/llamaRuntime') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/localModels/llamaRuntime');
}

function toMessages(messages: LocalMessage[], systemPrompt: string | undefined) {
  return [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...messages,
  ];
}

export async function sendLocalMessage(
  messages: LocalMessage[],
  systemPrompt: string | undefined,
  signal?: AbortSignal,
  penalties?: ChatPenalties
): Promise<string> {
  const result = await runtime().generateWithLocalModel({
    messages: toMessages(messages, systemPrompt),
    signal,
    penalties,
  });

  return result.text;
}

export async function streamLocalMessage(
  messages: LocalMessage[],
  systemPrompt: string | undefined,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
  penalties?: ChatPenalties
): Promise<string> {
  const result = await runtime().generateWithLocalModel({
    messages: toMessages(messages, systemPrompt),
    onDelta,
    signal,
    penalties,
  });

  return result.text;
}

/**
 * A reply constrained to `schema` by grammar, returned as the raw text. The caller parses and
 * validates it (`requestStructured`); this never trusts the engine to have honoured the schema.
 */
export async function sendLocalStructuredRaw(
  messages: LocalMessage[],
  systemPrompt: string | undefined,
  schema: object,
  options: Pick<
    LocalGenerateParams,
    'image' | 'signal' | 'maxTokens' | 'temperature' | 'onDelta'
  > = {}
): Promise<string> {
  const result = await runtime().generateWithLocalModel({
    messages: toMessages(messages, systemPrompt),
    schema,
    temperature: 0,
    ...options,
  });

  return result.text;
}
