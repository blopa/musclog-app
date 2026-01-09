import React, { useRef } from 'react';
import { View, Pressable } from 'react-native';
import { theme } from '../../theme';

type SliderProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  trackColor?: string;
  filledTrackColor?: string;
  thumbColor?: string;
  thumbGlowColor?: string;
  height?: number;
  thumbSize?: number;
};

export function Slider({
  value,
  min,
  max,
  onChange,
  trackColor = theme.colors.accent.primary10,
  filledTrackColor = theme.colors.accent.primary,
  thumbColor = theme.colors.background.white,
  thumbGlowColor = theme.colors.accent.primary,
  height = 6,
  thumbSize = 20,
}: SliderProps) {
  const sliderWidthRef = useRef(0);
  const percentage = ((value - min) / (max - min)) * 100;

  const handleSliderPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    if (sliderWidthRef.current > 0) {
      const sliderPercentage = Math.max(
        0,
        Math.min(100, (locationX / sliderWidthRef.current) * 100)
      );
      const newValue = Math.round(min + (sliderPercentage / 100) * (max - min));
      onChange(Math.max(min, Math.min(max, newValue)));
    }
  };

  return (
    <Pressable
      className="relative w-full rounded-full"
      style={{ backgroundColor: trackColor, height }}
      onPress={handleSliderPress}
      onLayout={(event) => {
        sliderWidthRef.current = event.nativeEvent.layout.width;
      }}>
      {/* Filled portion */}
      <View
        className="absolute left-0 top-0 h-full rounded-full"
        style={{
          width: `${percentage}%`,
          backgroundColor: filledTrackColor,
        }}
      />
      {/* Thumb */}
      <View
        className="absolute top-1/2 rounded-full border-2"
        style={{
          left: `${percentage}%`,
          marginLeft: -thumbSize / 2,
          width: thumbSize,
          height: thumbSize,
          backgroundColor: thumbColor,
          borderColor: filledTrackColor,
          ...theme.shadows.accentGlow,
        }}
      />
    </Pressable>
  );
}
