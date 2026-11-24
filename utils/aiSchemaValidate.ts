/**
 * A small, pure JSON Schema checker for the subset our function declarations use: `type` (a name or
 * a list, any letter case, so the Gemini dialect's `OBJECT` works), `nullable`, `properties`,
 * `required`, `enum`, `items`, `minimum`/`maximum` and `minItems`/`maxItems`. Anything it does not
 * know passes, so a schema keyword added later never turns a good answer into a failure.
 *
 * Why it exists: grammar-constrained decoding guarantees the SHAPE of what a small on-device model
 * writes, not that the engine honoured it (a runtime can fall back to free text), and no model
 * output may reach a feature's normalizers unchecked. It is the first of three gates; the feature
 * normalizers check meaning and the review screens leave the last word to the person.
 */

export type SchemaCheck = { ok: true } | { ok: false; path: string; message: string };

type Schema = {
  type?: string | string[];
  nullable?: boolean;
  properties?: Record<string, unknown>;
  required?: string[];
  enum?: unknown[];
  items?: unknown;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};

const OK: SchemaCheck = { ok: true };

function fail(path: string, message: string): SchemaCheck {
  return { ok: false, path: path || '$', message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesType(name: string, value: unknown): boolean {
  switch (name.toLowerCase()) {
    case 'object':
      return isPlainObject(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      // An unknown type name is not something we can judge.
      return true;
  }
}

export function validateAgainstSchema(value: unknown, schema: unknown, path = ''): SchemaCheck {
  if (!isPlainObject(schema)) {
    return OK;
  }

  const rules = schema as Schema;

  if (value === null && rules.nullable === true) {
    return OK;
  }

  if (rules.type !== undefined) {
    const names = Array.isArray(rules.type) ? rules.type : [rules.type];
    if (!names.some((name) => typeof name === 'string' && matchesType(name, value))) {
      return fail(path, `expected ${names.join(' or ')}`);
    }
  }

  if (Array.isArray(rules.enum) && !rules.enum.some((option) => option === value)) {
    return fail(path, 'not one of the allowed values');
  }

  if (typeof value === 'number') {
    if (typeof rules.minimum === 'number' && value < rules.minimum) {
      return fail(path, `below ${rules.minimum}`);
    }

    if (typeof rules.maximum === 'number' && value > rules.maximum) {
      return fail(path, `above ${rules.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof rules.minItems === 'number' && value.length < rules.minItems) {
      return fail(path, `fewer than ${rules.minItems} items`);
    }

    if (typeof rules.maxItems === 'number' && value.length > rules.maxItems) {
      return fail(path, `more than ${rules.maxItems} items`);
    }

    if (rules.items !== undefined) {
      for (let index = 0; index < value.length; index += 1) {
        const result = validateAgainstSchema(value[index], rules.items, `${path}[${index}]`);
        if (!result.ok) {
          return result;
        }
      }
    }
  }

  if (isPlainObject(value)) {
    for (const key of rules.required ?? []) {
      if (!(key in value) || value[key] === undefined) {
        return fail(path ? `${path}.${key}` : key, 'missing');
      }
    }

    for (const [key, childSchema] of Object.entries(rules.properties ?? {})) {
      if (key in value && value[key] !== undefined) {
        const result = validateAgainstSchema(
          value[key],
          childSchema,
          path ? `${path}.${key}` : key
        );
        if (!result.ok) {
          return result;
        }
      }
    }
  }

  return OK;
}
