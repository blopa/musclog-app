import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../../theme';

type AccordionProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  // Optional props for customization
  count?: number;
  icon?: React.ComponentType<{ size: number; color: string }>;
  headerContent?: React.ReactNode; // Custom header content if icon/count doesn't fit
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
  maxHeight = theme.size['250'] * 10, // Default max height
}: AccordionProps) {
  const rotation = useSharedValue(isOpen ? 180 : 0);
  const opacity = useSharedValue(isOpen ? 1 : 0);
  const height = useSharedValue(isOpen ? maxHeight : 0);

  useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 });
    opacity.value = withTiming(isOpen ? 1 : 0, { duration: 250 });
    height.value = withTiming(isOpen ? maxHeight : 0, { duration: animationDuration });
  }, [isOpen, rotation, opacity, height, maxHeight, animationDuration]);

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
      className={`mb-4 overflow-hidden rounded-lg border border-border-dark bg-bg-card ${className}`}>
      <Pressable onPress={handlePress} className="flex-row items-center justify-between px-4 py-4">
        <View className="flex-1 flex-row items-center gap-3">
          {headerContent ? (
            headerContent
          ) : (
            <>
              {Icon && <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />}
              <Text className="text-base font-semibold text-text-primary">
                {title}
                {count !== undefined && (
                  <>
                    {' '}
                    <Text
                      className="text-sm font-normal"
                      style={{ color: theme.colors.status.customGreen }}>
                      ({count})
                    </Text>
                  </>
                )}
              </Text>
            </>
          )}
        </View>
        <Animated.View style={animatedChevronStyle}>
          <ChevronDown size={theme.iconSize.md} color={theme.colors.text.tertiary} />
        </Animated.View>
      </Pressable>
      <Animated.View style={animatedContentStyle} pointerEvents={isOpen ? 'auto' : 'none'}>
        <View className="border-t border-border-dark">{children}</View>
      </Animated.View>
    </View>
  );
}
