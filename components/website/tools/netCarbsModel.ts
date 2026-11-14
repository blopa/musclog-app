import { digestibleCarbs, totalCarbsFromSource } from '@/utils/carbsConvention';

import { isInRange, parseToolNumber } from './toolNumbers';

/** Grams are read per 100 g or per serving as printed; no label in practice exceeds this. */
const MAX_GRAMS = 1000;

/**
 * The two label conventions. `total` is a US or Canadian label, whose carbohydrate line already
 * includes fiber. `net` is an EU or UK label, whose carbohydrate excludes fiber (fiber is declared
 * separately).
 */
export type NetCarbsConvention = 'total' | 'net';

export interface NetCarbsInput {
  convention: NetCarbsConvention;
  carbsText: string;
  fiberText: string;
}

export type NetCarbsProblem = 'carbs' | 'fiber' | 'fiberTooHigh';

export interface NetCarbsResult {
  /** Carbohydrate including fiber: the figure Musclog stores for a food. */
  totalCarbs: number;
  /** Carbohydrate excluding fiber: the digestible figure a net-carb tracker expects. */
  netCarbs: number;
  fiber: number;
}

export type NetCarbsValidation =
  { ok: true; result: NetCarbsResult } | { ok: false; problem: NetCarbsProblem | null };

/**
 * Converts a label's reading with the app's own carbs convention helpers, so the total and net
 * figures match what the app stores and what a food's diary shows.
 */
export function netCarbsResult(input: NetCarbsInput): NetCarbsValidation {
  if (input.carbsText.trim() === '' || input.fiberText.trim() === '') {
    return { ok: false, problem: null };
  }

  const carbs = parseToolNumber(input.carbsText);
  if (!isInRange(carbs, 0, MAX_GRAMS)) {
    return { ok: false, problem: 'carbs' };
  }

  const fiber = parseToolNumber(input.fiberText);
  if (!isInRange(fiber, 0, MAX_GRAMS)) {
    return { ok: false, problem: 'fiber' };
  }

  if (input.convention === 'total' && fiber > carbs) {
    return { ok: false, problem: 'fiberTooHigh' };
  }

  const totalCarbs = totalCarbsFromSource(input.convention, { carbs, fiber });
  return {
    ok: true,
    result: { totalCarbs, netCarbs: digestibleCarbs(totalCarbs, fiber), fiber },
  };
}
