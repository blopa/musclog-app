import {
  type EventSubscription,
  Platform,
  requireNativeModule,
  UnavailabilityError,
} from 'expo-modules-core';

export type WitPacketType = 'accel' | 'gyro' | 'angle' | 'mag';

export interface WitPacket {
  type: WitPacketType;
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface WitScannedDevice {
  id: string;
  name?: string | null;
  localName?: string | null;
  rssi?: number | null;
}

export interface WitConnectionEvent {
  state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
  deviceId?: string | null;
  deviceName?: string | null;
  message?: string | null;
}

type NativeWitmotionBleModule = {
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  getBondedDevices(): Promise<WitScannedDevice[]>;
  connect(deviceId: string, outputRateHz?: number): Promise<WitScannedDevice>;
  disconnect(): Promise<void>;
  setOutputRate(hz: number): Promise<void>;
  addListener(eventName: string, listener: (event: any) => void): EventSubscription;
  removeListeners(count: number): void;
};

const native =
  Platform.OS === 'android' ? requireNativeModule<NativeWitmotionBleModule>('WitmotionBle') : null;

function unsupported(name: string): never {
  throw new UnavailabilityError('WitmotionBle', name);
}

export function startScan(): Promise<void> {
  return (
    native?.startScan() ?? Promise.reject(new UnavailabilityError('WitmotionBle', 'startScan'))
  );
}

export function stopScan(): Promise<void> {
  return native?.stopScan() ?? Promise.reject(new UnavailabilityError('WitmotionBle', 'stopScan'));
}

export function getBondedDevices(): Promise<WitScannedDevice[]> {
  return (
    native?.getBondedDevices() ??
    Promise.reject(new UnavailabilityError('WitmotionBle', 'getBondedDevices'))
  );
}

export function connect(deviceId: string, outputRateHz = 50): Promise<WitScannedDevice> {
  return (
    native?.connect(deviceId, outputRateHz) ??
    Promise.reject(new UnavailabilityError('WitmotionBle', 'connect'))
  );
}

export function disconnect(): Promise<void> {
  return (
    native?.disconnect() ?? Promise.reject(new UnavailabilityError('WitmotionBle', 'disconnect'))
  );
}

export function setOutputRate(hz: number): Promise<void> {
  return (
    native?.setOutputRate(hz) ??
    Promise.reject(new UnavailabilityError('WitmotionBle', 'setOutputRate'))
  );
}

export function addPacketListener(
  listener: (event: { packet: WitPacket }) => void
): EventSubscription {
  return native?.addListener('onPacket', listener) ?? unsupported('addPacketListener');
}

export function addDeviceFoundListener(
  listener: (event: WitScannedDevice) => void
): EventSubscription {
  return native?.addListener('onDeviceFound', listener) ?? unsupported('addDeviceFoundListener');
}

export function addConnectionListener(
  listener: (event: WitConnectionEvent) => void
): EventSubscription {
  return native?.addListener('onConnectionState', listener) ?? unsupported('addConnectionListener');
}

export function addErrorListener(
  listener: (event: { message: string }) => void
): EventSubscription {
  return native?.addListener('onError', listener) ?? unsupported('addErrorListener');
}

export function addLogListener(
  listener: (event: { message: string; level: 'info' | 'success' | 'error' | 'data' }) => void
): EventSubscription {
  return native?.addListener('onLog', listener) ?? unsupported('addLogListener');
}
