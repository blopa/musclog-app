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
};

export function Slider({
  value,
  min,
  max,
  onChange,
  trackColor = 'rgba(255, 255, 255, 0.1)',
  thumbColor = theme.colors.background.white,
  useGradient = true,
  gradientColors = theme.colors.gradients.progress,
  // TODO: use it
  variant = 'gradient',
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

  // Account for thumb radius - the slider track doesn't span full width
  const thumbRadius = 12;
  const progress = (displayValue - min) / (max - min);
  // Effective track width excludes thumb padding on both sides
  const effectiveTrackWidth = Math.max(0, containerWidth - thumbRadius * 2);
  // Fill starts at thumbRadius and extends based on progress
  const fillWidth = thumbRadius + effectiveTrackWidth * progress;

  return (
    <View
      className="h-10 w-full justify-center"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {/* Background Track (Unfilled part - Gray) */}
      <View
        className="absolute left-0.5 right-0.5 h-1.5 rounded-full"
        style={{ backgroundColor: trackColor }}
      />

      {/* Gradient Fill (Left side only) */}
      {useGradient && containerWidth > 0 && (
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
          height: 40,
          zIndex: 1,
        }}
        value={value}
        minimumValue={min}
        maximumValue={max}
        onValueChange={handleValueChange}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor={thumbColor}
        step={1}
      />
    </View>
  );
}
