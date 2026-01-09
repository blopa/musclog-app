import React, { useRef } from 'react';
import { View, Pressable, PanResponder } from 'react-native';
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
  const containerPageXRef = useRef(0);
  const startXRef = useRef(0);
  const startValueRef = useRef(value);
  const percentage = ((value - min) / (max - min)) * 100;

  const updateValue = (locationX: number) => {
    if (sliderWidthRef.current > 0) {
      const sliderPercentage = Math.max(
        0,
        Math.min(100, (locationX / sliderWidthRef.current) * 100)
      );
      const newValue = Math.round(min + (sliderPercentage / 100) * (max - min));
      onChange(Math.max(min, Math.min(max, newValue)));
    }
  };

  const handleSliderPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    updateValue(locationX);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        // Store the starting position and value when drag begins
        const { pageX } = event.nativeEvent;
        startXRef.current = pageX - containerPageXRef.current;
        startValueRef.current = value;
      },
      onPanResponderMove: (event, gestureState) => {
        const { pageX } = event.nativeEvent;
        // Calculate the new position relative to the slider track
        const currentX = pageX - containerPageXRef.current;
        updateValue(currentX);
      },
      onPanResponderRelease: () => {
        // Drag ended
      },
    })
  ).current;

  const containerRef = useRef<View>(null);

  return (
    <View
      ref={containerRef}
      className="relative w-full"
      style={{ height: Math.max(height, thumbSize) }}
      onLayout={() => {
        containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
          containerPageXRef.current = pageX;
        });
      }}>
      <Pressable
        className="absolute w-full rounded-full"
        style={{
          backgroundColor: trackColor,
          height,
          top: (Math.max(height, thumbSize) - height) / 2,
        }}
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
      </Pressable>
      {/* Thumb - Draggable */}
      <View
        className="absolute rounded-full border-2"
        style={{
          left: `${percentage}%`,
          marginLeft: -thumbSize / 2,
          top: (Math.max(height, thumbSize) - thumbSize) / 2,
          width: thumbSize,
          height: thumbSize,
          backgroundColor: thumbColor,
          borderColor: filledTrackColor,
          ...theme.shadows.accentGlow,
        }}
        {...panResponder.panHandlers}
      />
    </View>
  );
}
