import { useCallback, useEffect, useState } from 'react';

import type { PermissionResponse } from '@/components/CameraView';

/**
 * Web-only camera permission check, replacing expo-camera's `useCameraPermissions` hook (which
 * CameraView.web.tsx used to source purely for its permission API, even though the actual video
 * feed is react-zxing/getUserMedia-based). Matches the `[PermissionResponse | null, request]`
 * shape of the native wrapper (@/components/CameraView) — the type import is type-only, so the
 * platform-resolution cycle with CameraView.web.tsx (which re-exports this hook) is erased at
 * runtime.
 *
 * Browsers where the Permissions API can't answer for 'camera' (e.g. Safari) report
 * 'not-determined' instead of staying null, so the camera UI shows its grant button and
 * `requestPermission()`'s getUserMedia call is what actually prompts. `permission` is null only
 * while a supported browser's Permissions API query is still resolving.
 */
const toPermissionResponse = (granted: boolean): PermissionResponse => ({
  granted,
  status: granted ? 'granted' : 'denied',
  canAskAgain: true,
  expires: 'never',
});

const NOT_DETERMINED: PermissionResponse = {
  granted: false,
  status: 'not-determined',
  canAskAgain: true,
  expires: 'never',
};

const supportsCameraPermissionQuery = () =>
  typeof navigator !== 'undefined' && !!navigator.permissions?.query;

export const useCameraPermissions = (): [
  null | PermissionResponse,
  () => Promise<PermissionResponse>,
] => {
  const [permission, setPermission] = useState<PermissionResponse | null>(() =>
    supportsCameraPermissionQuery() ? null : NOT_DETERMINED
  );

  useEffect(() => {
    if (!supportsCameraPermissionQuery()) {
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
        // The Permissions API exists but can't query 'camera' in this browser — same
        // treatment as no API at all: not determined until requestPermission() prompts.
        if (!cancelled) {
          setPermission(NOT_DETERMINED);
        }
      });

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<PermissionResponse> => {
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
  }, []);

  return [permission, requestPermission];
};
