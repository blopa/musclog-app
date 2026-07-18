import { useEffect, useState } from 'react';

/**
 * Web-only camera permission check, replacing expo-camera's `useCameraPermissions` hook (which
 * CameraView.web.tsx used to source purely for its permission API, even though the actual video
 * feed is react-zxing/getUserMedia-based). Matches the same `[PermissionResponse | null, request]`
 * shape the native CameraView's wrapper (@/components/CameraView) uses, so call sites
 * (SmartCameraContext, useBarcodeCameraModal) need no changes. Kept as a standalone type here
 * (rather than importing it from the native CameraView) since that file re-exports this hook on
 * web, and a cross-import back into it would be circular.
 *
 * Safari has no Permissions API for 'camera', so `permission` stays `null` (unknown/still-checking,
 * the same semantics the native hook uses while its TurboModule check is in flight) there until
 * `requestPermission()` is called.
 */
type PermissionResponse = {
  granted: boolean;
  status: 'granted' | 'denied';
  canAskAgain: boolean;
  expires: 'never';
};

const toPermissionResponse = (granted: boolean): PermissionResponse => ({
  granted,
  status: granted ? 'granted' : 'denied',
  canAskAgain: true,
  expires: 'never',
});

export const useCameraPermissions = (): [
  null | PermissionResponse,
  () => Promise<PermissionResponse>,
] => {
  const [permission, setPermission] = useState<PermissionResponse | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return;
    }

    let permissionStatus: PermissionStatus | undefined;
    let cancelled = false;

    navigator.permissions
      .query({ name: 'camera' as PermissionName })
      .then((status) => {
        if (cancelled) {
          return;
        }
        permissionStatus = status;
        setPermission(toPermissionResponse(status.state === 'granted'));
        status.onchange = () => {
          setPermission(toPermissionResponse(status.state === 'granted'));
        };
      })
      .catch(() => {
        // Permissions API doesn't support querying 'camera' in this browser (e.g. Safari);
        // leave `permission` as null until requestPermission() is called explicitly.
      });

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  const requestPermission = async (): Promise<PermissionResponse> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      const response = toPermissionResponse(true);
      setPermission(response);
      return response;
    } catch {
      const response = toPermissionResponse(false);
      setPermission(response);
      return response;
    }
  };

  return [permission, requestPermission];
};
