import { readHasCamera } from '../cameraAvailability';

describe('readHasCamera', () => {
  it('is true when the device lists a camera', () => {
    expect(readHasCamera(() => [{ id: 'back' }])).toBe(true);
  });

  it('is false for an empty device list', () => {
    expect(readHasCamera(() => [])).toBe(false);
  });

  it('assumes a camera when the list cannot be read', () => {
    expect(
      readHasCamera(() => {
        throw new Error('native module missing');
      })
    ).toBe(true);
    expect(readHasCamera(() => undefined)).toBe(true);
  });
});
