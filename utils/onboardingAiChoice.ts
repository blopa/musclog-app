/**
 * The onboarding AI step's choices: Musclog Premium, the free tier, or no AI. Pure, so which
 * options a build offers and which one starts selected are tested without React.
 */
export type AiChoice = 'premium' | 'free' | 'none';

/** Which choices this build can offer, in the order the screen lists them. "No AI" is always one. */
export function availableAiChoices({
  premiumEnabled,
  freeTierAvailable,
}: {
  /** `usePremium().enabled`: the Premium build flag on a native build. */
  premiumEnabled: boolean;
  /** `isMusclogGatewayAvailable()`: the free tier is off on production web. */
  freeTierAvailable: boolean;
}): AiChoice[] {
  const choices: AiChoice[] = [];

  if (premiumEnabled) {
    choices.push('premium');
  }

  if (freeTierAvailable) {
    choices.push('free');
  }

  choices.push('none');

  return choices;
}

/**
 * The choice selected when the screen opens: the first one offered. Selecting the free tier turns
 * nothing on by itself; its consent text is on screen above the button that does.
 */
export function defaultAiChoice(choices: readonly AiChoice[]): AiChoice {
  return choices[0] ?? 'none';
}
