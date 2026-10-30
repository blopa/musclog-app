import type { ImageSourcePropType } from 'react-native';

import type { CoachPersonaId, CoachPresetPersonaId } from '@/constants/coachPersonas';

/**
 * The avatar of each preset persona. UI-only, so the persona registry stays free of `require`d
 * images and can run in the Jest `node` project. Replace the files, not this map.
 */
export const COACH_PRESET_AVATARS: Record<CoachPresetPersonaId, ImageSourcePropType> = {
  loggy: require('../../assets/avatars/loggy.png'),
  dracula: require('../../assets/avatars/dracula.png'),
  cthulhu: require('../../assets/avatars/cthulhu.png'),
  sherlock: require('../../assets/avatars/sherlock.png'),
};

/**
 * The one answer to "which image is this coach?": a preset's own, or the custom persona's data URI,
 * falling back to Loggy's while a custom persona has no picture.
 */
export function coachAvatarSource(id: CoachPersonaId, customAvatar = ''): ImageSourcePropType {
  if (id !== 'custom') {
    return COACH_PRESET_AVATARS[id];
  }

  return customAvatar ? { uri: customAvatar } : COACH_PRESET_AVATARS.loggy;
}
