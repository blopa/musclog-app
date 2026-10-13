/**
 * Web stub for "react-native-vision-camera". The real package throws at module evaluation on web
 * ("VisionCamera currently does not work on web"), and expo-router's require.context can still
 * reach the native-only `.tsx` siblings of `.web.tsx` files (e.g. test/reps-recording). The app
 * never uses the camera on web — `CameraView.web.tsx` and the `.web` route stubs cover it — so
 * Metro resolves the package here whenever `platform === 'web'`.
 */
const Camera = () => null;
const noop = () => undefined;

module.exports = {
  Camera,
  useCameraDevice: () => undefined,
  useCameraFormat: () => undefined,
  useCameraPermission: () => ({ hasPermission: false, requestPermission: async () => false }),
  useMicrophonePermission: () => ({ hasPermission: false, requestPermission: async () => false }),
  useCodeScanner: () => ({ codeTypes: [], onCodeScanned: noop }),
};
