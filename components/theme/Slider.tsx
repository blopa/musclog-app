import React from 'react';
import { View, Platform } from 'react-native';
import SliderComponent from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type SliderProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  trackColor?: string;
  filledTrackColor?: string;
  thumbColor?: string;
  useGradient?: boolean;
  gradientColors?: readonly string[] | string[];
};

export function Slider({
  value,
  min,
  max,
  onChange,
  trackColor = 'rgba(255, 255, 255, 0.1)',
  filledTrackColor = theme.colors.accent.primary,
  thumbColor = theme.colors.background.white,
  useGradient = true,
  gradientColors = theme.colors.gradients.progress,
}: SliderProps) {
  return (
    <View className="h-10 w-full justify-center">
      {/* 
        The gradient track is placed behind the native slider.
        We set the slider's minimumTrackTintColor to 'transparent' 
        so the gradient shows through on the left side of the thumb.
        The maximumTrackTintColor will cover the gradient on the right side.
      */}
      {useGradient && (
        <View className="absolute left-0.5 right-0.5 h-1.5 overflow-hidden rounded-full">
          <LinearGradient
            colors={gradientColors as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="absolute inset-0"
          />
        </View>
      )}

      <SliderComponent
        style={{
          width: '100%',
          height: 40,
          zIndex: 1,
          ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
        }}
        value={value}
        minimumValue={min}
        maximumValue={max}
        onValueChange={onChange}
        minimumTrackTintColor={useGradient ? 'transparent' : filledTrackColor}
        maximumTrackTintColor={trackColor}
        thumbTintColor={thumbColor}
        step={1}
      />
    </View>
  );
}
