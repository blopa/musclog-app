/** The Settings screen with the AI providers sheet open. */
export const AI_SETTINGS_ROUTE = '/app/settings';

/**
 * The Settings tab stays mounted, so the param carries a new value each time: asking twice opens
 * the sheet twice.
 */
export const aiSettingsHref = () =>
  ({ pathname: AI_SETTINGS_ROUTE, params: { openAi: String(Date.now()) } }) as const;
