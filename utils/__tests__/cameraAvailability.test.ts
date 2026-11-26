import {
  isUsableCameraDevice,
  MIN_PHOTO_PIXEL_SHARE,
  readHasCamera,
  usableCameraDevices,
} from '../cameraAvailability';

type Device = {
  id: string;
  position: 'back' | 'front';
  formats: { photoWidth: number; photoHeight: number }[];
};

const format = (photoWidth: number, photoHeight: number) => ({ photoWidth, photoHeight });

/**
 * The camera list of the phone this was found on (Poco X3 NFC, LineageOS, Android 15), in the
 * order CameraX reports it. 22 (2 MP macro) has no formats and crashed the camera; 25 is the 2 MP
 * depth sensor with the same specs, given a format here to prove the auxiliary rule drops it too.
 */
const POCO_X3: Device[] = [
  { id: '0', position: 'back', formats: [format(4624, 3472), format(9248, 6944)] },
  { id: '1', position: 'front', formats: [format(5184, 3880)] },
  { id: '21', position: 'back', formats: [format(4208, 3120)] },
  { id: '22', position: 'back', formats: [] },
  { id: '25', position: 'back', formats: [format(1600, 1200)] },
  { id: '61', position: 'back', formats: [format(9248, 6944)] },
  { id: '100', position: 'back', formats: [format(9248, 6944)] },
  { id: '101', position: 'front', formats: [format(5184, 3880)] },
];

const ids = (devices: Device[]) => devices.map((device) => device.id);

describe('usableCameraDevices', () => {
  it('never offers a camera without formats or a tiny auxiliary sensor', () => {
    const back = ids(usableCameraDevices(POCO_X3, 'back'));

    expect(back).not.toContain('22');
    expect(back).not.toContain('25');
    // 13 MP is under a quarter of 64 MP: the ultra-wide is an auxiliary camera here too.
    expect(back).not.toContain('21');
  });

  it('puts the largest sensor first, keeping list order among equals', () => {
    expect(ids(usableCameraDevices(POCO_X3, 'back'))).toEqual(['0', '61', '100']);
  });

  it('only returns cameras facing the asked way', () => {
    expect(ids(usableCameraDevices(POCO_X3, 'front'))).toEqual(['1', '101']);
  });

  it('keeps every camera of a phone whose cameras are comparable', () => {
    const phone: Device[] = [
      { id: 'wide', position: 'back', formats: [format(8160, 6144)] },
      { id: 'ultra-wide', position: 'back', formats: [format(4080, 3072)] },
      { id: 'tele', position: 'back', formats: [format(4080, 3072)] },
    ];

    expect(ids(usableCameraDevices(phone, 'back'))).toEqual(['wide', 'ultra-wide', 'tele']);
  });

  it('keeps a camera at exactly the threshold', () => {
    const best = 4000 * 3000;
    const phone: Device[] = [
      { id: 'main', position: 'back', formats: [format(4000, 3000)] },
      { id: 'edge', position: 'back', formats: [format(best * MIN_PHOTO_PIXEL_SHARE, 1)] },
    ];

    expect(ids(usableCameraDevices(phone, 'back'))).toEqual(['main', 'edge']);
  });

  it('is empty when no camera facing that way can be opened', () => {
    expect(usableCameraDevices([{ id: '22', position: 'back', formats: [] }], 'back')).toEqual([]);
  });
});

describe('isUsableCameraDevice', () => {
  it('needs at least one format, and accepts an unknown shape', () => {
    expect(isUsableCameraDevice({ formats: [] })).toBe(false);
    expect(isUsableCameraDevice({ formats: [format(1, 1)] })).toBe(true);
    expect(isUsableCameraDevice({})).toBe(true);
  });
});

describe('readHasCamera', () => {
  it('is true when the device lists a camera', () => {
    expect(readHasCamera(() => [{ formats: [format(4000, 3000)] }])).toBe(true);
    expect(readHasCamera(() => [{}])).toBe(true);
  });

  it('is false for an empty device list', () => {
    expect(readHasCamera(() => [])).toBe(false);
  });

  it('is false when no listed camera can be opened', () => {
    expect(readHasCamera(() => [{ formats: [] }, { formats: [] }])).toBe(false);
  });

  it('is true when at least one camera can be opened', () => {
    expect(readHasCamera(() => [{ formats: [] }, { formats: [format(4000, 3000)] }])).toBe(true);
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
