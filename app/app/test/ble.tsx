import { Buffer } from 'buffer';
import { Bluetooth, BluetoothOff, RefreshCw, Share2, Wifi, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { BleManager, ConnectionPriority, Device, State } from 'react-native-ble-plx';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

const SERVICE_UUID  = '0000FFE5-0000-1000-8000-00805F9A34FB';
const CHAR_UUID     = '0000FFE4-0000-1000-8000-00805F9A34FB'; // notify — data stream
const WRITE_UUID    = '0000FFE9-0000-1000-8000-00805F9A34FB'; // write — config commands

type PacketType = 'accel' | 'gyro' | 'angle' | 'mag' | 'unknown';

interface ParsedPacket {
  type: PacketType;
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

interface SensorData {
  accel: ParsedPacket | null;
  gyro: ParsedPacket | null;
  angle: ParsedPacket | null;
  mag: ParsedPacket | null;
}

interface LogEntry {
  id: number;
  text: string;
  level: 'info' | 'success' | 'error' | 'data';
}

function parsePacket(base64: string): ParsedPacket[] {
  const buf = Buffer.from(base64, 'base64');
  const results: ParsedPacket[] = [];
  let offset = 0;

  while (offset < buf.length) {
    if (buf[offset] !== 0x55) { offset++; continue; }
    if (offset + 1 >= buf.length) break;

    const type = buf[offset + 1];
    const now = Date.now();
    const r = (i: number) => buf.readInt16LE(offset + 2 + i * 2);

    switch (type) {
      // Combined 20-byte packet: accel + gyro + angle in one notification
      case 0x61:
        if (offset + 19 >= buf.length) { offset++; break; }
        results.push({ type: 'accel', x: (r(0) / 32768) * 16,   y: (r(1) / 32768) * 16,   z: (r(2) / 32768) * 16,   timestamp: now });
        results.push({ type: 'gyro',  x: (r(3) / 32768) * 2000, y: (r(4) / 32768) * 2000, z: (r(5) / 32768) * 2000, timestamp: now });
        results.push({ type: 'angle', x: (r(6) / 32768) * 180,  y: (r(7) / 32768) * 180,  z: (r(8) / 32768) * 180,  timestamp: now });
        offset += 20;
        break;
      // Legacy 11-byte individual packets
      case 0x51:
        if (offset + 10 >= buf.length) { offset++; break; }
        results.push({ type: 'accel', x: (r(0) / 32768) * 16,   y: (r(1) / 32768) * 16,   z: (r(2) / 32768) * 16,   timestamp: now });
        offset += 11;
        break;
      case 0x52:
        if (offset + 10 >= buf.length) { offset++; break; }
        results.push({ type: 'gyro',  x: (r(0) / 32768) * 2000, y: (r(1) / 32768) * 2000, z: (r(2) / 32768) * 2000, timestamp: now });
        offset += 11;
        break;
      case 0x53:
        if (offset + 10 >= buf.length) { offset++; break; }
        results.push({ type: 'angle', x: (r(0) / 32768) * 180,  y: (r(1) / 32768) * 180,  z: (r(2) / 32768) * 180,  timestamp: now });
        offset += 11;
        break;
      case 0x54:
        if (offset + 10 >= buf.length) { offset++; break; }
        results.push({ type: 'mag', x: r(0), y: r(1), z: r(2), timestamp: now });
        offset += 11;
        break;
      default:
        offset++;
        break;
    }
  }

  return results;
}

function fmt(n: number) {
  return n.toFixed(3).padStart(8);
}

const PACKET_LABELS: Record<
  PacketType,
  { title: string; unit: string; axisLabels: [string, string, string] }
> = {
  accel: { title: 'Accelerometer', unit: 'g', axisLabels: ['X', 'Y', 'Z'] },
  gyro: { title: 'Gyroscope', unit: '°/s', axisLabels: ['X', 'Y', 'Z'] },
  angle: { title: 'Euler Angles', unit: '°', axisLabels: ['Roll', 'Pitch', 'Yaw'] },
  mag: { title: 'Magnetometer', unit: 'raw', axisLabels: ['X', 'Y', 'Z'] },
  unknown: { title: 'Unknown', unit: '', axisLabels: ['X', 'Y', 'Z'] },
};

function SensorCard({ packet, type }: { packet: ParsedPacket | null; type: PacketType }) {
  const theme = useTheme();
  const { title, unit, axisLabels } = PACKET_LABELS[type];

  return (
    <View className="flex-1 rounded-xl border border-border-accent bg-bg-overlay p-3">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
        {title}
      </Text>
      {packet ? (
        <>
          {([packet.x, packet.y, packet.z] as const).map((val, i) => (
            <View key={i} className="mb-1 flex-row items-center justify-between">
              <Text className="text-xs font-bold text-text-secondary">{axisLabels[i]}</Text>
              <Text className="font-mono text-sm text-accent-primary">
                {fmt(val)} <Text className="text-xs text-text-tertiary">{unit}</Text>
              </Text>
            </View>
          ))}
          <Text className="mt-1 text-right text-xs text-text-tertiary">
            {new Date(packet.timestamp).toLocaleTimeString()}
          </Text>
        </>
      ) : (
        <Text className="py-2 text-center text-xs text-text-tertiary">Waiting…</Text>
      )}
    </View>
  );
}

const LOG_COLORS: Record<LogEntry['level'], string> = {
  info: 'text-text-secondary',
  success: 'text-status-success',
  error: 'text-status-error',
  data: 'text-accent-primary',
};

let bleManager: BleManager | null = null;

function getManager() {
  if (!bleManager) {
    bleManager = new BleManager();
  }

  return bleManager;
}

export default function BleTestScreen() {
  const theme = useTheme();
  const [bleState, setBleState] = useState<State>(State.Unknown);
  const [scanning, setScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [sensorData, setSensorData] = useState<SensorData>({
    accel: null,
    gyro: null,
    angle: null,
    mag: null,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [repCount, setRepCount] = useState(0);
  const [repPhase, setRepPhase] = useState<'rest' | 'active'>('rest');
  const logIdRef = useRef(0);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  // Rep counter state machine lives in a ref to avoid stale closures in the BLE callback
  const repStateRef = useRef({
    smoothed: 0,
    phase: 'rest' as 'rest' | 'active',
    halfReps: 0,
    lastTransitionAt: 0,
  });

  // EMA-smoothed net acceleration magnitude → state machine
  // rest→active→rest = half-rep; 2 half-reps = 1 full rep
  const HIGH  = 0.25; // g above static — entered "moving"
  const LOW   = 0.10; // g — back to "rest"
  const ALPHA = 0.7;  // EMA weight — high so a single sample can trigger the threshold
  const MIN_MS = 300; // debounce — ignore transitions faster than this

  const processRepAccel = useCallback((ax: number, ay: number, az: number) => {
    const s = repStateRef.current;
    const net = Math.sqrt(ax * ax + ay * ay + az * az) - 1.0;
    s.smoothed = ALPHA * net + (1 - ALPHA) * s.smoothed;

    const now = Date.now();
    if (now - s.lastTransitionAt < MIN_MS) return;

    if (s.phase === 'rest' && s.smoothed > HIGH) {
      s.phase = 'active';
      s.lastTransitionAt = now;
      setRepPhase('active');
    } else if (s.phase === 'active' && s.smoothed < LOW) {
      s.phase = 'rest';
      s.lastTransitionAt = now;
      s.halfReps += 1;
      setRepPhase('rest');
      if (s.halfReps % 2 === 0) {
        setRepCount((c) => c + 1);
      }
    }
  }, []);

  const resetReps = useCallback(() => {
    const s = repStateRef.current;
    s.smoothed = 0;
    s.phase = 'rest';
    s.halfReps = 0;
    s.lastTransitionAt = 0;
    setRepCount(0);
    setRepPhase('rest');
  }, []);

  const addLog = useCallback((text: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => [
      { id: logIdRef.current++, text: `[${new Date().toLocaleTimeString()}] ${text}`, level },
      ...prev.slice(0, 99),
    ]);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const manager = getManager();
    const sub = manager.onStateChange((state) => {
      setBleState(state);
      addLog(`Bluetooth state: ${state}`);
    }, true);

    return () => {
      sub.remove();
      subscriptionRef.current?.remove();
      manager.stopDeviceScan();
    };
  }, [addLog]);

  const startScan = useCallback(() => {
    if (bleState !== State.PoweredOn) {
      addLog('Bluetooth is not powered on', 'error');
      return;
    }

    setFoundDevices([]);
    setScanning(true);
    addLog('Scanning for WT9011DCL devices…');

    const manager = getManager();
    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        addLog(`Scan error: ${error.message}`, 'error');
        setScanning(false);
        return;
      }

      if (!device) {
        return;
      }

      const name = device.name ?? device.localName ?? '';
      if (!name) {
        return;
      }

      setFoundDevices((prev) => {
        if (prev.find((d) => d.id === device.id)) {
          return prev;
        }
        addLog(`Found: ${name} (${device.id})`);
        return [...prev, device];
      });
    });

    // Auto-stop after 15s
    setTimeout(() => {
      manager.stopDeviceScan();
      setScanning(false);
      addLog('Scan stopped');
    }, 15000);
  }, [bleState, addLog]);

  const stopScan = useCallback(() => {
    getManager().stopDeviceScan();
    setScanning(false);
    addLog('Scan stopped by user');
  }, [addLog]);

  const connectDevice = useCallback(
    async (device: Device) => {
      const manager = getManager();
      manager.stopDeviceScan();
      setScanning(false);

      try {
        addLog(`Connecting to ${device.name ?? device.id}…`);
        const connected = await device.connect();
        await connected.discoverAllServicesAndCharacteristics();
        setConnectedDevice(connected);
        addLog(`Connected to ${connected.name ?? connected.id}`, 'success');

        // Let the connection stabilize before sending config
        await new Promise((r) => setTimeout(r, 300));

        // Request shortest BLE connection interval (Android only — peripheral may ignore)
        try {
          await connected.requestConnectionPriority(ConnectionPriority.High);
          addLog('High-priority connection requested');
        } catch (_) {}

        // WIT protocol config sequence: unlock → set rate → save
        // Without unlock the device silently ignores rate commands
        try {
          const write = async (bytes: number[]) => {
            const b64 = Buffer.from(bytes).toString('base64');
            await connected.writeCharacteristicWithResponseForService(SERVICE_UUID, WRITE_UUID, b64);
            await new Promise((r) => setTimeout(r, 120));
          };

          addLog('Unlocking device for config…');
          await write([0xff, 0xaa, 0x69, 0x88, 0xb5]); // unlock

          addLog('Setting output rate to 100Hz…');
          await write([0xff, 0xaa, 0x03, 0x09, 0x00]); // rate = 100Hz

          addLog('Saving config to flash…');
          await write([0xff, 0xaa, 0x00, 0x00, 0x00]); // save

          addLog('Rate config complete — 100Hz active', 'success');
        } catch (e: any) {
          addLog(`Rate config failed: ${e.message}`, 'error');
        }

        // Log all services + characteristics so we can find the real UUIDs
        const services = await connected.services();
        for (const svc of services) {
          addLog(`Service: ${svc.uuid}`);
          const chars = await svc.characteristics();
          for (const ch of chars) {
            addLog(`  Char: ${ch.uuid} [r:${ch.isReadable} w:${ch.isWritableWithResponse} n:${ch.isNotifiable}]`);
          }
        }

        subscriptionRef.current = connected.monitorCharacteristicForService(
          SERVICE_UUID,
          CHAR_UUID,
          (err, char) => {
            if (err) {
              addLog(`Monitor error: ${err.message}`, 'error');
              return;
            }

            if (!char?.value) {
              return;
            }

            const packets = parsePacket(char.value);
            packets.forEach((pkt) => {
              setSensorData((prev) => ({ ...prev, [pkt.type]: pkt }));
              if (pkt.type === 'accel') {
                processRepAccel(pkt.x, pkt.y, pkt.z);
              }
            });
          }
        );

        connected.onDisconnected((err) => {
          addLog(`Disconnected${err ? `: ${err.message}` : ''}`, err ? 'error' : 'info');
          setConnectedDevice(null);
          setSensorData({ accel: null, gyro: null, angle: null, mag: null });
          subscriptionRef.current = null;
          resetReps();
        });
      } catch (e: any) {
        addLog(`Connection failed: ${e.message}`, 'error');
      }
    },
    [addLog, processRepAccel, resetReps]
  );

  const shareLogs = useCallback(async () => {
    if (logs.length === 0) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        addLog('Sharing not available on this device', 'error');
        return;
      }
      const text = [...logs].reverse().map((e) => e.text).join('\n');
      const path = `${FileSystem.cacheDirectory}ble-log.txt`;
      await FileSystem.writeAsStringAsync(path, text, { encoding: 'utf8' });
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'BLE Event Log' });
    } catch (e: any) {
      addLog(`Share failed: ${e.message}`, 'error');
    }
  }, [logs, addLog]);

  const disconnect = useCallback(async () => {
    if (!connectedDevice) {
      return;
    }

    try {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
      setSensorData({ accel: null, gyro: null, angle: null, mag: null });
      addLog('Disconnected');
    } catch (e: any) {
      addLog(`Disconnect error: ${e.message}`, 'error');
    }
  }, [connectedDevice, addLog]);

  if (Platform.OS === 'web') {
    return (
      <MasterLayout>
        <View className="flex-1 items-center justify-center p-8">
          <BluetoothOff size={48} color={theme.colors.text.tertiary} />
          <Text className="mt-4 text-center text-text-secondary">BLE is not supported on web.</Text>
        </View>
      </MasterLayout>
    );
  }

  const isOn = bleState === State.PoweredOn;

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-4 p-4">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-text-primary">BLE Test</Text>
            <Text className="text-text-secondary">WT9011DCL IMU Sensor</Text>
          </View>

          {/* BLE state */}
          <View className="flex-row items-center gap-3 rounded-xl border border-border-accent bg-bg-overlay p-4">
            {isOn ? (
              <Bluetooth size={theme.iconSize.lg} color={theme.colors.accent.primary} />
            ) : (
              <BluetoothOff size={theme.iconSize.lg} color={theme.colors.status.error} />
            )}
            <View className="flex-1">
              <Text className="text-sm font-bold text-text-primary">Bluetooth</Text>
              <Text className={`text-xs ${isOn ? 'text-status-success' : 'text-status-error'}`}>
                {bleState}
              </Text>
            </View>
            {connectedDevice ? (
              <View className="flex-row items-center gap-1">
                <Wifi size={theme.iconSize.sm} color={theme.colors.status.success} />
                <Text className="text-status-success text-xs">Connected</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1">
                <WifiOff size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
                <Text className="text-xs text-text-tertiary">Not connected</Text>
              </View>
            )}
          </View>

          {/* Connected device controls */}
          {connectedDevice ? (
            <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-bold text-text-primary">
                  {connectedDevice.name ?? connectedDevice.id}
                </Text>
                <Pressable
                  onPress={disconnect}
                  className="bg-status-error/20 flex-row items-center gap-1 rounded-lg px-3 py-1.5"
                >
                  <X size={theme.iconSize.sm} color={theme.colors.status.error} />
                  <Text className="text-status-error text-xs font-bold">Disconnect</Text>
                </Pressable>
              </View>

              {/* Sensor grid */}
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <SensorCard packet={sensorData.angle} type="angle" />
                  <SensorCard packet={sensorData.accel} type="accel" />
                </View>
                <View className="flex-row gap-3">
                  <SensorCard packet={sensorData.gyro} type="gyro" />
                  <SensorCard packet={sensorData.mag} type="mag" />
                </View>
              </View>

              {/* Rep Counter */}
              <View className="mt-3 rounded-xl border border-border-light bg-bg-primary p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-bold text-text-primary">Rep Counter</Text>
                  <Pressable onPress={resetReps} className="rounded-lg border border-border-light px-3 py-1">
                    <Text className="text-xs text-text-tertiary">Reset</Text>
                  </Pressable>
                </View>

                <View className="items-center py-4">
                  <Text className="text-8xl font-bold text-accent-primary">{repCount}</Text>
                  <Text className="mt-1 text-sm text-text-tertiary">reps</Text>
                </View>

                <View
                  className={`mt-2 items-center rounded-lg py-2 ${repPhase === 'active' ? 'bg-accent-primary/20' : 'bg-bg-overlay'}`}
                >
                  <Text
                    className={`text-xs font-bold uppercase tracking-widest ${repPhase === 'active' ? 'text-accent-primary' : 'text-text-tertiary'}`}
                  >
                    {repPhase === 'active' ? '● Moving' : '○ Rest'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* Scan controls */
            <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
              <Text className="mb-3 font-bold text-text-primary">Device Scan</Text>
              <View className="flex-row gap-3">
                <Button
                  onPress={scanning ? stopScan : startScan}
                  label={scanning ? 'Stop Scan' : 'Start Scan'}
                  size="sm"
                  variant={scanning ? 'secondary' : 'accent'}
                />
              </View>

              {scanning ? (
                <View className="mt-3 flex-row items-center gap-2">
                  <RefreshCw size={theme.iconSize.sm} color={theme.colors.accent.primary} />
                  <Text className="text-sm text-text-secondary">Scanning (15s)…</Text>
                </View>
              ) : null}

              {foundDevices.length > 0 ? (
                <View className="mt-4 gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                    Found devices ({foundDevices.length})
                  </Text>
                  {foundDevices.map((device) => (
                    <Pressable
                      key={device.id}
                      onPress={() => connectDevice(device)}
                      className="flex-row items-center justify-between rounded-lg border border-border-light bg-bg-primary p-3"
                    >
                      <View>
                        <Text className="font-medium text-text-primary">
                          {device.name ?? device.localName ?? 'Unknown'}
                        </Text>
                        <Text className="text-xs text-text-tertiary">{device.id}</Text>
                      </View>
                      <Text className="text-xs font-bold text-accent-primary">Connect</Text>
                    </Pressable>
                  ))}
                </View>
              ) : !scanning ? (
                <Text className="mt-3 text-sm text-text-tertiary">
                  No devices found. Press Start Scan to search.
                </Text>
              ) : null}
            </View>
          )}

          {/* Log */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-bold text-text-primary">Event Log</Text>
              <View className="flex-row items-center gap-3">
                <Pressable onPress={shareLogs} className="flex-row items-center gap-1">
                  <Share2 size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
                  <Text className="text-xs text-text-tertiary">Share</Text>
                </Pressable>
                <Pressable onPress={() => setLogs([])}>
                  <Text className="text-xs text-text-tertiary">Clear</Text>
                </Pressable>
              </View>
            </View>
            <View className="max-h-64 rounded-lg border border-border-light bg-bg-primary p-2">
              {logs.length === 0 ? (
                <Text className="py-2 text-center text-xs text-text-tertiary">No events yet</Text>
              ) : (
                logs.map((entry) => (
                  <Text key={entry.id} className={`text-xs ${LOG_COLORS[entry.level]}`}>
                    {entry.text}
                  </Text>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
