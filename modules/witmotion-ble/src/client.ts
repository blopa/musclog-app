import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  ConnectionPriority,
  Device,
  State,
  Subscription,
} from 'react-native-ble-plx';

import {
  WIT_BANDWIDTH_CODES,
  WIT_DEFAULT_POLL_INTERVAL_MS,
  WIT_DEFAULT_SCAN_TIMEOUT_MS,
  WIT_DEVICE_PREFIX,
  WIT_NOTIFY_UUID,
  WIT_OUTPUT_RATE_CODES,
  WIT_SERVICE_UUID,
  WIT_WRITE_UUID,
} from './constants';
import { applyPacketToLiveData, createEmptyLiveData, parseWitMotionPackets } from './parser';
import type {
  WitMotionActionApi,
  WitMotionDevice,
  WitMotionLiveData,
  WitMotionScanOptions,
  WitMotionState,
} from './types';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function deviceSummary(device: Device): WitMotionDevice {
  const name = device.name ?? device.localName ?? device.id;

  return {
    id: device.id,
    name,
    localName: device.localName,
    rssi: device.rssi,
  };
}

function encode(bytes: number[]) {
  return Buffer.from(bytes).toString('base64');
}

const INITIAL_LIVE_DATA: WitMotionLiveData = createEmptyLiveData();
const INITIAL_STATE: WitMotionState = {
  status: 'idle',
  bleState: State.Unknown,
  isScanning: false,
  isConnected: false,
  connectedDevice: null,
  discoveredDevices: [],
  liveData: INITIAL_LIVE_DATA,
  packetCount: 0,
  error: null,
};

export class WitMotionClient implements WitMotionActionApi {
  private manager: BleManager | null = null;
  private bleStateSubscription: Subscription | null = null;
  private notificationSubscription: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private pollingToken = 0;
  private nativeDevice: Device | null = null;
  private listeners = new Set<() => void>();
  private state: WitMotionState = INITIAL_STATE;
  private disconnecting = false;

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private setState(next: Partial<WitMotionState> | ((current: WitMotionState) => Partial<WitMotionState>)) {
    const patch = typeof next === 'function' ? next(this.state) : next;
    this.state = {
      ...this.state,
      ...patch,
    };
    this.emit();
  }

  private resetLiveData() {
    return createEmptyLiveData();
  }

  private ensureManager() {
    if (!this.manager) {
      this.manager = new BleManager();
      this.bleStateSubscription = this.manager.onStateChange((bleState) => {
        this.setState({ bleState });
      }, true);
    }

    return this.manager;
  }

  private clearScanTimeout() {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  private stopPolling() {
    this.pollingToken += 1;
  }

  private clearConnectionSubscriptions() {
    this.notificationSubscription?.remove();
    this.notificationSubscription = null;
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;
  }

  private clearNativeDevice() {
    this.nativeDevice = null;
  }

  private setDisconnectedState(errorMessage: string | null = null) {
    this.clearConnectionSubscriptions();
    this.clearNativeDevice();
    this.stopPolling();
    this.setState({
      status: errorMessage ? 'error' : 'idle',
      isConnected: false,
      connectedDevice: null,
      liveData: this.resetLiveData(),
      error: errorMessage,
    });
  }

  private extractDevice(deviceOrId: string | WitMotionDevice) {
    if (typeof deviceOrId === 'string') {
      return { id: deviceOrId, name: deviceOrId };
    }

    return deviceOrId;
  }

  private async writeCharacteristic(bytes: number[], persist = false) {
    if (!this.nativeDevice) {
      throw new Error('No connected Wit-Motion device');
    }

    await this.nativeDevice.writeCharacteristicWithResponseForService(
      WIT_SERVICE_UUID,
      WIT_WRITE_UUID,
      encode(bytes)
    );

    if (!persist) {
      return;
    }

    await sleep(100);
    await this.nativeDevice.writeCharacteristicWithResponseForService(
      WIT_SERVICE_UUID,
      WIT_WRITE_UUID,
      encode([0xff, 0xaa, 0x00, 0x00, 0x00])
    );
  }

  private async startPollingRequests() {
    const token = this.pollingToken;
    while (this.pollingToken === token && this.state.isConnected) {
      try {
        await this.requestMagneticField();
        await sleep(WIT_DEFAULT_POLL_INTERVAL_MS);
        if (this.pollingToken !== token || !this.state.isConnected) {
          break;
        }
        await this.requestBattery();
        await sleep(WIT_DEFAULT_POLL_INTERVAL_MS);
      } catch (error) {
        if (this.pollingToken === token && this.state.isConnected) {
          const message = error instanceof Error ? error.message : 'Polling error';
          this.setState({ error: message });
        }
        await sleep(WIT_DEFAULT_POLL_INTERVAL_MS);
      }
    }
  }

  private attachDisconnectHandler(device: Device) {
    this.disconnectSubscription = device.onDisconnected((error) => {
      if (this.disconnecting) {
        this.setDisconnectedState(null);
        this.disconnecting = false;
        return;
      }

      this.setDisconnectedState(error ? error.message : null);
    });
  }

  private handleNotification = (payload: string) => {
    const packets = parseWitMotionPackets(payload);
    if (packets.length === 0) {
      return;
    }

    let liveData = this.state.liveData;
    for (const packet of packets) {
      liveData = applyPacketToLiveData(liveData, packet);
    }

    this.setState((current) => ({
      liveData,
      packetCount: current.packetCount + packets.length,
      error: null,
    }));
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  requestPermissions = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    type AndroidPermission = (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];
    const permissions: AndroidPermission[] = [];

    if (Platform.Version >= 31) {
      permissions.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
    } else {
      permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }

    const result = await PermissionsAndroid.requestMultiple(permissions);
    return permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
  };

  startScan = async (options: WitMotionScanOptions = {}) => {
    const manager = this.ensureManager();
    const permissionsGranted = await this.requestPermissions();
    if (!permissionsGranted) {
      this.setState({
        status: 'error',
        isScanning: false,
        error: 'Bluetooth permissions were denied',
      });
      return;
    }

    const namePrefix = options.namePrefix ?? WIT_DEVICE_PREFIX;
    const timeoutMs = options.timeoutMs ?? WIT_DEFAULT_SCAN_TIMEOUT_MS;
    const autoConnect = options.autoConnect ?? true;

    this.clearScanTimeout();
    manager.stopDeviceScan();
    this.setState({
      status: 'scanning',
      isScanning: true,
      error: null,
    });

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        this.clearScanTimeout();
        manager.stopDeviceScan();
        this.setState({
          status: 'error',
          isScanning: false,
          error: error.message,
        });
        return;
      }

      if (!device) {
        return;
      }

      const name = device.name ?? device.localName ?? '';
      if (!name || !name.startsWith(namePrefix)) {
        return;
      }

      const summary = deviceSummary(device);
      this.setState((current) => {
        if (current.discoveredDevices.some((item) => item.id === summary.id)) {
          return {};
        }

        return {
          discoveredDevices: [...current.discoveredDevices, summary],
        };
      });

      if (autoConnect && this.state.status === 'scanning') {
        void this.connect(summary.id);
      }
    });

    this.scanTimeout = setTimeout(() => {
      manager.stopDeviceScan();
      this.setState((current) => ({
        status: current.isConnected ? 'connected' : 'idle',
        isScanning: false,
      }));
      this.scanTimeout = null;
    }, timeoutMs);
  };

  stopScan = () => {
    this.ensureManager().stopDeviceScan();
    this.clearScanTimeout();
    this.setState((current) => ({
      status: current.isConnected ? 'connected' : 'idle',
      isScanning: false,
    }));
  };

  connect = async (deviceOrId: string | WitMotionDevice) => {
    const manager = this.ensureManager();
    const target = this.extractDevice(deviceOrId);

    await this.requestPermissions();
    this.clearScanTimeout();
    manager.stopDeviceScan();
    this.setState({
      status: 'connecting',
      isScanning: false,
      error: null,
    });

    try {
      const connected = await manager.connectToDevice(target.id);

      try {
        await connected.requestConnectionPriority(ConnectionPriority.High);
      } catch {
        // Best-effort only.
      }

      try {
        await connected.requestMTU(517);
      } catch {
        // Best-effort only.
      }

      await connected.discoverAllServicesAndCharacteristics();

      const service = (await connected.services()).find(
        (item) => item.uuid.toLowerCase() === WIT_SERVICE_UUID
      );
      if (!service) {
        throw new Error('WIT service was not found on the device');
      }

      const characteristics = await service.characteristics();
      const notifyCharacteristic = characteristics.find(
        (item) => item.uuid.toLowerCase() === WIT_NOTIFY_UUID
      );
      const writeCharacteristic = characteristics.find(
        (item) => item.uuid.toLowerCase() === WIT_WRITE_UUID
      );

      if (!notifyCharacteristic || !writeCharacteristic) {
        throw new Error('WIT characteristics were not found on the device');
      }

      this.nativeDevice = connected;
      this.attachDisconnectHandler(connected);
      this.notificationSubscription = connected.monitorCharacteristicForService(
        WIT_SERVICE_UUID,
        WIT_NOTIFY_UUID,
        (notificationError, characteristic) => {
          if (notificationError) {
            this.setState({ status: 'error', error: notificationError.message });
            return;
          }

          if (!characteristic?.value) {
            return;
          }

          this.handleNotification(characteristic.value);
        }
      );

      this.setState((current) => ({
        status: 'connected',
        isConnected: true,
        connectedDevice: target,
        discoveredDevices: current.discoveredDevices.some((item) => item.id === target.id)
          ? current.discoveredDevices
          : [...current.discoveredDevices, target],
        error: null,
      }));

      void this.startPollingRequests();
      return target;
    } catch (error) {
      this.setDisconnectedState(error instanceof Error ? error.message : 'Connection failed');
      throw error;
    }
  };

  disconnect = async () => {
    if (!this.nativeDevice) {
      this.setDisconnectedState(null);
      return;
    }

    this.disconnecting = true;
    this.clearScanTimeout();
    this.setState({ status: 'idle', isScanning: false });

    try {
      this.clearConnectionSubscriptions();
      this.stopPolling();
      await this.nativeDevice.cancelConnection();
    } finally {
      this.setDisconnectedState(null);
      this.disconnecting = false;
    }
  };

  sendRawCommand = async (bytes: number[], persist = false) => {
    await this.writeCharacteristic(bytes, persist);
  };

  reset = async () => {
    await this.sendRawCommand([0xff, 0xaa, 0x00, 0x01, 0x00]);
  };

  setOutputRate = async (value: 1 | 5 | 10 | 50 | 100 | 200) => {
    await this.sendRawCommand([0xff, 0xaa, 0x03, WIT_OUTPUT_RATE_CODES[value], 0x00], true);
  };

  setBandwidth = async (value: 5 | 10 | 20 | 42 | 98 | 188) => {
    await this.sendRawCommand([0xff, 0xaa, 0x1f, WIT_BANDWIDTH_CODES[value], 0x00], true);
  };

  setAngleZero = async () => {
    await this.sendRawCommand([0xff, 0xaa, 0x01, 0x08, 0x00]);
  };

  startMagCalibration = async () => {
    await this.sendRawCommand([0xff, 0xaa, 0x01, 0x07, 0x00]);
  };

  stopMagCalibration = async () => {
    await this.sendRawCommand([0xff, 0xaa, 0x01, 0x00, 0x00], true);
  };

  requestMagneticField = async () => {
    await this.sendRawCommand([0xff, 0xaa, 0x27, 0x3a, 0x00]);
  };

  requestBattery = async () => {
    await this.sendRawCommand([0xff, 0xaa, 0x27, 0x64, 0x00]);
  };
}

export const witMotionClient = new WitMotionClient();
export type WitMotionClientState = WitMotionState;
export type { WitMotionActionApi, WitMotionHookResult, WitMotionLiveData, WitMotionDevice } from './types';
