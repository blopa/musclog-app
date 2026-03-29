import { ChevronDown } from 'lucide-react-native';
import { ComponentType, ReactNode, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '../../hooks/useTheme';

type AccordionProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  // Optional props for customization
  count?: number;
  icon?: ComponentType<{ size: number; color: string }>;
  headerContent?: ReactNode; // Custom header content if icon/count doesn't fit
  className?: string;
  animationDuration?: number;
  maxHeight?: number; // Max height for content animation
};

export function Accordion({
  title,
  isOpen,
  onToggle,
  children,
  count,
  icon: Icon,
  headerContent,
  className = '',
  animationDuration = 300,
  maxHeight,
}: AccordionProps) {
  const theme = useTheme();
  const maxHeightFinal = maxHeight || theme.size['250'] * 10;
  const rotation = useSharedValue(isOpen ? 180 : 0);
  const opacity = useSharedValue(isOpen ? 1 : 0);
  const height = useSharedValue(isOpen ? maxHeightFinal : 0);

  useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 });
    opacity.value = withTiming(isOpen ? 1 : 0, { duration: 250 });
    height.value = withTiming(isOpen ? maxHeightFinal : 0, { duration: animationDuration });
  }, [isOpen, rotation, opacity, height, maxHeightFinal, animationDuration]);

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    maxHeight: height.value,
    opacity: opacity.value,
    overflow: 'hidden',
  }));

  const handlePress = () => {
    onToggle();
  };

  return (
    <View
      className={`mb-4 overflow-hidden rounded-lg border border-border-dark bg-bg-card ${className}`}
    >
      <Pressable onPress={handlePress} className="overflow-hidden">
        <View className="flex-row items-center justify-between px-4 py-4">
          <View className="min-w-0 flex-1 flex-row items-center gap-3">
            {headerContent ? (
              headerContent
            ) : (
              <>
                {Icon ? (
                  <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
                ) : null}
                <Text className="text-base font-semibold text-text-primary">
                  {title}
                  {count !== undefined ? (
                    <>
                      {' '}
                      <Text
                        className="text-sm font-normal"
                        style={{ color: theme.colors.status.customGreen }}
                      >
                        ({count})
                      </Text>
                    </>
                  ) : null}
                </Text>
              </>
            )}
          </View>
          <Animated.View className="shrink-0 justify-center pl-2" style={animatedChevronStyle}>
            <ChevronDown size={theme.iconSize.md} color={theme.colors.text.tertiary} />
          </Animated.View>
        </View>
      </Pressable>
      <Animated.View style={animatedContentStyle} pointerEvents={isOpen ? 'auto' : 'none'}>
        <View className="border-t border-border-dark">{children}</View>
      </Animated.View>
    </View>
  );
}
