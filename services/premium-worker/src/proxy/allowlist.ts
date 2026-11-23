// Request allowlist (plan 7 "Shape"): the client body is rebuilt field by field, never filtered
// by deletion, so nothing it sends reaches OpenRouter unless it is named here. Errors carry a
// field path and never the content.
import { type AiConfig, type Feature, REASONING_EFFORTS, type ReasoningEffort } from '../config';
import { ApiError } from '../http';

export interface AllowlistedRequest {
  /** Upstream body WITHOUT `user` (chat.ts adds it). */
  body: Record<string, unknown>;
  feature: Feature;
  stream: boolean;
  maxTokens: number;
  /** UTF-8 bytes of all message text, assistant tool-call arguments and tool results. */
  textBytes: number;
  images: number;
  /** UTF-8 bytes of JSON.stringify(response_format) + JSON.stringify(tools). */
  schemaToolsBytes: number;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const te = new TextEncoder();
const bytes = (s: string) => te.encode(s).length;

const bad = (path: string): never => {
  throw new ApiError(400, 'invalid_request', { path });
};

/** Rejects any key outside `allowed`, naming the first offender's path. */
function onlyKeys(o: Json, allowed: readonly string[], path: string): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) bad(path ? `${path}.${k}` : k);
}

const TOP_LEVEL = [
  'messages',
  'response_format',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'stream',
  'temperature',
  'max_tokens',
  'stop',
  'model',
  'stream_options',
  'reasoning_effort',
] as const;

const ROLES = ['system', 'user', 'assistant', 'tool'] as const;
const IMAGE_URL = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/;
const DETAILS = ['low', 'high', 'auto'];

function decodedBase64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

interface Acc {
  textBytes: number;
  images: number;
}

function parseContentParts(
  content: unknown[],
  role: string,
  path: string,
  config: AiConfig,
  acc: Acc
): unknown[] {
  if (content.length === 0) bad(path);
  return content.map((part, i) => {
    const pp = `${path}[${i}]`;
    if (!isObj(part)) return bad(pp);
    if (part.type === 'text') {
      onlyKeys(part, ['type', 'text'], pp);
      if (typeof part.text !== 'string') return bad(`${pp}.text`);
      acc.textBytes += bytes(part.text);
      return { type: 'text', text: part.text };
    }
    if (part.type === 'image_url') {
      if (role !== 'user') return bad(pp);
      onlyKeys(part, ['type', 'image_url'], pp);
      if (!config.vision_enabled) return bad(pp);
      if (!isObj(part.image_url)) return bad(`${pp}.image_url`);
      onlyKeys(part.image_url, ['url', 'detail'], `${pp}.image_url`);
      const url = part.image_url.url;
      if (typeof url !== 'string') return bad(`${pp}.image_url.url`);
      const m = IMAGE_URL.exec(url);
      if (!m) return bad(`${pp}.image_url.url`);
      if (decodedBase64Bytes(m[1]!) > config.image.max_bytes) return bad(`${pp}.image_url.url`);
      acc.images++;
      if (acc.images > config.image.max_images) return bad(pp);
      const image_url: Json = { url };
      if (part.image_url.detail !== undefined) {
        if (typeof part.image_url.detail !== 'string' || !DETAILS.includes(part.image_url.detail))
          return bad(`${pp}.image_url.detail`);
        image_url.detail = part.image_url.detail;
      }
      return { type: 'image_url', image_url };
    }
    return bad(`${pp}.type`);
  });
}

function parseMessage(m: unknown, i: number, config: AiConfig, acc: Acc): Json {
  const path = `messages[${i}]`;
  if (!isObj(m)) return bad(path);
  const role = m.role;
  if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role))
    return bad(`${path}.role`);

  if (role === 'tool') {
    onlyKeys(m, ['role', 'tool_call_id', 'content'], path);
    if (typeof m.tool_call_id !== 'string') return bad(`${path}.tool_call_id`);
    if (typeof m.content !== 'string') return bad(`${path}.content`);
    acc.textBytes += bytes(m.content);
    return { role, tool_call_id: m.tool_call_id, content: m.content };
  }

  if (role === 'assistant') {
    onlyKeys(m, ['role', 'content', 'tool_calls'], path);
    const out: Json = { role };
    const hasCalls = m.tool_calls !== undefined;
    if (typeof m.content === 'string') {
      acc.textBytes += bytes(m.content);
      out.content = m.content;
    } else if (m.content === null && hasCalls) out.content = null;
    else return bad(`${path}.content`);
    if (hasCalls) {
      if (!Array.isArray(m.tool_calls) || m.tool_calls.length === 0)
        return bad(`${path}.tool_calls`);
      out.tool_calls = m.tool_calls.map((c: unknown, j: number) => {
        const cp = `${path}.tool_calls[${j}]`;
        if (!isObj(c)) return bad(cp);
        onlyKeys(c, ['id', 'type', 'function'], cp);
        if (typeof c.id !== 'string') return bad(`${cp}.id`);
        if (c.type !== 'function') return bad(`${cp}.type`);
        if (!isObj(c.function)) return bad(`${cp}.function`);
        onlyKeys(c.function, ['name', 'arguments'], `${cp}.function`);
        if (typeof c.function.name !== 'string') return bad(`${cp}.function.name`);
        if (typeof c.function.arguments !== 'string') return bad(`${cp}.function.arguments`);
        acc.textBytes += bytes(c.function.arguments);
        return {
          id: c.id,
          type: 'function',
          function: { name: c.function.name, arguments: c.function.arguments },
        };
      });
    }
    return out;
  }

  // system | user
  onlyKeys(m, ['role', 'content'], path);
  if (typeof m.content === 'string') {
    acc.textBytes += bytes(m.content);
    return { role, content: m.content };
  }
  if (Array.isArray(m.content))
    return { role, content: parseContentParts(m.content, role, `${path}.content`, config, acc) };
  return bad(`${path}.content`);
}

function parseResponseFormat(v: unknown, config: AiConfig): Json {
  if (!isObj(v)) return bad('response_format');
  onlyKeys(v, ['type', 'json_schema'], 'response_format');
  if (v.type !== 'json_schema') return bad('response_format.type');
  const js = v.json_schema;
  if (!isObj(js)) return bad('response_format.json_schema');
  onlyKeys(js, ['name', 'schema', 'strict', 'description'], 'response_format.json_schema');
  if (typeof js.name !== 'string') return bad('response_format.json_schema.name');
  if (!isObj(js.schema)) return bad('response_format.json_schema.schema');
  if (js.strict !== undefined && typeof js.strict !== 'boolean')
    return bad('response_format.json_schema.strict');
  if (js.description !== undefined && typeof js.description !== 'string')
    return bad('response_format.json_schema.description');
  const out: Json = {
    type: 'json_schema',
    json_schema: pick(js, ['name', 'schema', 'strict', 'description']),
  };
  if (bytes(JSON.stringify(out)) > config.limits.response_format_max_bytes)
    return bad('response_format');
  return out;
}

function pick(o: Json, keys: string[]): Json {
  const out: Json = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

function parseTools(v: unknown, config: AiConfig): Json[] {
  if (!Array.isArray(v)) return bad('tools');
  if (v.length > config.limits.max_tools) return bad('tools');
  return v.map((t: unknown, i: number) => {
    const p = `tools[${i}]`;
    if (!isObj(t)) return bad(p);
    onlyKeys(t, ['type', 'function'], p);
    if (t.type !== 'function') return bad(`${p}.type`);
    if (!isObj(t.function)) return bad(`${p}.function`);
    const f = t.function;
    onlyKeys(f, ['name', 'description', 'parameters', 'strict'], `${p}.function`);
    if (typeof f.name !== 'string') return bad(`${p}.function.name`);
    if (f.description !== undefined && typeof f.description !== 'string')
      return bad(`${p}.function.description`);
    if (f.parameters !== undefined && !isObj(f.parameters)) return bad(`${p}.function.parameters`);
    if (f.strict !== undefined && typeof f.strict !== 'boolean') return bad(`${p}.function.strict`);
    return {
      type: 'function',
      function: pick(f, ['name', 'description', 'parameters', 'strict']),
    };
  });
}

function parseToolChoice(v: unknown): unknown {
  if (v === 'auto' || v === 'none' || v === 'required') return v;
  if (!isObj(v)) return bad('tool_choice');
  onlyKeys(v, ['type', 'function'], 'tool_choice');
  if (v.type !== 'function') return bad('tool_choice.type');
  if (!isObj(v.function)) return bad('tool_choice.function');
  onlyKeys(v.function, ['name'], 'tool_choice.function');
  if (typeof v.function.name !== 'string') return bad('tool_choice.function.name');
  return { type: 'function', function: { name: v.function.name } };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * The `reasoning.effort` sent upstream. The client may ask for a level (`reasoning_effort`), never
 * above the feature's ceiling (`reasoning_max`, else `reasoning`); asking for none gets the feature's
 * default. A feature with no ceiling sends no reasoning whatever the client asks. Pure, so the same
 * rule is tested without a request.
 */
export function effectiveReasoning(
  limits: { reasoning: ReasoningEffort | null; reasoning_max?: ReasoningEffort | null },
  requested: ReasoningEffort | undefined
): ReasoningEffort | null {
  const ceiling = limits.reasoning_max === undefined ? limits.reasoning : limits.reasoning_max;
  if (ceiling === null) {
    return null;
  }

  if (requested === undefined) {
    return limits.reasoning;
  }

  return REASONING_EFFORTS.indexOf(requested) <= REASONING_EFFORTS.indexOf(ceiling)
    ? requested
    : ceiling;
}

/**
 * Runtime guard for the Premium privacy invariant: account-level ZDR is off at OpenRouter, so this
 * per-request `provider` object is the only thing keeping a request off providers that retain or
 * train on data. Throws (never sends) when any of the three fields is missing or different.
 */
export function assertPremiumPrivacy(body: Record<string, unknown>): void {
  const p = body.provider;
  if (!isObj(p) || p.zdr !== true || p.data_collection !== 'deny' || p.allow_fallbacks !== false) {
    throw new Error('premium_privacy_invariant_violated');
  }
}

export function allowlistRequest(input: unknown, config: AiConfig): AllowlistedRequest {
  if (!isObj(input)) return bad('body');
  onlyKeys(input, TOP_LEVEL, '');

  if (!Array.isArray(input.messages)) return bad('messages');
  if (input.messages.length < 1 || input.messages.length > config.limits.max_messages)
    return bad('messages');
  const acc: Acc = { textBytes: 0, images: 0 };
  const messages = input.messages.map((m: unknown, i: number) => parseMessage(m, i, config, acc));

  let responseFormat: Json | undefined;
  if (input.response_format !== undefined)
    responseFormat = parseResponseFormat(input.response_format, config);
  let tools: Json[] | undefined;
  if (input.tools !== undefined) tools = parseTools(input.tools, config);
  let toolChoice: unknown;
  if (input.tool_choice !== undefined) toolChoice = parseToolChoice(input.tool_choice);
  if (input.parallel_tool_calls !== undefined && typeof input.parallel_tool_calls !== 'boolean')
    return bad('parallel_tool_calls');
  if (input.stream !== undefined && typeof input.stream !== 'boolean') return bad('stream');
  const stream = input.stream === true;

  let stop: string | string[] | undefined;
  if (input.stop !== undefined) {
    if (typeof input.stop === 'string') stop = input.stop;
    else if (
      Array.isArray(input.stop) &&
      input.stop.length <= config.limits.max_stop &&
      input.stop.every((s: unknown) => typeof s === 'string')
    )
      stop = input.stop as string[];
    else return bad('stop');
  }

  let requestedReasoning: ReasoningEffort | undefined;
  if (input.reasoning_effort !== undefined) {
    if (
      typeof input.reasoning_effort !== 'string' ||
      !(REASONING_EFFORTS as readonly string[]).includes(input.reasoning_effort)
    )
      return bad('reasoning_effort');
    requestedReasoning = input.reasoning_effort as ReasoningEffort;
  }

  if (input.temperature !== undefined && !finite(input.temperature)) return bad('temperature');
  if (input.max_tokens !== undefined && !finite(input.max_tokens)) return bad('max_tokens');

  const feature: Feature =
    acc.images > 0 ? 'vision' : responseFormat !== undefined ? 'structured' : 'chat';
  const limits = config.features[feature];

  // A higher effort spends more of the budget thinking, so it may get a larger `max_tokens`.
  const reasoning = effectiveReasoning(limits, requestedReasoning);
  const tokenLimit =
    (reasoning === null ? undefined : limits.max_tokens_by_effort?.[reasoning]) ??
    limits.max_tokens;
  const maxTokens =
    input.max_tokens === undefined
      ? tokenLimit
      : Math.min(tokenLimit, Math.max(1, Math.floor(input.max_tokens as number)));

  const { prices, provider } = config;
  const body: Record<string, unknown> = {
    model: config.model,
    provider: {
      zdr: true,
      data_collection: 'deny',
      require_parameters: true,
      allow_fallbacks: false,
      max_price: {
        prompt: prices.prompt_per_mtok,
        completion: prices.completion_per_mtok,
        image: prices.image_per_image,
      },
      ...(provider.only ? { only: provider.only, order: provider.only } : {}),
    },
    messages,
    stream,
    max_tokens: maxTokens,
  };
  assertPremiumPrivacy(body);
  if (input.temperature !== undefined)
    body.temperature = Math.min(limits.temperature_max, Math.max(0, input.temperature as number));
  if (reasoning !== null) body.reasoning = { effort: reasoning };
  if (responseFormat) body.response_format = responseFormat;
  if (tools) body.tools = tools;
  if (toolChoice !== undefined) body.tool_choice = toolChoice;
  if (input.parallel_tool_calls !== undefined) body.parallel_tool_calls = input.parallel_tool_calls;
  if (stop !== undefined) body.stop = stop;

  return {
    body,
    feature,
    stream,
    maxTokens,
    textBytes: acc.textBytes,
    images: acc.images,
    schemaToolsBytes:
      (responseFormat ? bytes(JSON.stringify(responseFormat)) : 0) +
      (tools ? bytes(JSON.stringify(tools)) : 0),
  };
}
