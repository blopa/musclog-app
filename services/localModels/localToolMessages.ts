/**
 * Pure mapping between the runtime's tool types and the OpenAI-shaped wire format that llama.cpp
 * (through llama.rn) and a desktop llama-server both speak. Shared by the native and web runtimes.
 * Type-only imports: no react-native, no llama.rn.
 */
import type { LocalChatMessage, LocalToolCall, LocalToolDefinition } from './llamaRuntime';

/**
 * An LFM-style template (it lists tools) that never reads `tool_calls` renders only `content`, so an
 * example call sent as `tool_calls` reached the model as an empty assistant turn.
 */
function templateDropsToolCalls(template: unknown): boolean {
  return (
    typeof template === 'string' &&
    template.includes('List of tools:') &&
    !template.includes('tool_calls')
  );
}

function callsAsText(calls: LocalToolCall[]): string {
  const rendered = calls.map((call) => {
    const args = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
    const pairs = Object.entries(args).map(([key, value]) => `${key}=${JSON.stringify(value)}`);

    return `${call.name}(${pairs.join(', ')})`;
  });

  return `<|tool_call_start|>[${rendered.join(', ')}]<|tool_call_end|>`;
}

/**
 * llama.rn JSON-stringifies the messages it is given, so the OpenAI-shaped `tool_calls` and
 * `tool_call_id` reach llama.cpp even though its TypeScript message type declares only role and content.
 * For a template that drops `tool_calls` (see `templateDropsToolCalls`) the calls are written as text.
 */
export function toEngineMessages(messages: LocalChatMessage[], template?: unknown) {
  const asText = templateDropsToolCalls(template);

  return messages.map((message) => {
    if (message.role === 'assistant' && message.toolCalls?.length) {
      if (asText) {
        return {
          role: 'assistant' as const,
          content: callsAsText(message.toolCalls) + message.content,
        };
      }

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

/**
 * llama.cpp (b10256, the build inside llama.rn 0.12.9) picks its LFM2.5 tool-call parser only when
 * the chat template's SOURCE holds the literal `List of tools: [`. LFM2.5-VL-450M's template builds
 * that line as `"List of tools: " + (tools | tojson)`, so it fell to the generic parser, whose
 * grammar llama.cpp cannot even parse: every request with tools failed with "Failed to initialize
 * sampling". Returns the template with the literal in a comment (the rendered prompt is the same),
 * or undefined when the model's own template needs no help.
 */
export function toolTemplateOverride(template: unknown): string | undefined {
  if (
    typeof template !== 'string' ||
    !template.includes('List of tools:') ||
    template.includes('List of tools: [') ||
    template.includes('<|tool_list_start|>')
  ) {
    return undefined;
  }

  return `${template}{#- List of tools: [ -#}`;
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
