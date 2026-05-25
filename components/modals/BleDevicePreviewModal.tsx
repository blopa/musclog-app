import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';

import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { useTheme } from '@/hooks/useTheme';
import { useWitMotion } from '@/modules/witmotion-ble';

import { FullScreenModal } from './FullScreenModal';

type DataMode = 'angle' | 'accel' | 'gyro';
type DataPoint = { x: number; a: number; b: number; c: number };

const MAX_POINTS = 80;
const MIN_RENDER_INTERVAL_MS = 50;

function toPointsArray(pts: { x: number; y: number }[]) {
  return pts.map((p) => ({ x: p.x, y: p.y, xValue: p.x, yValue: p.y }));
}

interface BleDevicePreviewModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BleDevicePreviewModal({ visible, onClose }: BleDevicePreviewModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const wit = useWitMotion();
  const { liveData, isConnected } = wit;

  const [mode, setMode] = useState<DataMode>('angle');
  const [buffer, setBuffer] = useState<DataPoint[]>([]);
  const counterRef = useRef(0);
  const lastRenderRef = useRef(0);

  useEffect(() => {
    if (visible) {
      return;
    }
    const reset = () => {
      setBuffer([]);
    };
    reset();
    counterRef.current = 0;
    lastRenderRef.current = 0;
  }, [visible]);

  useEffect(() => {
    const reset = () => {
      setBuffer([]);
    };
    reset();
    counterRef.current = 0;
    lastRenderRef.current = 0;
  }, [mode]);

  useEffect(() => {
    if (!visible || !liveData.updatedAt) {
      return;
    }
    const now = Date.now();
    if (now - lastRenderRef.current < MIN_RENDER_INTERVAL_MS) {
      return;
    }
    lastRenderRef.current = now;

    const vec =
      mode === 'angle' ? liveData.angle : mode === 'accel' ? liveData.accel : liveData.gyro;
    if (!vec) {
      return;
    }

    counterRef.current += 1;
    const x = counterRef.current;
    setBuffer((prev) => {
      const next = [...prev, { x, a: vec.x, b: vec.y, c: vec.z }];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }, [visible, liveData, mode]);

  const xDomain = useMemo<[number, number]>(() => {
    if (buffer.length < 2) {
      return [0, MAX_POINTS];
    }
    return [buffer[0].x, buffer[buffer.length - 1].x];
  }, [buffer]);

  const yDomain = useMemo<[number, number]>(() => {
    if (buffer.length === 0) {
      return [-1, 1];
    }
    const all = buffer.flatMap((p) => [p.a, p.b, p.c]);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = max - min || 1;
    const pad = range * 0.15;
    return [min - pad, max + pad];
  }, [buffer]);

  const last = buffer[buffer.length - 1];
  const unitForMode = mode === 'angle' ? '°' : mode === 'accel' ? ' g' : ' °/s';

  const segmentOptions = [
    { label: t('settings.bleDevices.previewAngle'), value: 'angle' },
    { label: t('settings.bleDevices.previewAccel'), value: 'accel' },
    { label: t('settings.bleDevices.previewGyro'), value: 'gyro' },
  ];

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.bleDevices.previewTitle')}
    >
      <View className="gap-4 p-4">
        <SegmentedControl
          options={segmentOptions}
          value={mode}
          onValueChange={(v) => setMode(v as DataMode)}
        />

        <View style={{ height: 240 }}>
          {!isConnected ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-sm text-text-tertiary">
                {t('settings.bleDevices.previewDisconnected')}
              </Text>
            </View>
          ) : buffer.length < 2 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-sm text-text-tertiary">
                {t('settings.bleDevices.previewWaiting')}
              </Text>
            </View>
          ) : (
            <CartesianChart
              data={buffer as unknown as Record<string, number>[]}
              xKey="x"
              yKeys={['a', 'b', 'c']}
              domain={{ x: xDomain, y: yDomain }}
              domainPadding={{ top: 8, bottom: 8, left: 0, right: 0 }}
              axisOptions={{
                lineColor: theme.colors.border.light,
                labelColor: 'transparent',
              }}
            >
              {({ points }) => {
                const p = points as unknown as Record<string, { x: number; y: number }[]>;
                return (
                  <>
                    <Line
                      points={toPointsArray(p.a)}
                      color={theme.colors.accent.primary}
                      strokeWidth={2}
                      curveType="linear"
                    />
                    <Line
                      points={toPointsArray(p.b)}
                      color={theme.colors.status.success}
                      strokeWidth={2}
                      curveType="linear"
                    />
                    <Line
                      points={toPointsArray(p.c)}
                      color={theme.colors.status.warning}
                      strokeWidth={2}
                      curveType="linear"
                    />
                  </>
                );
              }}
            </CartesianChart>
          )}
        </View>

        {last ? (
          <View className="flex-row justify-around rounded-xl border border-border-light bg-bg-primary py-4">
            {[
              { label: 'X', value: last.a, color: theme.colors.accent.primary },
              { label: 'Y', value: last.b, color: theme.colors.status.success },
              { label: 'Z', value: last.c, color: theme.colors.status.warning },
            ].map(({ label, value, color }) => (
              <View key={label} className="items-center gap-1">
                <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: color }} />
                <Text className="text-xs text-text-tertiary">{label}</Text>
                <Text className="text-sm font-semibold text-text-primary">
                  {value.toFixed(2)}
                  {unitForMode}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </FullScreenModal>
  );
}
