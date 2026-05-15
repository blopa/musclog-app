import {
  addConnectionListener,
  addDeviceFoundListener,
  addErrorListener,
  addLogListener,
  addPacketListener,
  connect as connectWitmotion,
  disconnect as disconnectWitmotion,
  getBondedDevices as getWitmotionBondedDevices,
  setOutputRate as setWitmotionOutputRate,
  startScan as startWitmotionScan,
  stopScan as stopWitmotionScan,
  type WitPacket,
  type WitScannedDevice,
} from '@musclog/witmotion-ble';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Bluetooth, BluetoothOff, RefreshCw, Share2, Wifi, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line as SvgLine, Polyline, Text as SvgText } from 'react-native-svg';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

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

async function ensureBlePermissions() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const apiLevel =
    typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  const permissions =
    apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]
      : [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

  const result = await PermissionsAndroid.requestMultiple(
    permissions as Parameters<typeof PermissionsAndroid.requestMultiple>[0]
  );
  return permissions.every(
    (permission) =>
      result[permission as keyof typeof result] === PermissionsAndroid.RESULTS.GRANTED
  );
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

const CHART_WINDOW_MS = 3000;
const MIN_Y_RANGE = 0.4; // always show at least ±0.4g even when device is still

interface ChartPoint {
  t: number;
  v: number;
}

function MovementChart({ points, now }: { points: ChartPoint[]; now: number }) {
  const WIDTH = 320;
  const HEIGHT = 160;
  const PAD_LEFT = 36;
  const PAD_RIGHT = 8;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 16;
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const midY = PAD_TOP + innerH / 2;

  // Auto-scale: find the actual peak in visible data
  const windowStart = now - CHART_WINDOW_MS;
  const visible = points.filter((p) => p.t >= windowStart);
  const peak = visible.reduce((m, p) => Math.max(m, Math.abs(p.v)), MIN_Y_RANGE);
  const yRange = peak * 1.2; // 20% headroom

  const toX = (t: number) => PAD_LEFT + ((t - windowStart) / CHART_WINDOW_MS) * innerW;
  const toY = (v: number) =>
    Math.max(PAD_TOP, Math.min(PAD_TOP + innerH, midY - (v / yRange) * (innerH / 2)));

  const poly =
    visible.length < 2
      ? ''
      : visible.map((p) => `${toX(p.t).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ');

  const yLabel = (v: number) =>
    (v >= 1 ? `+${v.toFixed(1)}` : v <= -1 ? v.toFixed(1) : v.toFixed(2)) + 'g';

  return (
    <View className="overflow-hidden rounded-lg border border-border-light bg-bg-primary">
      <Svg width={WIDTH} height={HEIGHT}>
        <SvgLine
          x1={PAD_LEFT}
          y1={midY}
          x2={WIDTH - PAD_RIGHT}
          y2={midY}
          stroke="#555"
          strokeWidth={1}
          strokeDasharray="4,3"
        />
        {[-1, 1].map((sign) => {
          const gy = toY(sign * yRange * 0.75);
          return (
            <SvgLine
              key={sign}
              x1={PAD_LEFT}
              y1={gy}
              x2={WIDTH - PAD_RIGHT}
              y2={gy}
              stroke="#333"
              strokeWidth={1}
              strokeDasharray="2,6"
            />
          );
        })}
        <SvgText x={PAD_LEFT - 3} y={PAD_TOP + 8} fontSize={8} fill="#888" textAnchor="end">
          {yLabel(yRange)}
        </SvgText>
        <SvgText x={PAD_LEFT - 3} y={midY + 4} fontSize={8} fill="#888" textAnchor="end">
          0g
        </SvgText>
        <SvgText x={PAD_LEFT - 3} y={PAD_TOP + innerH} fontSize={8} fill="#888" textAnchor="end">
          {yLabel(-yRange)}
        </SvgText>
        {poly ? <Polyline points={poly} fill="none" stroke="#4ade80" strokeWidth={2} /> : null}
      </Svg>
    </View>
  );
}

export default function BleTestScreen() {
  const theme = useTheme();
  const [bleState] = useState('PoweredOn');
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);
  const [foundDevices, setFoundDevices] = useState<WitScannedDevice[]>([]);
  const [bondedDevices, setBondedDevices] = useState<WitScannedDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<WitScannedDevice | null>(null);
  const [sensorData, setSensorData] = useState<SensorData>({
    accel: null,
    gyro: null,
    angle: null,
    mag: null,
  });
  // Ref holds latest data without triggering renders — UI polls this at 100ms
  const sensorDataRef = useRef<SensorData>({ accel: null, gyro: null, angle: null, mag: null });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pktPerSec, setPktPerSec] = useState(0);
  const [maxGapMs, setMaxGapMs] = useState(0);
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartNow, setChartNow] = useState(0);
  const chartBufferRef = useRef<ChartPoint[]>([]);
  const burstValuesRef = useRef<number[]>([]);
  const lastFlushTimeRef = useRef<number>(0);
  // Gap tracking — definitive diagnostic for BLE connection interval
  const lastPktTimestampRef = useRef(0);
  const maxGapWindowRef = useRef(0);
  const logIdRef = useRef(0);
  const pktCountRef = useRef(0);

  // Refresh UI and flush burst data at 50ms cadence while connected.
  // Burst temporal interpolation: values accumulated since last flush are given evenly-spaced
  // synthetic timestamps that span from lastFlushTime to now. This re-expands iOS-batched BLE
  // bursts back into their correct positions on the time axis.
  useEffect(() => {
    if (!connectedDevice) {
      setPktPerSec(0);
      setMaxGapMs(0);
      setSensorData({ accel: null, gyro: null, angle: null, mag: null });
      setChartPoints([]);
      chartBufferRef.current = [];
      burstValuesRef.current = [];
      lastFlushTimeRef.current = 0;
      lastPktTimestampRef.current = 0;
      maxGapWindowRef.current = 0;
      return;
    }
    lastFlushTimeRef.current = Date.now();
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      const now = Date.now();

      const burst = burstValuesRef.current.splice(0);
      if (burst.length > 0) {
        const flushStart = lastFlushTimeRef.current;
        const interval = now - flushStart;
        const newPoints: ChartPoint[] = burst.map((v, i) => ({
          t: flushStart + ((i + 1) / burst.length) * interval,
          v,
        }));
        const cutoff = now - CHART_WINDOW_MS;
        chartBufferRef.current = [...chartBufferRef.current, ...newPoints].filter(
          (p) => p.t >= cutoff
        );
      }
      lastFlushTimeRef.current = now;

      setSensorData({ ...sensorDataRef.current });
      setChartPoints([...chartBufferRef.current]);
      setChartNow(now);

      // Every second: update pkt/s and max gap, then reset window counters
      if (tick % 20 === 0) {
        setPktPerSec(pktCountRef.current);
        setMaxGapMs(maxGapWindowRef.current);
        pktCountRef.current = 0;
        maxGapWindowRef.current = 0;
      }
    }, 50);
    return () => clearInterval(id);
  }, [connectedDevice]);

  const addLog = useCallback((text: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => [
      { id: logIdRef.current++, text: `[${new Date().toLocaleTimeString()}] ${text}`, level },
      ...prev.slice(0, 99),
    ]);
  }, []);

  const sendRateCommand = useCallback(
    async (hz: 20 | 50 | 100) => {
      if (!connectedDevice) {
        return;
      }
      try {
        addLog(`Setting rate to ${hz}Hz…`);
        await setWitmotionOutputRate(hz);
        addLog(`Rate set to ${hz}Hz`, 'success');
      } catch (e: any) {
        addLog(`Rate error: ${e.message}`, 'error');
      }
    },
    [connectedDevice, addLog]
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const listeners = [
      addDeviceFoundListener((device) => {
        if (!scanningRef.current) {
          return;
        }
        setFoundDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) {
            return prev;
          }
          addLog(`Found: ${device.name ?? device.localName ?? 'Unknown'} (${device.id})`);
          return [...prev, device];
        });
      }),
      addConnectionListener((event) => {
        if (event.message) {
          addLog(event.message, event.state === 'disconnected' ? 'info' : 'data');
        }
        if (event.state === 'disconnected') {
          setConnectedDevice(null);
          setSensorData({ accel: null, gyro: null, angle: null, mag: null });
          sensorDataRef.current = { accel: null, gyro: null, angle: null, mag: null };
          chartBufferRef.current = [];
          burstValuesRef.current = [];
          lastPktTimestampRef.current = 0;
          maxGapWindowRef.current = 0;
          pktCountRef.current = 0;
        }
      }),
      addPacketListener((event) => {
        const pkt = event.packet as WitPacket;
        pktCountRef.current++;

        const pktTs = Date.now();
        if (lastPktTimestampRef.current > 0) {
          const gap = pktTs - lastPktTimestampRef.current;
          if (gap > maxGapWindowRef.current) {
            maxGapWindowRef.current = gap;
          }
        }
        lastPktTimestampRef.current = pktTs;

        const parsed: ParsedPacket = {
          type: pkt.type,
          x: pkt.x,
          y: pkt.y,
          z: pkt.z,
          timestamp: pkt.timestamp,
        };

        sensorDataRef.current = { ...sensorDataRef.current, [parsed.type]: parsed };
        if (parsed.type === 'accel') {
          const net =
            Math.sqrt(parsed.x * parsed.x + parsed.y * parsed.y + parsed.z * parsed.z) - 1.0;
          burstValuesRef.current.push(net);
        }
      }),
      addErrorListener((event) => {
        addLog(event.message, 'error');
      }),
      addLogListener((event) => {
        addLog(event.message, event.level);
      }),
    ];

    return () => {
      listeners.forEach((listener) => listener.remove());
    };
  }, [addLog]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    getWitmotionBondedDevices()
      .then((devices) => {
        setBondedDevices(devices);
        if (devices.length > 0) {
          addLog(`Loaded ${devices.length} bonded device(s)`, 'data');
        }
      })
      .catch((e: any) => {
        addLog(`Bonded device lookup failed: ${e.message}`, 'error');
      });
  }, [addLog]);

  const startScan = useCallback(() => {
    (async () => {
      const allowed = await ensureBlePermissions();
      if (!allowed) {
        addLog('Bluetooth permissions were not granted.', 'error');
        return;
      }

      setFoundDevices([]);
      scanningRef.current = true;
      setScanning(true);
      addLog('Scanning for WT9011DCL devices…');
      startWitmotionScan().catch((e: any) => {
        addLog(`Scan error: ${e.message}`, 'error');
        setScanning(false);
        scanningRef.current = false;
      });

      setTimeout(() => {
        stopWitmotionScan().catch(() => {});
        setScanning(false);
        scanningRef.current = false;
        addLog('Scan stopped');
      }, 15000);
    })().catch((e: any) => {
      addLog(`Permission error: ${e.message}`, 'error');
    });
  }, [addLog]);

  const stopScan = useCallback(() => {
    stopWitmotionScan().catch(() => {});
    setScanning(false);
    scanningRef.current = false;
    addLog('Scan stopped by user');
  }, [addLog]);

  const connectDevice = useCallback(
    async (device: WitScannedDevice) => {
      const allowed = await ensureBlePermissions();
      if (!allowed) {
        addLog('Bluetooth permissions were not granted.', 'error');
        return;
      }

      stopWitmotionScan().catch(() => {});
      setScanning(false);
      scanningRef.current = false;

      try {
        addLog(`Connecting to ${device.name ?? device.id}…`);
        const connected = await connectWitmotion(device.id, 50);
        pktCountRef.current = 0;
        lastPktTimestampRef.current = 0;
        maxGapWindowRef.current = 0;
        sensorDataRef.current = { accel: null, gyro: null, angle: null, mag: null };
        setConnectedDevice(connected);
        addLog(`Connected to ${connected.name ?? connected.id}`, 'success');
      } catch (e: any) {
        addLog(`Connection failed: ${e.message}`, 'error');
      }
    },
    [addLog]
  );

  const shareLogs = useCallback(async () => {
    if (logs.length === 0) {
      return;
    }
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        addLog('Sharing not available on this device', 'error');
        return;
      }
      const text = [...logs]
        .reverse()
        .map((e) => e.text)
        .join('\n');
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
      await disconnectWitmotion();
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

  const isOn = bleState === 'PoweredOn';

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
                <Text className="text-xs text-text-tertiary">Device disconnected</Text>
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

              {/* Data rate controls */}
              <View className="mt-3 flex-row items-center gap-3">
                <View className="flex-1 gap-1">
                  <View className="items-center rounded-xl border border-border-accent bg-bg-overlay py-2">
                    <Text className="text-2xl font-bold text-accent-primary">{pktPerSec}</Text>
                    <Text className="text-xs text-text-tertiary">pkt/s</Text>
                  </View>
                  <View
                    className={`items-center rounded-xl border py-2 ${maxGapMs > 200 ? 'border-status-error bg-status-error/10' : 'border-status-success bg-status-success/10'}`}
                  >
                    <Text
                      className={`text-lg font-bold ${maxGapMs > 200 ? 'text-status-error' : 'text-status-success'}`}
                    >
                      {maxGapMs}ms
                    </Text>
                    <Text className="text-xs text-text-tertiary">max gap</Text>
                  </View>
                </View>
                <View className="flex-1 gap-1">
                  <Text className="mb-1 text-xs font-bold uppercase text-text-tertiary">
                    Output rate
                  </Text>
                  {([20, 50, 100] as const).map((hz) => (
                    <Pressable
                      key={hz}
                      onPress={() => sendRateCommand(hz)}
                      className="items-center rounded-lg border border-border-light bg-bg-overlay py-1"
                    >
                      <Text className="text-xs font-bold text-text-primary">{hz} Hz</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Movement Waveform */}
              <View className="mt-3 rounded-xl border border-border-light bg-bg-primary p-4">
                <Text className="mb-2 font-bold text-text-primary">Movement</Text>
                <Text className="mb-3 text-xs text-text-tertiary">
                  Net acceleration (|a| − 1g) · last 3 seconds
                </Text>
                {chartPoints.length > 1 ? (
                  <MovementChart points={chartPoints} now={chartNow} />
                ) : (
                  <View className="items-center rounded-lg border border-border-light bg-bg-overlay py-8">
                    <Text className="text-xs text-text-tertiary">
                      Move the device to see the waveform
                    </Text>
                  </View>
                )}
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

              {bondedDevices.length > 0 ? (
                <View className="mb-4 gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                    Paired devices ({bondedDevices.length})
                  </Text>
                  {bondedDevices.map((device) => (
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
                  No nearby BLE devices found. Press Start Scan to search, or try a paired device
                  above.
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
