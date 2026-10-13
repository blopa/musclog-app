export type TrackingToggleAction = 'none' | 'pause' | 'resume' | 'setup';

/**
 * What the profile's "track my cycle" switch should do. Turning it off pauses (history kept),
 * turning it on resumes a paused cycle, and only a user who never set tracking up is sent
 * through setup, so re-enabling never replaces existing history.
 */
export function resolveTrackingToggle(input: {
  requested: boolean | undefined;
  isActive: boolean;
  hasPausedCycle: boolean;
}): TrackingToggleAction {
  const { requested, isActive, hasPausedCycle } = input;
  if (requested === undefined || requested === isActive) {
    return 'none';
  }

  if (!requested) {
    return 'pause';
  }

  return hasPausedCycle ? 'resume' : 'setup';
}
