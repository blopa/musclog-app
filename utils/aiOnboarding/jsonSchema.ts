import { z } from 'zod';

import {
  CONTRACT_MAJOR,
  CONTRACT_SCHEMA_ID,
  contractDocumentSchema,
} from '@/utils/aiOnboarding/contract';

/**
 * The compact, versioned JSON Schema handed to external assistants. Built from the same zod
 * pieces the app validates with, so the document an assistant is told to write and the document
 * Musclog accepts cannot drift apart.
 */
export function buildContractJsonSchema(): Record<string, unknown> {
  const generated = z.toJSONSchema(contractDocumentSchema, { io: 'input' }) as Record<
    string,
    unknown
  >;
  const properties = { ...(generated.properties as Record<string, unknown>) };
  properties.schema = { const: CONTRACT_SCHEMA_ID };
  properties.version = { const: CONTRACT_MAJOR };

  return {
    ...generated,
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://musclog.app/schemas/onboarding/v${CONTRACT_MAJOR}.json`,
    title: 'Musclog onboarding',
    properties,
    // The birthday may be given as a date or, when the person only knows their age, as an age.
    anyOf: [{ required: ['birthDate'] }, { required: ['ageYears'] }],
  };
}
