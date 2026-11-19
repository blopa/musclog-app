import { useCallback } from 'react';

import { useCameraPermissions, useHasCamera } from '@/components/CameraView';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';

import { BarcodeCameraModal } from './BarcodeCameraModal';

/**
 * Owns a form-launched barcode scanner: its visibility state, the camera permission, and the
 * `BarcodeCameraModal` element itself. Render `scanner` INSIDE the modal or bottom sheet that
 * launches it — never as a sibling (see docs/FIXES.md). The scanner closes
 * itself after a successful scan and auto-resets whenever the host closes (`hostVisible`
 * drives `useSubModalVisibility`), so hosts need no scanner cleanup of their own.
 *
 * `openScanner` is undefined on a device without a camera, so a caller passes it straight to a
 * button that renders only while its handler is supplied.
 */
export function useBarcodeCameraModal(
  hostVisible: boolean,
  onBarcodeScanned: (data: string) => void
) {
  const [permission, requestPermission] = useCameraPermissions();
  const hasCamera = useHasCamera();
  const [isScannerVisible, setIsScannerVisible] = useSubModalVisibility(hostVisible);

  const showScanner = useCallback(() => setIsScannerVisible(true), [setIsScannerVisible]);
  const openScanner: (() => void) | undefined = hasCamera ? showScanner : undefined;
  const closeScanner = useCallback(() => setIsScannerVisible(false), [setIsScannerVisible]);

  const scanner = isScannerVisible ? (
    <BarcodeCameraModal
      visible={isScannerVisible}
      onClose={closeScanner}
      onBarcodeScanned={onBarcodeScanned}
      showBarcodeTextSearch={true}
      permissionGranted={permission?.granted ?? null}
      onRequestPermission={requestPermission}
    />
  ) : null;

  return { openScanner, scanner };
}
