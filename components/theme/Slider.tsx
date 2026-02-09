import SliderComponent from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

type SliderProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  trackColor?: string;
  thumbColor?: string;
  useGradient?: boolean;
  gradientColors?: readonly [string, string, ...string[]];
  variant?: 'gradient' | 'solid';
  solidColor?: string;
  step?: number;
};

export function Slider({
  value,
  min,
  max,
  onChange,
  trackColor,
  thumbColor,
  useGradient = true,
  gradientColors,
  variant = 'solid',
  solidColor,
  step = 1,
}: SliderProps) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const [displayValue, setDisplayValue] = useState(value);

  // Sync display value when prop changes
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleValueChange = (val: number) => {
    setDisplayValue(val);
    onChange(val);
  };

  // Math for gradient variant only
  const thumbRadius = theme.spacing.padding.md;
  const progress = (displayValue - min) / (max - min);
  const effectiveTrackWidth = Math.max(0, containerWidth - thumbRadius * 2);
  const fillWidth = thumbRadius + effectiveTrackWidth * progress;

  return (
    <View
      className="h-10 w-full justify-center"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Custom background track (only for gradient variant) */}
      {variant === 'gradient' ? (
        <View
          className="absolute left-0.5 right-0.5 h-1.5 rounded-full"
          style={{ backgroundColor: trackColor || theme.colors.background.white10 }}
        />
      ) : null}

      {/* Progress Fill (Custom mask for gradient only) */}
      {variant === 'gradient' && useGradient && containerWidth > 0 ? (
        <View
          className="absolute left-0.5 h-1.5 overflow-hidden rounded-full"
          style={{ width: fillWidth }}
        >
          <LinearGradient
            colors={gradientColors || theme.colors.gradients.progress}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: containerWidth, height: '100%' }}
          />
        </View>
      ) : null}

      <SliderComponent
        style={{
          width: '100%',
          height: theme.size['10'],
          zIndex: variant === 'gradient' ? theme.zIndex.aboveBase : theme.zIndex.base,
        }}
        value={value}
        minimumValue={min}
        maximumValue={max}
        onValueChange={handleValueChange}
        minimumTrackTintColor={
          variant === 'solid' ? solidColor || theme.colors.accent.primary : 'transparent'
        }
        maximumTrackTintColor={
          variant === 'solid' ? trackColor || theme.colors.background.white10 : 'transparent'
        }
        thumbTintColor={thumbColor || theme.colors.background.white}
        step={step}
      />
    </View>
  );
}
