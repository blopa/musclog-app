import { LegacyEventEmitter, requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { createEmptyLiveData } from './parser';
import type {
  WitMotionActionApi,
  WitMotionDevice,
  WitMotionHookResult,
  WitMotionNativeModule,
  WitMotionScanOptions,
  WitMotionState,
} from './types';

const DEFAULT_STATE: WitMotionState = {
  status: 'idle',
  bleState: 'unknown',
  isScanning: false,
  isConnected: false,
  connectedDevice: null,
  discoveredDevices: [],
  liveData: createEmptyLiveData(),
  packetCount: 0,
  error: null,
};

const nativeModule =
  Platform.OS === 'web' ? null : requireOptionalNativeModule<WitMotionNativeModule>('WitMotionBle');

const emitter = nativeModule ? new LegacyEventEmitter(nativeModule as any) : null;

function cloneDevice(device: WitMotionDevice | null): WitMotionDevice | null {
  if (!device) {
    return null;
  }

  return { ...device };
}

function cloneState(state: WitMotionState): WitMotionState {
  return {
    ...state,
    connectedDevice: cloneDevice(state.connectedDevice),
    discoveredDevices: state.discoveredDevices.map((device) => ({ ...device })),
    liveData: {
      ...state.liveData,
      accel: state.liveData.accel ? { ...state.liveData.accel } : null,
      gyro: state.liveData.gyro ? { ...state.liveData.gyro } : null,
      angle: state.liveData.angle ? { ...state.liveData.angle } : null,
      magnetic: state.liveData.magnetic ? { ...state.liveData.magnetic } : null,
    },
  };
}

function sameVector(
  a: { x: number; y: number; z: number } | null,
  b: { x: number; y: number; z: number } | null
) {
  return a?.x === b?.x && a?.y === b?.y && a?.z === b?.z;
}

function sameDevice(
  a: WitMotionDevice | null,
  b: WitMotionDevice | null
) {
  return a?.id === b?.id && a?.name === b?.name && a?.localName === b?.localName && a?.rssi === b?.rssi;
}

function sameLiveData(a: WitMotionState['liveData'], b: WitMotionState['liveData']) {
  return (
    sameVector(a.accel, b.accel) &&
    sameVector(a.gyro, b.gyro) &&
    sameVector(a.angle, b.angle) &&
    sameVector(a.magnetic, b.magnetic) &&
    a.batteryVoltage === b.batteryVoltage &&
    a.batteryPercent === b.batteryPercent &&
    a.updatedAt === b.updatedAt
  );
}

function sameState(a: WitMotionState, b: WitMotionState) {
  if (
    a.status !== b.status ||
    a.bleState !== b.bleState ||
    a.isScanning !== b.isScanning ||
    a.isConnected !== b.isConnected ||
    a.packetCount !== b.packetCount ||
    a.error !== b.error ||
    !sameDevice(a.connectedDevice, b.connectedDevice) ||
    a.discoveredDevices.length !== b.discoveredDevices.length ||
    !sameLiveData(a.liveData, b.liveData)
  ) {
    return false;
  }

  for (let i = 0; i < a.discoveredDevices.length; i += 1) {
    if (!sameDevice(a.discoveredDevices[i] ?? null, b.discoveredDevices[i] ?? null)) {
      return false;
    }
  }

  return true;
}

class WitMotionClient implements WitMotionActionApi {
  private listeners = new Set<() => void>();
  private state: WitMotionState = cloneState(DEFAULT_STATE);

  private replaceState(nextState: WitMotionState) {
    const normalized = cloneState(nextState);

    if (sameState(this.state, normalized)) {
      return;
    }

    this.state = normalized;
    this.emit();
  }

  constructor() {
    if (emitter) {
      emitter.addListener('onStateChanged', (nextState: WitMotionState) => {
        this.replaceState({
          ...DEFAULT_STATE,
          ...nextState,
          connectedDevice: nextState.connectedDevice ? { ...nextState.connectedDevice } : null,
          discoveredDevices: nextState.discoveredDevices?.map((device) => ({ ...device })) ?? [],
        });
      });
    }

    void nativeModule?.getState().then((nextState) => {
      this.replaceState({
        ...DEFAULT_STATE,
        ...nextState,
        connectedDevice: nextState.connectedDevice ? { ...nextState.connectedDevice } : null,
        discoveredDevices: nextState.discoveredDevices?.map((device) => ({ ...device })) ?? [],
      });
    });
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private setState(next: Partial<WitMotionState>) {
    const normalized = cloneState({
      ...this.state,
      ...next,
      connectedDevice: next.connectedDevice ? { ...next.connectedDevice } : next.connectedDevice ?? null,
      discoveredDevices:
        next.discoveredDevices?.map((device) => ({ ...device })) ?? this.state.discoveredDevices,
    });

    if (sameState(this.state, normalized)) {
      return;
    }

    this.state = normalized;
    this.emit();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  requestPermissions = async () => {
    if (nativeModule) {
      return nativeModule.requestPermissions();
    }

    if (Platform.OS === 'web') {
      return true;
    }

    const { PermissionsAndroid } = await import('react-native');
    const permissions: string[] = [];
    const androidVersion = Number(Platform.Version);

    if (androidVersion >= 31) {
      permissions.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
    } else {
      permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }

    const result = (await PermissionsAndroid.requestMultiple(permissions as any)) as Record<
      string,
      string
    >;
    return permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
  };

  startScan = async (options: WitMotionScanOptions = {}) => {
    if (nativeModule) {
      return nativeModule.startScan(options);
    }

    this.setState({ status: 'error', error: 'Wit Motion BLE is not available on web' });
    return false;
  };

  stopScan = () => {
    nativeModule?.stopScan();
  };

  connect = async (deviceOrId: string | WitMotionDevice) => {
    const deviceId = typeof deviceOrId === 'string' ? deviceOrId : deviceOrId.id;
    const connected = nativeModule ? await nativeModule.connect(deviceId) : null;

    if (connected) {
      return connected;
    }

    const fallback = typeof deviceOrId === 'string' ? { id: deviceOrId, name: deviceOrId } : deviceOrId;
    this.setState({
      status: 'connected',
      isConnected: true,
      connectedDevice: fallback,
    });
    return fallback;
  };

  disconnect = async () => {
    if (nativeModule) {
      return nativeModule.disconnect();
    }

    this.setState({
      status: 'idle',
      isConnected: false,
      connectedDevice: null,
      liveData: createEmptyLiveData(),
      packetCount: 0,
    });
    return true;
  };

  reset = async () => {
    await nativeModule?.reset();
  };

  setOutputRate = async (value: 1 | 5 | 10 | 50 | 100 | 200) => {
    await nativeModule?.setOutputRate(value);
  };

  setBandwidth = async (value: 5 | 10 | 20 | 42 | 98 | 188) => {
    await nativeModule?.setBandwidth(value);
  };

  setAngleZero = async () => {
    await nativeModule?.setAngleZero();
  };

  startMagCalibration = async () => {
    await nativeModule?.startMagCalibration();
  };

  stopMagCalibration = async () => {
    await nativeModule?.stopMagCalibration();
  };

  requestMagneticField = async () => {
    await nativeModule?.requestMagneticField();
  };

  requestBattery = async () => {
    await nativeModule?.requestBattery();
  };

  sendRawCommand = async (bytes: number[], persist = false) => {
    await nativeModule?.sendRawCommand(bytes, persist);
  };
}

export const witMotionClient = new WitMotionClient();
export type { WitMotionActionApi, WitMotionHookResult } from './types';
