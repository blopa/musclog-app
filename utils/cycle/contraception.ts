import type { ContraceptionMethod, CycleContextDto, CycleLifeStage } from './types';

export interface ContraceptionTraits {
  hormonal: 'yes' | 'no' | 'unknown';
  /** How often the method stops ovulation, which is what a cycle-length estimate relies on. */
  ovulationSuppressed: 'usually' | 'sometimes' | 'no';
}

/**
 * One row per method. A `Record` so adding a method fails the build until its traits are
 * decided. Sources: NICHD contraception overview; combined methods usually stop ovulation, a
 * hormonal IUD or progestin-only pill often does not, a copper IUD never does.
 */
export const CONTRACEPTION_TRAITS: Record<ContraceptionMethod, ContraceptionTraits> = {
  none: { hormonal: 'no', ovulationSuppressed: 'no' },
  combined_pill: { hormonal: 'yes', ovulationSuppressed: 'usually' },
  progestin_pill: { hormonal: 'yes', ovulationSuppressed: 'sometimes' },
  pill_unspecified: { hormonal: 'yes', ovulationSuppressed: 'usually' },
  hormonal_iud: { hormonal: 'yes', ovulationSuppressed: 'sometimes' },
  copper_iud: { hormonal: 'no', ovulationSuppressed: 'no' },
  iud_unspecified: { hormonal: 'unknown', ovulationSuppressed: 'sometimes' },
  implant: { hormonal: 'yes', ovulationSuppressed: 'usually' },
  patch: { hormonal: 'yes', ovulationSuppressed: 'usually' },
  ring: { hormonal: 'yes', ovulationSuppressed: 'usually' },
  injection: { hormonal: 'yes', ovulationSuppressed: 'usually' },
  other: { hormonal: 'unknown', ovulationSuppressed: 'sometimes' },
};

export const CONTRACEPTION_METHODS = Object.keys(CONTRACEPTION_TRAITS) as ContraceptionMethod[];

export const DEFAULT_CONTEXT: Pick<CycleContextDto, 'lifeStage' | 'contraception'> = {
  lifeStage: 'regular',
  contraception: 'none',
};

export type SuppressionReason = 'hormonal' | 'postpartum' | 'no_bleeding';

export interface ContextGuidance {
  /** Why period predictions are not shown, or null when they are. */
  suppressedReason: SuppressionReason | null;
  /** Whether an ovulation / fertile-window estimate means anything in this context. */
  fertilityMeaningful: boolean;
  /** Hormonal methods that only sometimes stop ovulation: predictions stay but are caveated. */
  predictionsCaveated: boolean;
  /** Variability is expected (perimenopause, PCOS) and shown as information, not low quality. */
  variabilityIsExpected: boolean;
  hidePeriodActions: boolean;
  /** Cycles starting in this context should not feed predictions for a natural cycle. */
  excludesCycles: 'hormonal_context' | 'postpartum_context' | null;
}

/** The context in force on `day`: the latest one that has started, or the default. */
export function contextAt(contexts: CycleContextDto[], day: number): CycleContextDto | null {
  return contexts.reduce<CycleContextDto | null>(
    (acc, c) =>
      c.effectiveFrom <= day && (!acc || c.effectiveFrom >= acc.effectiveFrom) ? c : acc,
    null
  );
}

const FERTILITY_STAGES: ReadonlySet<CycleLifeStage> = new Set(['regular']);

/** Postpartum cycles need this many logged periods before a prediction means anything. */
export const POSTPARTUM_PERIODS_REQUIRED = 2;

/**
 * What a context changes. The stored method and stage used to be display-only, with a warning
 * above unchanged predictions; this makes them decide which predictions exist at all.
 */
export function contextGuidance(
  context: Pick<CycleContextDto, 'lifeStage' | 'contraception'> | null,
  options: { periodsSinceContext?: number } = {}
): ContextGuidance {
  const { lifeStage, contraception } = context ?? DEFAULT_CONTEXT;
  const traits = CONTRACEPTION_TRAITS[contraception];
  const periodsSince = options.periodsSinceContext ?? 0;

  let suppressedReason: SuppressionReason | null = null;
  if (lifeStage === 'no_bleeding') {
    suppressedReason = 'no_bleeding';
  } else if (traits.ovulationSuppressed === 'usually') {
    suppressedReason = 'hormonal';
  } else if (lifeStage === 'postpartum' && periodsSince < POSTPARTUM_PERIODS_REQUIRED) {
    suppressedReason = 'postpartum';
  }

  let excludesCycles: ContextGuidance['excludesCycles'] = null;
  if (traits.ovulationSuppressed === 'usually') {
    excludesCycles = 'hormonal_context';
  } else if (lifeStage === 'postpartum') {
    excludesCycles = 'postpartum_context';
  }

  return {
    suppressedReason,
    fertilityMeaningful:
      traits.ovulationSuppressed === 'no' &&
      traits.hormonal !== 'unknown' &&
      FERTILITY_STAGES.has(lifeStage),
    predictionsCaveated: traits.ovulationSuppressed === 'sometimes',
    variabilityIsExpected: lifeStage === 'perimenopause' || lifeStage === 'pcos',
    hidePeriodActions: lifeStage === 'no_bleeding',
    excludesCycles,
  };
}

/** Map the retired single-value birth control column onto the method table. */
export function contraceptionFromLegacy(type: string | null | undefined): ContraceptionMethod {
  switch (type) {
    case 'pill':
      return 'pill_unspecified';
    case 'iud':
      return 'iud_unspecified';
    case 'hormonal_iud':
    case 'copper_iud':
    case 'implant':
    case 'patch':
    case 'ring':
    case 'other':
      return type;
    case 'shot':
      return 'injection';
    default:
      return 'none';
  }
}

export function lifeStageFromLegacy(stage: string | null | undefined): CycleLifeStage {
  switch (stage) {
    case 'pcos':
    case 'perimenopause':
    case 'postpartum':
    case 'post_pill':
      return stage;
    default:
      return 'regular';
  }
}
