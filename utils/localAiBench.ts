/**
 * The pure half of the on-device AI bench (`app/app/test/local-ai-bench.tsx`): what a scenario
 * file may hold and how a reply is scored against it. No engine, no React Native, so a Jest test
 * checks the scoring offline with a fake reply.
 */
import { validateAgainstSchema } from '@/utils/aiSchemaValidate';

export type BenchExpect = {
  mealType?: string;
  /** Lowercase fragments each of which must appear in some returned food name. */
  foodNamesInclude?: string[];
  /** Relative tolerance on `grams` against `gramsExpected`. */
  gramsWithin?: number;
  gramsExpected?: number;
  nonEmpty?: boolean;
};

export type BenchScenario = {
  id: string;
  language: 'en' | 'pt';
  kind: 'structured' | 'text' | 'photo';
  label: string;
  systemPrompt: string;
  userMessage: string;
  schema?: object;
  expect: BenchExpect;
};

export type BenchScenarioFile = {
  version: number;
  notSupported: string[];
  scenarios: BenchScenario[];
};

export type BenchScore = {
  /** The reply is valid JSON that matches the scenario's schema (structured only). */
  schemaValid: boolean | null;
  /** Every field rule the scenario names holds. */
  fieldsCorrect: boolean | null;
  problems: string[];
};

/** Problems with a scenario file itself, so a typo never reads as a model failure. */
export function scenarioFileProblems(file: BenchScenarioFile): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const scenario of file.scenarios) {
    if (seen.has(scenario.id)) {
      problems.push(`${scenario.id}: duplicate id`);
    }

    seen.add(scenario.id);
    if (scenario.kind === 'structured' && !scenario.schema) {
      problems.push(`${scenario.id}: a structured scenario needs a schema`);
    }

    if (!scenario.userMessage.trim() || !scenario.systemPrompt.trim()) {
      problems.push(`${scenario.id}: empty prompt`);
    }
  }

  return problems;
}

type Food = { name?: unknown; grams?: unknown };

/** Scores one reply. `reply` is the parsed JSON (structured) or the text (text, photo). */
export function scoreScenario(scenario: BenchScenario, reply: unknown): BenchScore {
  const problems: string[] = [];
  const { expect } = scenario;

  if (scenario.kind === 'structured') {
    const check = validateAgainstSchema(reply, scenario.schema);
    if (!check.ok) {
      return {
        schemaValid: false,
        fieldsCorrect: false,
        problems: [`${check.path}: ${check.message}`],
      };
    }

    const value = reply as { mealType?: unknown; foods?: Food[] };
    if (expect.mealType && value.mealType !== expect.mealType) {
      problems.push(`mealType is ${String(value.mealType)}, expected ${expect.mealType}`);
    }

    const names = (value.foods ?? []).map((food) => String(food.name ?? '').toLowerCase());
    for (const fragment of expect.foodNamesInclude ?? []) {
      if (!names.some((name) => name.includes(fragment.toLowerCase()))) {
        problems.push(`no food named like "${fragment}"`);
      }
    }

    if (expect.gramsExpected !== undefined) {
      const tolerance = expect.gramsWithin ?? 0.25;
      for (const food of value.foods ?? []) {
        const grams = Number(food.grams);
        if (Math.abs(grams - expect.gramsExpected) > expect.gramsExpected * tolerance) {
          problems.push(`${String(food.name)}: ${grams} g is outside ±${tolerance * 100}%`);
        }
      }
    }

    return { schemaValid: true, fieldsCorrect: problems.length === 0, problems };
  }

  if (expect.nonEmpty && (typeof reply !== 'string' || reply.trim() === '')) {
    problems.push('empty reply');
  }

  return { schemaValid: null, fieldsCorrect: problems.length === 0, problems };
}
