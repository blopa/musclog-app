import { COACH_PERSONA_IDS } from '@/constants/coachPersonas';

import { COACH_PRESET_AVATARS, coachAvatarSource } from '../coach/coachPersonaAvatars';

describe('coachAvatarSource', () => {
  it.each(COACH_PERSONA_IDS.filter((id) => id !== 'custom'))('gives %s its own image', (id) => {
    expect(coachAvatarSource(id)).toBe(
      COACH_PRESET_AVATARS[id as keyof typeof COACH_PRESET_AVATARS]
    );
  });

  it('uses the custom persona`s picture when it has one', () => {
    expect(coachAvatarSource('custom', 'data:image/png;base64,AA')).toEqual({
      uri: 'data:image/png;base64,AA',
    });
  });

  it('shows Loggy while a custom persona has no picture', () => {
    expect(coachAvatarSource('custom')).toBe(COACH_PRESET_AVATARS.loggy);
    expect(coachAvatarSource('custom', '')).toBe(COACH_PRESET_AVATARS.loggy);
  });
});
