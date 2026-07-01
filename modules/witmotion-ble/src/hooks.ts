import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { witMotionClient } from './client';
import type { WitMotionHookResult } from './types';

function useWitMotionState(): WitMotionHookResult {
  const state = useSyncExternalStore(
    witMotionClient.subscribe,
    witMotionClient.getSnapshot,
    witMotionClient.getSnapshot
  );

  return useMemo(
    () => ({
      ...state,
      requestPermissions: witMotionClient.requestPermissions,
      startScan: witMotionClient.startScan,
      stopScan: witMotionClient.stopScan,
      connect: witMotionClient.connect,
      disconnect: witMotionClient.disconnect,
      reset: witMotionClient.reset,
      setOutputRate: witMotionClient.setOutputRate,
      setBandwidth: witMotionClient.setBandwidth,
      setAngleZero: witMotionClient.setAngleZero,
      startMagCalibration: witMotionClient.startMagCalibration,
      stopMagCalibration: witMotionClient.stopMagCalibration,
      requestMagneticField: witMotionClient.requestMagneticField,
      requestBattery: witMotionClient.requestBattery,
      sendRawCommand: witMotionClient.sendRawCommand,
    }),
    [state]
  );
}

export function useWitMotion(): WitMotionHookResult {
  return useWitMotionState();
}

export function useWitMotionScanner() {
  const api = useWitMotionState();

  return {
    bleState: api.bleState,
    discoveredDevices: api.discoveredDevices,
    error: api.error,
    isScanning: api.isScanning,
    connectedDevice: api.connectedDevice,
    status: api.status,
    requestPermissions: api.requestPermissions,
    startScan: api.startScan,
    stopScan: api.stopScan,
    connect: api.connect,
    disconnect: api.disconnect,
  };
}

export function useWitMotionDevice(deviceId?: string | null) {
  const api = useWitMotionState();
  const connect = api.connect;

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    void connect(deviceId);
  }, [connect, deviceId]);

  return api;
}

export type { WitMotionActionApi } from './types';
