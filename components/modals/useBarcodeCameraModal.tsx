import { useCallback } from 'react';

import { useCameraPermissions } from '@/components/CameraView';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';

import { BarcodeCameraModal } from './BarcodeCameraModal';

/**
 * Owns a form-launched barcode scanner: its visibility state, the camera permission, and the
 * `BarcodeCameraModal` element itself. Render `scanner` INSIDE the modal or bottom sheet that
 * launches it — never as a sibling (see docs/modals-problem-on-ios.md). The scanner closes
 * itself after a successful scan and auto-resets whenever the host closes (`hostVisible`
 * drives `useSubModalVisibility`), so hosts need no scanner cleanup of their own.
 */
export function useBarcodeCameraModal(
  hostVisible: boolean,
  onBarcodeScanned: (data: string) => void
) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerVisible, setIsScannerVisible] = useSubModalVisibility(hostVisible);

  const openScanner = useCallback(() => setIsScannerVisible(true), [setIsScannerVisible]);
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
