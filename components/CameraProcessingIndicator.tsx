import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';

export const CameraProcessingIndicator = ({ isAi = false }: { isAi: boolean }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    spin.start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      spin.stop();
      pulse.stop();
    };
  }, [spinAnim, pulseAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className="flex-1 items-center justify-center">
      {/* Animated Ring */}
      <View className="relative h-24 w-24">
        {/* Static faint ring */}
        <View
          className="absolute inset-0 rounded-full border-4"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        />

        {/* Gradient spinning ring */}
        <Animated.View
          className="absolute inset-0 rounded-full border-4"
          style={{
            borderTopColor: '#34d399',
            borderRightColor: '#6366f1',
            borderBottomColor: '#6366f1',
            borderLeftColor: '#34d399',
            transform: [{ rotate: spin }],
          }}
        />

        {/* Center Icon */}
        <View className="absolute inset-0 items-center justify-center">
          <Animated.View
            className="h-8 w-8 items-center justify-center"
            style={{ opacity: pulseAnim }}
          >
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
          </Animated.View>
        </View>
      </View>

      {/* Text */}
      <View className="mt-6">
        <Text
          className="text-center text-xl font-semibold"
          style={{ color: theme.colors.text.white }}
        >
          {isAi 
            ? t('camera.processing.aiAnalyzingMeal')
            : t('camera.processing.analyzingImage')
          }
        </Text>

        <Text
          className="mt-2 text-center text-xs uppercase tracking-widest"
          style={{ color: '#34d399' }}
        >
          {isAi 
            ? t('camera.processing.processingNutrients')
            : t('camera.processing.processingData')
          }
        </Text>
      </View>
    </View>
  );
};
