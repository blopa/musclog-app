import { dataUriFromBase64 } from '../coachPersonaAvatar';

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
