import { View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

type SkeletonLoaderProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  className?: string;
};

export function SkeletonLoader({
  width = '100%',
  height,
  borderRadius,
  className,
}: SkeletonLoaderProps) {
  const theme = useTheme();
  return (
    <View
      className={`${className || ''}`}
      style={{
        width,
        height: height || theme.size.base,
        borderRadius: borderRadius || theme.size.sm,
        backgroundColor: theme.colors.background.cardElevated,
        opacity: theme.colors.opacity.medium,
      }}
    />
  );
}
