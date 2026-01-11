import React from 'react';
import { View } from 'react-native';
import SliderComponent from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

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
  trackColor = theme.colors.background.white10,
  thumbColor = theme.colors.background.white,
  useGradient = true,
  gradientColors = theme.colors.gradients.progress,
  variant = 'solid',
  solidColor = theme.colors.accent.primary,
  step = 1,
}: SliderProps) {
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [displayValue, setDisplayValue] = React.useState(value);

  // Sync display value when prop changes
  React.useEffect(() => {
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
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {/* Custom background track (only for gradient variant) */}
      {variant === 'gradient' && (
        <View
          className="absolute left-0.5 right-0.5 h-1.5 rounded-full"
          style={{ backgroundColor: trackColor }}
        />
      )}

      {/* Progress Fill (Custom mask for gradient only) */}
      {variant === 'gradient' && useGradient && containerWidth > 0 && (
        <View
          className="absolute left-0.5 h-1.5 overflow-hidden rounded-full"
          style={{ width: fillWidth }}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: containerWidth, height: '100%' }}
          />
        </View>
      )}

      <SliderComponent
        style={{
          width: '100%',
          height: theme.size['10'],
          zIndex: variant === 'gradient' ? 1 : 0,
        }}
        value={value}
        minimumValue={min}
        maximumValue={max}
        onValueChange={handleValueChange}
        minimumTrackTintColor={variant === 'solid' ? solidColor : 'transparent'}
        maximumTrackTintColor={variant === 'solid' ? trackColor : 'transparent'}
        thumbTintColor={thumbColor}
        step={step}
      />
    </View>
  );
}
