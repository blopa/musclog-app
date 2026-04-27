import { Zap } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { EnergyLevel, MenstrualPhase } from '@/database/services/MenstrualService';
import { useTheme } from '@/hooks/useTheme';
import { type Theme } from '@/theme';

type PhaseWheelProps = {
  currentPhase: MenstrualPhase | null;
  energyLevel: EnergyLevel | null;
  cycleDay: number;
  totalDays: number;
  avgPeriodDuration?: number;
};

// Helper function to calculate phase proportions dynamically
function calculatePhaseProportions(
  avgCycleLength: number,
  avgPeriodDuration: number,
  theme: Theme
) {
  const menstrualLength = avgPeriodDuration;
  const ovulationLength = 3; // Standard ovulation window

  // Remaining days after menstrual and ovulation phases
  const remainingDays = avgCycleLength - menstrualLength - ovulationLength;

  // Split remaining days between follicular and luteal phases
  // Follicular is typically shorter than luteal
  const follicularLength = Math.floor(remainingDays * 0.4);
  const lutealLength = remainingDays - follicularLength;

  return [
    { key: 'menstrual' as const, color: theme.colors.status.error, length: menstrualLength },
    {
      key: 'follicular' as const,
      color: theme.colors.status.emeraldLight,
      length: follicularLength,
    },
    { key: 'ovulation' as const, color: theme.colors.status.amber, length: ovulationLength },
    { key: 'luteal' as const, color: theme.colors.status.purple, length: lutealLength },
  ];
}

export function PhaseWheel({
  currentPhase,
  energyLevel,
  cycleDay,
  totalDays,
  avgPeriodDuration = 5,
}: PhaseWheelProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  // Calculate phases dynamically based on user's cycle
  const PHASES = calculatePhaseProportions(totalDays, avgPeriodDuration, theme);

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
  const dayRotation = ((cycleDay - 1) / totalDays) * 360;

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
          {PHASES.map((phase, index) => {
            const startDay = PHASES.slice(0, index).reduce((acc, p) => acc + p.length, 0);
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
              fill={theme.colors.text.white}
              stroke={theme.colors.background.primary}
              strokeWidth={2}
            />
          </G>
        </G>
      </Svg>

      {/* Center overlay */}
      <View className="absolute items-center justify-center">
        <View className="bg-accent-primary mb-2 h-14 w-14 items-center justify-center rounded-full">
          <Zap size={28} color={theme.colors.text.black} />
        </View>
        <Text className="text-text-tertiary text-[10px] font-bold tracking-widest uppercase">
          {t('focus.energyLevel')}
        </Text>
        <Text className="text-text-primary text-3xl font-black capitalize">
          {energyLevel || '--'}
        </Text>
      </View>
    </View>
  );
}
