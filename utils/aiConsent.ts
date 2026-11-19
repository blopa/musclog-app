/** Turning the Musclog free tier ON sends requests to Google Gemini, so it needs explicit consent first. */
export function needsFreeTierConsent(currentlyOn: boolean, nextValue: boolean): boolean {
  return !currentlyOn && nextValue;
}
