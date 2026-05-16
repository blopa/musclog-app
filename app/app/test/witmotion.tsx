import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line as SvgLine, Polyline, Text as SvgText } from 'react-native-svg';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { useWitMotion, witMotionClient } from '@/modules/witmotion-ble';
import type { WitMotionVector3 } from '@/modules/witmotion-ble';

function valueOrDash(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) {
    return '—';
  }

  return value.toFixed(digits);
}

const CHART_MAX_POINTS = 180;
const GRAVITY_MS2 = 9.81;
const SENSOR_DT_S = 0.01; // fixed 10 ms per sample — never derived from wall-clock timestamps
const RECONNECT_GAP_S = 2.0;

// High-pass filter coefficients — alpha = tau / (tau + dt)
// Accel HPF: tau = 1.0 s → cutoff ≈ 0.16 Hz. Removes static bias while passing gym-speed
// movements (≥ 0.5 Hz). A deadband is NOT needed; the HPF cancels bias algebraically.
const HPF_ALPHA_ACCEL = 1.0 / (1.0 + SENSOR_DT_S); // ≈ 0.990
// Velocity HPF: tau = 0.5 s → cutoff ≈ 0.32 Hz. Removes any drift that leaks through
// the accel HPF after integration so the velocity signal auto-zeros when stationary.
const HPF_ALPHA_VEL = 0.5 / (0.5 + SENSOR_DT_S); // ≈ 0.980

/**
 * Projects body-frame accel onto world-frame vertical using ZYX Euler angles
 * from the sensor's AHRS output. Yaw cancels for the vertical axis.
 * Returns signed vertical acceleration in g units; 0 = no vertical movement.
 */
function verticalAccelWorld(accel: WitMotionVector3, angle: WitMotionVector3): number {
  const roll = (angle.x * Math.PI) / 180;
  const pitch = (angle.y * Math.PI) / 180;
  // Third row of R = Rz(yaw)*Ry(pitch)*Rx(roll) — yaw term drops out here
  const azWorld =
    -Math.sin(pitch) * accel.x +
    Math.cos(pitch) * Math.sin(roll) * accel.y +
    Math.cos(pitch) * Math.cos(roll) * accel.z;
  return azWorld - 1.0;
}

interface ChartProps {
  data: number[];
  yRange: number;
  unitLabel: string;
  color?: string;
  zeroLabel?: string;
}

function SignedChart({ data, yRange, unitLabel, color = '#4ade80', zeroLabel }: ChartProps) {
  const WIDTH = 320;
  const HEIGHT = 160;
  const PAD_LEFT = 44;
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
            const y = midY - (v / yRange) * (innerH / 2);
            return `${x.toFixed(1)},${Math.max(PAD_TOP, Math.min(PAD_TOP + innerH, y)).toFixed(1)}`;
          })
          .join(' ');

  const labels: Array<[number, string]> = [
    [-yRange, `−${yRange}${unitLabel}`],
    [0, zeroLabel ?? `0${unitLabel}`],
    [yRange, `+${yRange}${unitLabel}`],
  ];

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
          const gy = midY - (g / yRange) * (innerH / 2);
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
        {labels.map(([val, label]) => {
          const ly = midY - (val / yRange) * (innerH / 2);
          return (
            <SvgText key={label} x={PAD_LEFT - 4} y={ly + 4} fontSize={9} fill="#888" textAnchor="end">
              {label}
            </SvgText>
          );
        })}
        {points ? <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} /> : null}
      </Svg>
    </View>
  );
}

export default function WitMotionTestScreen() {
  const wit = useWitMotion();
  const requestPermissions = wit.requestPermissions;

  const velBufRef = useRef<number[]>([]);
  const posBufRef = useRef<number[]>([]);
  const [velData, setVelData] = useState<number[]>([]);
  const [posData, setPosData] = useState<number[]>([]);

  // HPF state machine — no deadband, no clamp, no decay heuristics.
  // hpfAccel  = high-pass filtered vertical acceleration (bias removed)
  // rawVel    = integral of hpfAccel (in m/s)
  // hpfVel    = high-pass filtered rawVel (integration drift removed, auto-zeros at rest)
  // position  = integral of hpfVel (relative displacement in m)
  // prevAVert / prevRawVel are the previous raw values needed for the HPF difference term.
  const integRef = useRef({
    prevAVert: 0,
    hpfAccel: 0,
    rawVel: 0,
    prevRawVel: 0,
    hpfVel: 0,
    position: 0,
    lastTs: null as number | null,
    chartTick: 0,
  });
  const [positionCm, setPositionCm] = useState(0);
  const [velocityMs, setVelocityMs] = useState(0);

  useEffect(() => {
    void requestPermissions();
  }, [requestPermissions]);

  // Subscribe to every individual packet so none are discarded by the 250ms batch merge.
  // The liveData snapshot only carries the last packet per batch; integrating against it
  // produces a 25× dt error at 100 Hz which saturates the velocity chart immediately.
  useEffect(() => {
    return witMotionClient.onBatch((batch) => {
      const integ = integRef.current;

      for (const packet of batch.packets) {
        if (packet.kind !== 'motion') {
          continue;
        }

        const { accel, angle, timestamp } = packet;

        // Use the wall-clock timestamp ONLY to detect a real disconnection gap.
        // Never derive dt from it: packets inside the same BLE notification all share
        // the same millisecond timestamp, so (timestamp - lastTs) = 0 for most of them,
        // which would silently skip the integrator for every packet except the first.
        const wallGapS = integ.lastTs !== null ? (timestamp - integ.lastTs) / 1000 : 0;
        const isGap = wallGapS > RECONNECT_GAP_S;
        integ.lastTs = timestamp;

        if (isGap) {
          // Disconnection — reset filter state so old values don't pollute the next run.
          integ.prevAVert = 0;
          integ.hpfAccel = 0;
          integ.rawVel = 0;
          integ.prevRawVel = 0;
          integ.hpfVel = 0;
          continue;
        }

        const aVert = verticalAccelWorld(accel, angle);

        // Stage 1 — HPF on acceleration.
        // y[n] = α·(y[n-1] + x[n] − x[n-1])
        // This algebraically removes any constant bias so it never enters the integrator.
        integ.hpfAccel = HPF_ALPHA_ACCEL * (integ.hpfAccel + aVert - integ.prevAVert);
        integ.prevAVert = aVert;

        // Stage 2 — integrate HPF acceleration → raw velocity.
        integ.rawVel += integ.hpfAccel * GRAVITY_MS2 * SENSOR_DT_S;

        // Stage 3 — HPF on velocity removes integration drift; signal auto-zeros at rest.
        integ.hpfVel = HPF_ALPHA_VEL * (integ.hpfVel + integ.rawVel - integ.prevRawVel);
        integ.prevRawVel = integ.rawVel;

        // Stage 4 — integrate HPF velocity → position (relative displacement).
        integ.position += integ.hpfVel * SENSOR_DT_S;

        // Push to chart buffer every 5 packets (at 100 Hz → 20 Hz of chart data → 9 s visible).
        integ.chartTick = (integ.chartTick + 1) % 5;
        if (integ.chartTick === 0) {
          const vel = velBufRef.current;
          vel.push(integ.hpfVel * 100); // m/s → cm/s
          if (vel.length > CHART_MAX_POINTS) {
            vel.splice(0, vel.length - CHART_MAX_POINTS);
          }

          const pos = posBufRef.current;
          pos.push(integ.position * 100); // m → cm
          if (pos.length > CHART_MAX_POINTS) {
            pos.splice(0, pos.length - CHART_MAX_POINTS);
          }
        }
      }
    });
  }, []);

  // Throttle React state updates to 20 fps
  useEffect(() => {
    const interval = setInterval(() => {
      setVelData([...velBufRef.current]);
      setPosData([...posBufRef.current]);
      setPositionCm(integRef.current.position * 100);
      setVelocityMs(integRef.current.hpfVel);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleSetAnchor = useCallback(() => {
    const integ = integRef.current;
    integ.prevAVert = 0;
    integ.hpfAccel = 0;
    integ.rawVel = 0;
    integ.prevRawVel = 0;
    integ.hpfVel = 0;
    integ.position = 0;
    integ.lastTs = null;
    integ.chartTick = 0;
    velBufRef.current = [];
    posBufRef.current = [];
  }, []);

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

          {/* Vertical velocity chart */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-1 font-bold text-text-primary">Vertical velocity</Text>
            <Text className="mb-3 text-xs text-text-tertiary">
              + = moving up · − = moving down · near 0 = stationary · last {CHART_MAX_POINTS} samples
            </Text>
            {velData.length > 1 ? (
              <SignedChart data={velData} yRange={80} unitLabel="cm/s" color="#4ade80" />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">Connect a device to see data</Text>
              </View>
            )}
          </View>

          {/* Vertical position chart */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="font-bold text-text-primary">Vertical position</Text>
                <Text className="text-xs text-text-tertiary">
                  Displacement from anchor · last {CHART_MAX_POINTS} samples
                </Text>
              </View>
              <Button label="Set Anchor" onPress={handleSetAnchor} size="sm" variant="accent" />
            </View>
            <View className="mb-3 flex-row gap-4">
              <Text className="text-sm text-text-primary">
                Position: <Text className="font-bold">{positionCm.toFixed(1)} cm</Text>
              </Text>
              <Text className="text-sm text-text-primary">
                Velocity: <Text className="font-bold">{(velocityMs * 100).toFixed(1)} cm/s</Text>
              </Text>
            </View>
            {posData.length > 1 ? (
              <SignedChart data={posData} yRange={50} unitLabel="cm" color="#60a5fa" zeroLabel="anchor" />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">Press Set Anchor then move the device</Text>
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
