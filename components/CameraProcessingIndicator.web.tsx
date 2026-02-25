import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';

type CameraProcessingIndicatorProps = { isAi?: boolean };

/**
 * Web version: uses CSS animations (animate-spin-slow, animate-pulse) because
 * React Native's Animated API does not run properly on web.
 */
export const CameraProcessingIndicator = ({ isAi = false }: CameraProcessingIndicatorProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center">
      {/* Animated Ring */}
      <View className="relative h-24 w-24">
        {/* Static faint ring */}
        <View
          className="absolute inset-0 rounded-full border-4"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        />

        {/* Gradient spinning ring - CSS animation on web */}
        <View
          className="absolute inset-0 animate-spin-slow rounded-full border-4 border-transparent"
          style={{
            borderTopColor: '#34d399',
            borderRightColor: '#6366f1',
            borderBottomColor: '#6366f1',
            borderLeftColor: '#34d399',
          }}
        />

        {/* Center Icon - pulse via CSS */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="h-8 w-8 animate-pulse items-center justify-center">
            <Svg
              width={32}
              height={32}
              fill="none"
              stroke="#34d399"
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
          {isAi ? t('camera.processing.aiAnalyzingMeal') : t('camera.processing.analyzingImage')}
        </Text>

        <Text
          className="mt-2 text-center text-xs uppercase tracking-widest"
          style={{ color: '#34d399' }}
        >
          {isAi
            ? t('camera.processing.processingNutrients')
            : t('camera.processing.processingData')}
        </Text>
      </View>
    </View>
  );
};
