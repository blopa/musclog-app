import React from 'react';
import { View } from 'react-native';
import { theme } from '../../theme';

type SkeletonLoaderProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  className?: string;
};

export function SkeletonLoader({
  width = '100%',
  height = theme.components.skeleton.defaultHeight,
  borderRadius = theme.components.skeleton.defaultBorderRadius,
  className,
}: SkeletonLoaderProps) {
  return (
    <View
      className={`${className || ''}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: theme.colors.background.cardElevated,
        opacity: theme.colors.opacity.light,
      }}
    />
  );
}
