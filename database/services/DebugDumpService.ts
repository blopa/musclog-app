import { database } from '@/database/database-instance';
import DebugDump, { type DebugDumpDirection } from '@/database/models/DebugDump';

import SettingsService from './SettingsService';

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function sanitizeString(value: string, secrets: string[]): string {
  let next = value;

  for (const secret of secrets) {
    if (!secret) {
      continue;
    }

    next = next.split(secret).join('REDACTED');
  }

  return next.replace(/Bearer\s+([^\s",]+)/gi, 'Bearer REDACTED');
}

function sanitizeValue(value: unknown, secrets: string[]): JsonLike {
  if (value === undefined) {
    return null;
  }

  if (value == null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value, secrets);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, secrets));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, JsonLike> = {};

    for (const [key, nestedValue] of Object.entries(record)) {
      if (
        key === 'apiKey' ||
        key === 'api_key' ||
        key === 'Authorization' ||
        key === 'authorization' ||
        key === 'x-goog-api-key'
      ) {
        sanitized[key] = 'REDACTED';
        continue;
      }

      sanitized[key] = sanitizeValue(nestedValue, secrets);
    }

    return sanitized;
  }

  return sanitizeString(String(value), secrets);
}

function toSerializablePayload(payload: unknown): JsonLike {
  if (payload == null) {
    return null;
  }

  try {
    return JSON.parse(
      JSON.stringify(payload, (_key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }

        if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
          return undefined;
        }

        return value;
      })
    ) as JsonLike;
  } catch {
    return { value: String(payload) };
  }
}

export class DebugDumpService {
  static async getDumpLlmRequests(): Promise<boolean> {
    return SettingsService.getDumpLlmRequests();
  }

  static async logJsonEvent(params: {
    provider: string;
    direction: DebugDumpDirection;
    operation: string;
    payload: unknown;
    secrets?: string[];
  }): Promise<void> {
    const shouldDump = await DebugDumpService.getDumpLlmRequests();
    if (!shouldDump) {
      return;
    }

    const settingsSecrets = await Promise.all([
      SettingsService.getGoogleGeminiApiKey(),
      SettingsService.getOpenAiApiKey(),
      SettingsService.getLocalLlmApiKey(),
    ]);

    const secrets = [...settingsSecrets, ...(params.secrets ?? [])]
      .map((secret) => secret?.trim())
      .filter((secret): secret is string => Boolean(secret));

    const sanitizedPayload = sanitizeValue(toSerializablePayload(params.payload), secrets);
    const now = Date.now();

    await database.write(async () => {
      await database.get<DebugDump>('debug_dump').create((record) => {
        record.provider = params.provider;
        record.direction = params.direction;
        record.operation = params.operation;
        record.payloadJson = JSON.stringify(sanitizedPayload);
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }
}

export default DebugDumpService;
