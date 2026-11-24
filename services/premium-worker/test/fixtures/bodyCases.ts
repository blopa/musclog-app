// Inputs for the "OpenRouter body is byte-identical" pin (allowlist.test.ts). The expected strings
// in openrouterBodies.json were produced by allowlistRequest BEFORE the body split.
import type { AiConfig } from '../../src/config';
import { testConfig } from '../fakes/ctx';

const img = {
  role: 'user',
  content: [
    { type: 'text', text: 'what is this' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA', detail: 'low' } },
  ],
};
const schema = {
  type: 'json_schema',
  json_schema: { name: 'x', strict: true, schema: { type: 'object' } },
};

export const BODY_CASES: Record<string, { input: unknown; config: () => AiConfig }> = {
  chat: { input: { messages: [{ role: 'user', content: 'hi' }] }, config: () => testConfig() },
  chatFull: {
    input: {
      messages: [
        { role: 'system', content: 's' },
        { role: 'user', content: 'hi' },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 100,
      reasoning_effort: 'high',
      stop: ['a', 'b'],
      model: 'attacker/model',
      stream_options: { include_usage: true },
    },
    config: () => testConfig(),
  },
  structured: {
    input: { messages: [{ role: 'user', content: 'hi' }], response_format: schema },
    config: () => testConfig(),
  },
  tools: {
    input: {
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'f', parameters: { type: 'object' } } }],
      tool_choice: { type: 'function', function: { name: 'f' } },
      parallel_tool_calls: false,
    },
    config: () => testConfig(),
  },
  vision: {
    input: { messages: [img], reasoning_effort: 'medium' },
    config: () => testConfig({ vision_enabled: true, image: { tokens_max: 1000 } }),
  },
  pinnedProvider: {
    input: { messages: [{ role: 'user', content: 'hi' }] },
    config: () => testConfig({ provider: { only: ['deepinfra', 'acme'] } }),
  },
  noReasoning: {
    input: { messages: [{ role: 'user', content: 'hi' }], temperature: 2 },
    config: () => testConfig({ features: { chat: { reasoning: null, reasoning_max: null } } }),
  },
};
