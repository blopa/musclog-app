import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { CYCLE_PHASE_LABEL_KEYS } from '@/constants/cycle';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { type Theme } from '@/theme';
import type { CyclePhase, PhaseSegment } from '@/utils/cycle/cycleTimeline';

type PhaseWheelProps = {
  currentPhase: CyclePhase | null;
  /** Days since the last logged period start. */
  cycleDay: number;
  totalDays: number;
  /** From the cycle timeline. Null when the layout would be a guess (late, hidden). */
  segments: PhaseSegment[] | null;
};

function phaseColor(key: PhaseSegment['key'], theme: Theme) {
  switch (key) {
    case 'menstrual':
      return theme.colors.status.error;
    case 'between':
      return theme.colors.accent.primary;
    case 'follicular':
      return theme.colors.status.brandBright;
    case 'ovulatory':
      return theme.colors.status.amber;
    case 'luteal':
      return theme.colors.status.purple;
  }
}

export function PhaseWheel({ currentPhase, cycleDay, totalDays, segments }: PhaseWheelProps) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const theme = useTheme();

  const PHASES = (segments ?? [])
    .filter((segment) => segment.length > 0)
    .map((segment) => ({
      key: segment.key,
      color: phaseColor(segment.key, theme),
      startDay: segment.startDay,
      length: segment.length,
    }));

  const size = 260;
  const strokeWidth = 16;
  const markerRadius = strokeWidth / 2 + 4; // 12 — day indicator circle radius
  // Constrain ring radius so the marker never clips the SVG boundary
  const radius = size / 2 - strokeWidth / 2 - markerRadius - 2; // 116
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Small angular gap (in degrees) between segments for visual clarity
  const gapDeg = (3 / circumference) * 360;

  // Current day indicator angle (progress through the cycle)
  // Clamped so an overdue period parks the marker at the end instead of wrapping to Day 1.
  const dayRotation = (Math.min(cycleDay - 1, totalDays) / totalDays) * 360;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer G rotates origin so 0° = top (12 o'clock) */}
        <G transform={`rotate(-90, ${center}, ${center})`}>
          {/* Track background */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={theme.colors.background.buttonCardActive}
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Phase arcs */}
          {PHASES.map((phase) => {
            const startDay = phase.startDay;
            const rawStartDeg = (startDay / totalDays) * 360;
            const rawSweepDeg = (phase.length / totalDays) * 360;

            // Inset each segment by half the gap on each side
            const startDeg = rawStartDeg + gapDeg / 2;
            const sweepDeg = rawSweepDeg - gapDeg;

            const dashLength = (sweepDeg / 360) * circumference;
            const gapLength = circumference - dashLength;

            return (
              <Circle
                key={phase.key}
                cx={center}
                cy={center}
                r={radius}
                stroke={phase.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${gapLength}`}
                strokeLinecap="butt"
                fill="transparent"
                transform={`rotate(${startDeg}, ${center}, ${center})`}
                opacity={currentPhase === phase.key ? 1 : 0.3}
              />
            );
          })}

          {/* Current day marker */}
          <G transform={`rotate(${dayRotation}, ${center}, ${center})`}>
            <Circle
              cx={center + radius}
              cy={center}
              r={markerRadius}
              fill={theme.colors.text.primary}
              stroke={theme.colors.background.primary}
              strokeWidth={2}
            />
          </G>
        </G>
      </Svg>

      {/* Center overlay: what was logged (the day count), then the estimated phase */}
      <View className="absolute items-center justify-center">
        <Text className="text-xs font-semibold text-text-tertiary">{t('focus.day')}</Text>
        <Text className="text-5xl font-bold text-text-primary">{formatInteger(cycleDay)}</Text>
        <Text className="mt-1 text-xs font-semibold text-accent-primary">
          {currentPhase ? t(CYCLE_PHASE_LABEL_KEYS[currentPhase]) : t('cycle.phaseUnknown')}
        </Text>
        {currentPhase && currentPhase !== 'menstrual' && currentPhase !== 'between' ? (
          <Text className="text-xs text-text-tertiary">{t('cycle.phaseEstimated')}</Text>
        ) : null}
      </View>
    </View>
  );
}
