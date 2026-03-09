import { Zap } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { EnergyLevel, MenstrualPhase } from '../database/services/MenstrualService';
import { theme } from '../theme';

type PhaseWheelProps = {
  currentPhase: MenstrualPhase | null;
  energyLevel: EnergyLevel | null;
  cycleDay: number;
  totalDays: number;
};

const PHASES = [
  // TODO: use colors from theme.ts
  { key: 'menstrual', color: '#ff4d4d', length: 5 }, // TODO: use proportions, since number of cycle days can vary
  { key: 'follicular', color: '#29e08e', length: 9 }, // TODO: use proportions, since number of cycle days can vary
  { key: 'ovulation', color: '#ffb300', length: 3 }, // TODO: use proportions, since number of cycle days can vary
  { key: 'luteal', color: '#8b5cf6', length: 11 }, // TODO: use proportions, since number of cycle days can vary
] as const satisfies readonly { key: MenstrualPhase; color: string; length: number }[];

// TODO: number of days is set in the onboarding
const CYCLE_DAYS = PHASES.reduce((acc, p) => acc + p.length, 0); // 28

export function PhaseWheel({ currentPhase, energyLevel, cycleDay, totalDays }: PhaseWheelProps) {
  const { t } = useTranslation();

  const size = 260;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
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
            const rawStartDeg = (startDay / CYCLE_DAYS) * 360;
            const rawSweepDeg = (phase.length / CYCLE_DAYS) * 360;

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
              r={strokeWidth / 2 + 4}
              fill={theme.colors.text.white}
              stroke={theme.colors.background.primary}
              strokeWidth={2}
            />
          </G>
        </G>
      </Svg>

      {/* Center overlay */}
      <View className="absolute items-center justify-center">
        <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-accent-primary">
          <Zap size={28} color={theme.colors.text.black} />
        </View>
        <Text className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
          {t('focus.energyLevel')}
        </Text>
        <Text className="text-3xl font-black capitalize text-text-primary">
          {energyLevel || '--'}
        </Text>
      </View>
    </View>
  );
}
