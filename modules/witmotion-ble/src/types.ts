import type { State as BleState } from 'react-native-ble-plx';

export type WitMotionConnectionStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface WitMotionDevice {
  id: string;
  name: string;
  localName?: string | null;
  rssi?: number | null;
}

export interface WitMotionVector3 {
  x: number;
  y: number;
  z: number;
}

export interface WitMotionLiveData {
  accel: WitMotionVector3 | null;
  gyro: WitMotionVector3 | null;
  angle: WitMotionVector3 | null;
  magnetic: WitMotionVector3 | null;
  batteryVoltage: number | null;
  batteryPercent: number | null;
  updatedAt: number | null;
}

export interface WitMotionState {
  status: WitMotionConnectionStatus;
  bleState: BleState;
  isScanning: boolean;
  isConnected: boolean;
  connectedDevice: WitMotionDevice | null;
  discoveredDevices: WitMotionDevice[];
  liveData: WitMotionLiveData;
  packetCount: number;
  error: string | null;
}

export interface WitMotionScanOptions {
  autoConnect?: boolean;
  namePrefix?: string;
  timeoutMs?: number;
}

export interface WitMotionConnectOptions {
  requestPriorityHigh?: boolean;
  requestMtu?: number;
}

export interface WitMotionActionApi {
  requestPermissions: () => Promise<boolean>;
  startScan: (options?: WitMotionScanOptions) => Promise<void>;
  stopScan: () => void;
  connect: (deviceOrId: string | WitMotionDevice) => Promise<WitMotionDevice>;
  disconnect: () => Promise<void>;
  reset: () => Promise<void>;
  setOutputRate: (value: 1 | 5 | 10 | 50 | 100 | 200) => Promise<void>;
  setBandwidth: (value: 5 | 10 | 20 | 42 | 98 | 188) => Promise<void>;
  setAngleZero: () => Promise<void>;
  startMagCalibration: () => Promise<void>;
  stopMagCalibration: () => Promise<void>;
  requestMagneticField: () => Promise<void>;
  requestBattery: () => Promise<void>;
  sendRawCommand: (bytes: number[], persist?: boolean) => Promise<void>;
}

export interface WitMotionHookResult extends WitMotionState, WitMotionActionApi {}

export type WitMotionPacket =
  | {
      kind: 'motion';
      timestamp: number;
      accel: WitMotionVector3;
      gyro: WitMotionVector3;
      angle: WitMotionVector3;
    }
  | {
      kind: 'magnetic';
      timestamp: number;
      magnetic: WitMotionVector3;
    }
  | {
      kind: 'battery';
      timestamp: number;
      voltage: number;
      percent: number;
    };
