/**
 * What the smart camera is currently capturing.
 *
 * Lives here rather than on `SmartCameraModal` so the pieces the modal is built from —
 * `SmartCameraShell`, `SmartCameraModePicker` — and its siblings (`BarcodeCameraModal`, the
 * camera context) can name it without importing the modal that renders them.
 */
export type CameraMode = 'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan';
