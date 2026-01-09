import React from 'react';
import SliderComponent from '@react-native-community/slider';
import { theme } from '../../theme';

type SliderProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  trackColor?: string;
  filledTrackColor?: string;
  thumbColor?: string;
};

export function Slider({
  value,
  min,
  max,
  onChange,
  trackColor = theme.colors.accent.primary10,
  filledTrackColor = theme.colors.accent.primary,
  thumbColor = theme.colors.background.white,
}: SliderProps) {
  return (
    <SliderComponent
      style={{ width: '100%', height: 40 }}
      value={value}
      minimumValue={min}
      maximumValue={max}
      onValueChange={onChange}
      minimumTrackTintColor={filledTrackColor}
      maximumTrackTintColor={trackColor}
      thumbTintColor={thumbColor}
      step={1}
    />
  );
}
