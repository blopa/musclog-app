import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

/**
 * Web version: same API and logic as default CameraProcessingIndicator.
 * Uses CSS animations (animate-spin-slow, animate-pulse) because
 * React Native's Animated API does not run properly on web.
 */
export const CameraProcessingIndicator = ({
  cameraMode = null,
}: {
  cameraMode?: 'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan' | null;
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const getProcessingText = useCallback(() => {
    switch (cameraMode) {
      case 'ai-label-scan':
        return t('camera.processing.aiAnalyzingFood');
      case 'ai-meal-photo':
        return t('camera.processing.aiAnalyzingMeal');
      default:
        return t('camera.processing.analyzingImage');
    }
  }, [cameraMode, t]);

  const getSubText = useCallback(() => {
    const isAiMode = cameraMode === 'ai-label-scan' || cameraMode === 'ai-meal-photo';
    return isAiMode
      ? t('camera.processing.processingNutrients')
      : t('camera.processing.processingData');
  }, [cameraMode, t]);

  return (
    <View className="flex-1 items-center justify-center">
      {/* Animated Ring */}
      <View className="relative h-24 w-24">
        {/* Static faint ring */}
        <View
          className="absolute inset-0 rounded-full border-4"
          style={{ borderColor: theme.colors.overlay.white90 }}
        />

        {/* Gradient spinning ring - CSS animation on web */}
        <View
          className="animate-spin-slow absolute inset-0 rounded-full border-4 border-transparent"
          style={{
            borderTopColor: theme.colors.accent.secondary,
            borderRightColor: theme.colors.status.indigo,
            borderBottomColor: theme.colors.status.indigo,
            borderLeftColor: theme.colors.accent.secondary,
          }}
        />

        {/* Center Icon - pulse via CSS */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="h-8 w-8 animate-pulse items-center justify-center">
            <Svg
              width={32}
              height={32}
              fill="none"
              stroke={theme.colors.accent.secondary}
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <Path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5L12 3z"
              />
            </Svg>
          </View>
        </View>
      </View>

      {/* Text */}
      <View className="mt-6">
        <Text
          className="text-center text-xl font-semibold"
          style={{ color: theme.colors.text.white }}
        >
          {getProcessingText()}
        </Text>

        <Text
          className="mt-2 text-center text-xs tracking-widest uppercase"
          style={{ color: theme.colors.accent.secondary }}
        >
          {getSubText()}
        </Text>
      </View>
    </View>
  );
};
