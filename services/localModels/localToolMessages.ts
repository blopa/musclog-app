/**
 * Pure mapping between the runtime's tool types and the OpenAI-shaped wire format that llama.cpp
 * (through llama.rn) and a desktop llama-server both speak. Shared by the native and web runtimes.
 * Type-only imports: no react-native, no llama.rn.
 */
import type { LocalChatMessage, LocalToolCall, LocalToolDefinition } from './llamaRuntime';

/**
 * llama.rn JSON-stringifies the messages it is given, so the OpenAI-shaped `tool_calls` and
 * `tool_call_id` reach llama.cpp even though its TypeScript message type declares only role and content.
 */
export function toEngineMessages(messages: LocalChatMessage[]) {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant' as const,
        content: message.content,
        tool_calls: message.toolCalls.map((call, index) => ({
          id: call.id ?? `call_${index}`,
          type: 'function' as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }

    if (message.role === 'tool') {
      return { role: 'tool' as const, content: message.content, tool_call_id: message.toolCallId };
    }

    return { role: message.role, content: message.content };
  });
}

export function toEngineTools(tools: LocalToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

export function readToolCalls(raw: unknown): LocalToolCall[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const calls: LocalToolCall[] = [];
  for (const entry of raw as {
    id?: string;
    function?: { name?: string; arguments?: unknown };
  }[]) {
    const name = entry?.function?.name;
    if (!name) {
      continue;
    }

    const args = entry.function?.arguments;
    calls.push({
      ...(entry.id ? { id: entry.id } : {}),
      name,
      arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
    });
  }

  return calls;
}
