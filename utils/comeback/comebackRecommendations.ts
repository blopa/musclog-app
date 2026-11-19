import type { AiProviderKind } from '@/constants/ai';
import { AI_PROVIDER_STRENGTH } from '@/constants/ai';
import type { ComebackKey } from '@/utils/comeback/comebackCopy';
import type { ComebackAnswers } from '@/utils/comeback/comebackState';

/**
 * Tailored "how to keep logging" tips for the nutrition half. Ordered, keyed by whole translation keys,
 * and aware of which AI features can actually run, so a tip is never a button that dead-ends.
 */

export type ComebackTipAction =
  | 'smartCameraMeal'
  | 'coachTrackMeal'
  | 'myMeals'
  | 'barcodeScan'
  | 'copyDay'
  | 'aiSettings'
  | 'none';

export type ComebackTip = {
  id: string;
  titleKey: ComebackKey;
  descriptionKey: ComebackKey;
  action: ComebackTipAction;
  /** Present when `action` is not 'none'. */
  actionLabelKey?: ComebackKey;
};

export type ComebackRecommendationContext = {
  isAiConfigured: boolean;
  isAiMealPhotoEnabled: boolean;
  /** The provider that would answer; null when none is configured. */
  aiProvider: AiProviderKind | null;
  /** Whether the device has a camera. Without one, no tip may open the camera. */
  hasCamera: boolean;
};

/** Actions that open the camera; dropped entirely when the device has none. */
const CAMERA_ACTIONS: ReadonlySet<ComebackTipAction> = new Set(['smartCameraMeal', 'barcodeScan']);

function tip(id: string, action: ComebackTipAction = 'none'): ComebackTip {
  const base = {
    id,
    titleKey: `comeback.tips.${id}.title`,
    descriptionKey: `comeback.tips.${id}.body`,
  } as const;

  return action === 'none'
    ? { ...base, action }
    : { ...base, action, actionLabelKey: `comeback.tips.${id}.action` };
}

function isBasicProvider(ctx: ComebackRecommendationContext): boolean {
  return ctx.aiProvider !== null && AI_PROVIDER_STRENGTH[ctx.aiProvider] === 'basic';
}

/** The AI-assisted ways to log, or the one tip that sets AI up when nothing is configured. */
function aiTips(ctx: ComebackRecommendationContext): ComebackTip[] {
  if (!ctx.isAiConfigured) {
    return [tip('setupAi', 'aiSettings')];
  }

  const basic = isBasicProvider(ctx);
  const tips: ComebackTip[] = [];
  if (ctx.isAiMealPhotoEnabled) {
    tips.push(tip(basic ? 'snapMealBasic' : 'snapMeal', 'smartCameraMeal'));
  }

  tips.push(tip(basic ? 'describeMealBasic' : 'describeMeal', 'coachTrackMeal'));

  return tips;
}

function recommendationsFor(
  answers: ComebackAnswers,
  ctx: ComebackRecommendationContext
): ComebackTip[] {
  switch (answers.eating) {
    case 'out':
      return [...aiTips(ctx), tip('proteinFirstDish')];
    case 'cook':
      return [tip('savedMeals', 'myMeals'), tip('scanBarcode', 'barcodeScan')];
    case 'mix':
      return [
        tip('sameAsYesterday', 'copyDay'),
        tip('savedMeals', 'myMeals'),
        ...(ctx.isAiConfigured ? aiTips(ctx) : []),
      ];
    case 'varies':
      return [tip('copyPreviousDay', 'copyDay'), ...aiTips(ctx)];
    default:
      return [tip('savedMeals', 'myMeals'), ...aiTips(ctx)];
  }
}

/**
 * Tailored tips for the way the person eats. Tips that open the camera are removed when the device
 * has none; every branch keeps at least one tip that needs nothing (saved meals, copying a day, or
 * the AI setup tip).
 */
export function comebackRecommendations(
  answers: ComebackAnswers,
  ctx: ComebackRecommendationContext
): ComebackTip[] {
  const tips = recommendationsFor(answers, ctx);

  return ctx.hasCamera ? tips : tips.filter((tip) => !CAMERA_ACTIONS.has(tip.action));
}
