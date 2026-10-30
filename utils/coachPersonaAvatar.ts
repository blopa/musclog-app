import type { ImageSourcePropType } from 'react-native';

import type { CoachPersonaId, CoachPresetPersonaId } from '@/constants/coachPersonas';

/**
 * The avatar of each preset persona. Kept out of the persona registry (`constants/coachPersonas`),
 * which stays free of `require`d images and runs in the Jest `node` project. Replace the files, not
 * this map.
 */
export const COACH_PRESET_AVATARS: Record<CoachPresetPersonaId, ImageSourcePropType> = {
  loggy: require('../assets/avatars/loggy.png'),
  dracula: require('../assets/avatars/dracula.png'),
  cthulhu: require('../assets/avatars/cthulhu.png'),
  sherlock: require('../assets/avatars/sherlock.png'),
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

/** The image type each base64 prefix (the encoding of the file's first bytes) identifies. */
const MIME_BY_BASE64_PREFIX: [prefix: string, mime: string][] = [
  ['iVBOR', 'image/png'],
  ['UklGR', 'image/webp'],
];

/**
 * Wraps a raw base64 image (what `createThumbnail` returns) in a data URI. The MIME type is read
 * from the first bytes of the image, because native re-encodes to JPEG while web's canvas produces
 * PNG, and a wrong type makes some renderers refuse the image.
 */
export function dataUriFromBase64(base64: string): string {
  const mime =
    MIME_BY_BASE64_PREFIX.find(([prefix]) => base64.startsWith(prefix))?.[1] ?? 'image/jpeg';

  return `data:${mime};base64,${base64}`;
}
