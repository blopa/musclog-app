import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

// The library falls back to Apple's servers when a locale has no on-device model, even for a
// request that requires on-device recognition. The patch refuses that request instead.
describe('expo-speech-recognition on-device patch', () => {
  it('refuses a required on-device request the device cannot serve', () => {
    const swift = read(
      'node_modules/expo-speech-recognition/ios/ExpoSpeechRecognitionModule.swift'
    );
    const start = swift.indexOf('Musclog patch');

    expect(start).toBeGreaterThan(-1);

    const branch = swift.slice(start, swift.indexOf('hasAuthorizationToRecognize', start));

    expect(branch).toContain('if options.requiresOnDeviceRecognition {');
    expect(branch).toContain('supportsOnDeviceRecognition != true');
    expect(branch).toContain('language-not-supported');
  });

  it('ships the patch for the installed version only', () => {
    const installed = JSON.parse(read('node_modules/expo-speech-recognition/package.json')).version;
    const patchFile = `patches/expo-speech-recognition+${installed}.patch`;

    expect(installed).toBe('58.0.1');
    expect(fs.existsSync(path.join(root, patchFile))).toBe(true);
    expect(read(patchFile)).toContain('expo-speech-recognition');
  });
});
