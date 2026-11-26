import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { witMotionClient } from './client';
import type { WitMotionHookResult } from './types';

const subscribeToNothing = () => () => undefined;

export type UseWitMotionOptions = {
  /**
   * `false` keeps the native module asleep: the hook returns the idle state and does not
   * subscribe. A screen that is only mounted (a hidden modal, a workout with no saved sensor)
   * passes `false`; the actions still work and wake the module when called.
   */
  enabled?: boolean;
};

function useWitMotionState({ enabled = true }: UseWitMotionOptions = {}): WitMotionHookResult {
  const state = useSyncExternalStore(
    enabled ? witMotionClient.subscribe : subscribeToNothing,
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

export function useWitMotion(options?: UseWitMotionOptions): WitMotionHookResult {
  return useWitMotionState(options);
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
