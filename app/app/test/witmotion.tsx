import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line as SvgLine, Polyline, Text as SvgText } from 'react-native-svg';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { useWitMotion } from '@/modules/witmotion-ble';

function valueOrDash(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) {
    return '—';
  }

  return value.toFixed(digits);
}

const CHART_MAX_POINTS = 180;
const CHART_Y_RANGE = 2.0;

function MovementChart({ data }: { data: number[] }) {
  const WIDTH = 320;
  const HEIGHT = 160;
  const PAD_LEFT = 32;
  const PAD_RIGHT = 8;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 20;
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const midY = PAD_TOP + innerH / 2;

  const points =
    data.length < 2
      ? ''
      : data
          .map((v, i) => {
            const x = PAD_LEFT + (i / (CHART_MAX_POINTS - 1)) * innerW;
            const y = midY - (v / CHART_Y_RANGE) * (innerH / 2);
            return `${x.toFixed(1)},${Math.max(PAD_TOP, Math.min(PAD_TOP + innerH, y)).toFixed(1)}`;
          })
          .join(' ');

  return (
    <View className="overflow-hidden rounded-lg border border-border-light bg-bg-primary">
      <Svg width={WIDTH} height={HEIGHT}>
        <SvgLine
          x1={PAD_LEFT}
          y1={midY}
          x2={WIDTH - PAD_RIGHT}
          y2={midY}
          stroke="#444"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
        {[-1, 1].map((g) => {
          const gy = midY - (g / CHART_Y_RANGE) * (innerH / 2);
          return (
            <SvgLine
              key={g}
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
        {[[-CHART_Y_RANGE, `−${CHART_Y_RANGE}g`], [0, '0g'], [CHART_Y_RANGE, `+${CHART_Y_RANGE}g`]].map(
          ([val, label]) => {
            const ly = midY - ((val as number) / CHART_Y_RANGE) * (innerH / 2);
            return (
              <SvgText
                key={String(label)}
                x={PAD_LEFT - 4}
                y={ly + 4}
                fontSize={9}
                fill="#888"
                textAnchor="end"
              >
                {String(label)}
              </SvgText>
            );
          }
        )}
        {points ? <Polyline points={points} fill="none" stroke="#4ade80" strokeWidth={1.5} /> : null}
      </Svg>
    </View>
  );
}

export default function WitMotionTestScreen() {
  const wit = useWitMotion();
  const requestPermissions = wit.requestPermissions;
  const [chartData, setChartData] = useState<number[]>([]);

  const accelMagnitude = useMemo(() => {
    const accel = wit.liveData.accel;
    if (!accel) {
      return null;
    }

    return Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z) - 1.0;
  }, [wit.liveData.accel]);

  useEffect(() => {
    void requestPermissions();
  }, [requestPermissions]);

  useEffect(() => {
    if (accelMagnitude === null) {
      setChartData([]);
      return;
    }

    setChartData((prev) => {
      const next = [...prev, accelMagnitude];
      if (next.length > CHART_MAX_POINTS) {
        next.splice(0, next.length - CHART_MAX_POINTS);
      }
      return next;
    });
  }, [accelMagnitude]);

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-4 p-4">
          <View>
            <Text className="text-2xl font-bold text-text-primary">Wit Motion BLE</Text>
            <Text className="text-text-secondary">Expo hook demo for WT sensors</Text>
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
              Status
            </Text>
            <Text className="text-sm text-text-primary">Bluetooth: {String(wit.bleState)}</Text>
            <Text className="text-sm text-text-primary">Mode: {wit.status}</Text>
            <Text className="text-sm text-text-primary">Scanning: {wit.isScanning ? 'yes' : 'no'}</Text>
            <Text className="text-sm text-text-primary">
              Connected: {wit.connectedDevice?.name ?? 'no device'}
            </Text>
            {wit.error ? <Text className="mt-2 text-sm text-status-error">{wit.error}</Text> : null}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-3 font-bold text-text-primary">Scan</Text>
            <View className="flex-row gap-3">
              <Button
                label={wit.isScanning ? 'Stop Scan' : 'Start Scan'}
                onPress={() => {
                  if (wit.isScanning) {
                    wit.stopScan();
                    return;
                  }

                  void wit.startScan({ autoConnect: true });
                }}
                size="sm"
                variant={wit.isScanning ? 'secondary' : 'accent'}
              />
              {wit.connectedDevice ? (
                <Button label="Disconnect" onPress={() => void wit.disconnect()} size="sm" variant="secondary" />
              ) : null}
            </View>

            {wit.discoveredDevices.length > 0 ? (
              <View className="mt-4 gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Found devices ({wit.discoveredDevices.length})
                </Text>
                {wit.discoveredDevices.map((device) => (
                  <Pressable
                    key={device.id}
                    onPress={() => void wit.connect(device)}
                    className="rounded-lg border border-border-light bg-bg-primary p-3"
                  >
                    <Text className="font-medium text-text-primary">{device.name}</Text>
                    <Text className="text-xs text-text-tertiary">{device.id}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-3 font-bold text-text-primary">Live data</Text>
            <Text className="text-sm text-text-primary">
              Accel: {valueOrDash(wit.liveData.accel?.x)} / {valueOrDash(wit.liveData.accel?.y)} /{' '}
              {valueOrDash(wit.liveData.accel?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Gyro: {valueOrDash(wit.liveData.gyro?.x)} / {valueOrDash(wit.liveData.gyro?.y)} /{' '}
              {valueOrDash(wit.liveData.gyro?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Angle: {valueOrDash(wit.liveData.angle?.x)} / {valueOrDash(wit.liveData.angle?.y)} /{' '}
              {valueOrDash(wit.liveData.angle?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Magnetic: {valueOrDash(wit.liveData.magnetic?.x)} / {valueOrDash(wit.liveData.magnetic?.y)} /{' '}
              {valueOrDash(wit.liveData.magnetic?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Battery: {valueOrDash(wit.liveData.batteryPercent, 0)}% ({valueOrDash(wit.liveData.batteryVoltage)} V)
            </Text>
            <Text className="text-xs text-text-tertiary">Packets received: {wit.packetCount}</Text>
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-2 font-bold text-text-primary">Movement</Text>
            <Text className="mb-3 text-xs text-text-tertiary">
              Net acceleration (|a| - 1g) · last {CHART_MAX_POINTS} samples
            </Text>
            {chartData.length > 1 ? (
              <MovementChart data={chartData} />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">Move the device to see the waveform</Text>
              </View>
            )}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-3 font-bold text-text-primary">Commands</Text>
            <View className="flex-row flex-wrap gap-2">
              <Button label="Reset" onPress={() => void wit.reset()} size="sm" variant="secondary" />
              <Button label="Angle 0" onPress={() => void wit.setAngleZero()} size="sm" variant="secondary" />
              <Button
                label="Mag start"
                onPress={() => void wit.startMagCalibration()}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Mag stop"
                onPress={() => void wit.stopMagCalibration()}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Rate 100Hz"
                onPress={() => void wit.setOutputRate(100)}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Bandwidth 20"
                onPress={() => void wit.setBandwidth(20)}
                size="sm"
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
