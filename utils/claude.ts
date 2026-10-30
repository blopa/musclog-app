import Anthropic from '@anthropic-ai/sdk';

import type { ChatHistoryEntry } from './coachAI';

/**
 * Anthropic Claude plumbing: the client, the message shape and the reply text. The request loops
 * (retry, timeout, streaming) stay in `coachAI.ts` beside the other providers, which is why this
 * module only holds what has no dependency on them.
 */

/** Non-streaming ceiling: thinking tokens count against it, and it stays under SDK HTTP timeouts. */
export const CLAUDE_MAX_TOKENS = 16_000;

/** A streamed reply has no timeout pressure, so the model gets room to think and answer. */
export const CLAUDE_STREAM_MAX_TOKENS = 64_000;

export type ClaudeEffort = 'low' | 'high';

/**
 * Claude 5.5 models always think and there is no way to turn it off, only to ask for less. Chat and
 * extraction want a quick answer; the user's thinking-mode setting is the explicit way to ask for
 * more.
 */
export function claudeEffort(useThinkingMode: boolean): ClaudeEffort {
  return useThinkingMode ? 'high' : 'low';
}

/**
 * `dangerouslyAllowBrowser` is required on web and harmless on native: the key is the user's own,
 * entered in Settings and stored encrypted, so it is never a shared secret shipped in the bundle.
 */
export function buildClaudeClient(apiKey: string | undefined, maxRetries?: number): Anthropic {
  return new Anthropic({
    apiKey: apiKey ?? 'unused',
    dangerouslyAllowBrowser: true,
    ...(maxRetries === undefined ? {} : { maxRetries }),
  });
}

/**
 * The conversation as Claude takes it: it must start with a user turn, and turns alternate. Empty
 * entries are dropped, consecutive entries of one role are merged (the same normalisation Gemini
 * needs), and a leading coach message, such as the seeded welcome, is left out.
 */
export function buildClaudeMessages(
  history: ChatHistoryEntry[],
  userContent: string | Anthropic.ContentBlockParam[]
): Anthropic.MessageParam[] {
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const entry of history) {
    const content = entry.content.trim();
    if (!content) {
      continue;
    }

    const role = entry.role === 'coach' ? 'assistant' : 'user';
    const previous = merged[merged.length - 1];
    if (previous && previous.role === role) {
      previous.content = `${previous.content}\n${content}`;
    } else {
      merged.push({ role, content });
    }
  }

  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift();
  }

  // A user turn right before the new one is the same turn as far as Claude is concerned.
  const last = merged[merged.length - 1];
  if (last?.role === 'user' && typeof userContent === 'string') {
    last.content = `${last.content}\n${userContent}`;
    return merged;
  }

  return [...merged, { role: 'user', content: userContent }];
}

export type ClaudeReplyText = {
  text: string;
  stopReason: Anthropic.Message['stop_reason'];
};

/** The visible answer: the text blocks joined, never a thinking block. */
export function extractClaudeText(message: Anthropic.Message): ClaudeReplyText {
  const text = message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');

  if (!text.trim() && message.stop_reason) {
    // An empty answer has several causes; say which, so "analyzing forever" is debuggable.
    console.warn(`[coachAI] Claude returned no answer text (stopReason=${message.stop_reason})`);
  }

  return { text, stopReason: message.stop_reason };
}

/** The `text_delta` of a streamed event, or `null` for every other event. */
export function claudeStreamDelta(event: Anthropic.MessageStreamEvent): string | null {
  return event.type === 'content_block_delta' && event.delta.type === 'text_delta'
    ? event.delta.text
    : null;
}
