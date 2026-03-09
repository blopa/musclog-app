import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Zap } from 'lucide-react-native';
import { theme } from '../theme';
import { MenstrualPhase, EnergyLevel } from '../database/services/MenstrualService';

type PhaseWheelProps = {
  currentPhase: MenstrualPhase | null;
  energyLevel: EnergyLevel | null;
  cycleDay: number;
  totalDays: number;
};

export function PhaseWheel({ currentPhase, energyLevel, cycleDay, totalDays }: PhaseWheelProps) {
  const size = 260;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Define phases with their approximate proportions (simplified for UI)
  const phases = [
    { key: 'menstrual', color: '#ff4d4d', label: 'Menstrual', length: 5 },
    { key: 'follicular', color: '#29e08e', label: 'Follicular', length: 9 },
    { key: 'ovulation', color: '#ffb300', label: 'Ovulation', length: 3 },
    { key: 'luteal', color: '#8b5cf6', label: 'Luteal', length: 11 },
  ];

  // Calculate rotation based on cycle day
  const progress = (cycleDay - 1) / totalDays;
  const rotation = progress * 360;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {/* Background circle */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={theme.colors.background.navActive}
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Phase arcs */}
          {phases.map((phase, index) => {
            const startDay = phases.slice(0, index).reduce((acc, p) => acc + p.length, 0);
            const startAngle = (startDay / 28) * 360;
            const sweepAngle = (phase.length / 28) * 360;

            // Simplified: showing the phases as colored segments
            const dashArray = circumference;
            const dashOffset = circumference - (sweepAngle / 360) * circumference;
            const rotate = startAngle;

            return (
              <Circle
                key={phase.key}
                cx={center}
                cy={center}
                r={radius}
                stroke={phase.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${(sweepAngle / 360) * circumference} ${circumference}`}
                strokeLinecap="round"
                fill="transparent"
                rotation={rotate}
                origin={`${center}, ${center}`}
                opacity={currentPhase === phase.key ? 1 : 0.3}
              />
            );
          })}

          {/* Current day indicator */}
          <G rotation={rotation} origin={`${center}, ${center}`}>
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

      {/* Center content */}
      <View className="absolute items-center justify-center">
        <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-accent-primary">
          <Zap size={28} color={theme.colors.text.black} />
        </View>
        <Text className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
          Energy Level
        </Text>
        <Text className="text-3xl font-black text-text-primary capitalize">
          {energyLevel || '--'}
        </Text>
      </View>
    </View>
  );
}
