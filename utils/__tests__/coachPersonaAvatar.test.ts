import { COACH_PRESET_AVATARS, coachAvatarSource, dataUriFromBase64 } from '../coachPersonaAvatar';
import { COACH_PERSONA_IDS } from '@/constants/coachPersonas';

describe('dataUriFromBase64', () => {
  it('reads a JPEG from its magic bytes (native thumbnails)', () => {
    expect(dataUriFromBase64('/9j/4AAQSkZJRg')).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg');
  });

  it('reads a PNG from its magic bytes (web canvas output)', () => {
    expect(dataUriFromBase64('iVBORw0KGgo')).toBe('data:image/png;base64,iVBORw0KGgo');
  });

  it('reads a WebP from its magic bytes', () => {
    expect(dataUriFromBase64('UklGRiQAAABXRUJQ')).toMatch(/^data:image\/webp;base64,/);
  });

  it('defaults to JPEG for anything else', () => {
    expect(dataUriFromBase64('AAAA')).toMatch(/^data:image\/jpeg;base64,/);
  });
});

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
