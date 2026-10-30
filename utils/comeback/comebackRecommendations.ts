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
};

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

export function comebackRecommendations(
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
