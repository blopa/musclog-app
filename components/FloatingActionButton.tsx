import { BlurView } from 'expo-blur';
import React from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const { width: screenWidth } = Dimensions.get('window');

interface FloatingActionButtonProps {
  onPress?: () => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  index: number;
  isExpanded: SharedValue<boolean>;
  onPress?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  index,
  isExpanded,
  onPress,
}) => {
  const itemStyle = useAnimatedStyle(() => {
    return {
      opacity: isExpanded.value
        ? withDelay(
            500 + index * 50,
            withTiming(1, {
              duration: 200,
              easing: Easing.out(Easing.ease),
            })
          )
        : withTiming(0, { duration: 40 }),
      transform: [
        {
          translateY: isExpanded.value
            ? withDelay(
                500 + index * 50,
                withSpring(0, {
                  damping: 15,
                  stiffness: 150,
                })
              )
            : withSpring(20, {
                damping: 15,
                stiffness: 150,
              }),
        },
      ],
    };
  });

  return (
    <AnimatedTouchableOpacity
      className="flex-row items-center px-2 py-4"
      style={itemStyle}
      entering={FadeIn.delay(index * 50)}
      activeOpacity={0.7}
      exiting={FadeOut.delay(index * 50)}
      onPress={onPress}>
      <View className="mr-5 h-10 w-10 items-center justify-center rounded-full bg-[#1a2f2a]">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="mb-1 text-base font-semibold text-white">{title}</Text>
        <Text className="text-sm leading-[18px] text-gray-400">{subtitle}</Text>
      </View>
    </AnimatedTouchableOpacity>
  );
};

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onPress }) => {
  const isExpanded = useSharedValue(false);

  const animatedOverlayOpacity = useDerivedValue(() =>
    withTiming(isExpanded.value ? 1 : 0, { duration: 300 })
  );

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: animatedOverlayOpacity.value,
      pointerEvents: isExpanded.value ? ('auto' as const) : ('none' as const),
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    const expandedWidth = screenWidth - 40;
    const expandedHeight = 400;
    const fabSize = 64;
    const bottomNavHeight = 100; // Approximate height of bottom navigation + safe area

    return {
      position: 'absolute',
      width: withSpring(isExpanded.value ? expandedWidth : fabSize, {
        damping: 15,
        stiffness: 100,
      }),
      height: withSpring(isExpanded.value ? expandedHeight : fabSize, {
        damping: 15,
        stiffness: 100,
      }),
      borderRadius: withSpring(isExpanded.value ? 20 : 32, {
        damping: 15,
        stiffness: 100,
      }),
      bottom: withSpring(isExpanded.value ? 40 : bottomNavHeight + 16, {
        damping: 15,
        stiffness: 100,
      }),
      right: withSpring(20, {
        damping: 15,
        stiffness: 100,
      }),
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isExpanded.value ? 0 : 1, { duration: 200 }),
      transform: [
        {
          rotate: withTiming(isExpanded.value ? '45deg' : '0deg', {
            duration: 300,
          }),
        },
      ],
    };
  });

  const closeButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isExpanded.value ? 1 : 0, { duration: 200 }),
      transform: [
        {
          scale: withTiming(isExpanded.value ? 1 : 0.5, { duration: 200 }),
        },
      ],
    };
  });

  const handlePress = () => {
    isExpanded.value = !isExpanded.value;
    onPress?.();
  };

  const menuItems = [
    {
      icon: <Plus size={20} color="#ffffff" />,
      title: 'Create Workout',
      subtitle: 'Create a new workout from scratch.',
      onPress: () => {
        console.log('Create Workout pressed');
      },
    },
    {
      icon: <Plus size={20} color="#ffffff" />,
      title: 'Import Template',
      subtitle: 'Import a workout template.',
      onPress: () => {
        console.log('Import Template pressed');
      },
    },
    {
      icon: <Plus size={20} color="#ffffff" />,
      title: 'Quick Add',
      subtitle: 'Quickly add exercises to your routine.',
      onPress: () => {
        console.log('Quick Add pressed');
      },
    },
  ];

  return (
    <>
      <AnimatedView className="absolute inset-0 z-[998] bg-transparent" style={backdropStyle}>
        <AnimatedBlurView intensity={80} className="absolute inset-0" tint="dark">
          <TouchableOpacity className="absolute inset-0" onPress={handlePress} activeOpacity={1} />
        </AnimatedBlurView>
      </AnimatedView>

      <AnimatedTouchableOpacity
        className="z-[9999] bg-[#0f251f] shadow-lg"
        style={containerStyle}
        onPress={handlePress}
        activeOpacity={1}>
        <Animated.View className="absolute inset-0 items-center justify-center" style={iconStyle}>
          <LinearGradient
            colors={['#34d399', '#22d3ee']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="h-16 w-16 items-center justify-center rounded-[32px] shadow-lg"
            style={{
              shadowColor: '#34d399',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}>
            <Plus size={28} color="#000000" strokeWidth={3} />
          </LinearGradient>
        </Animated.View>

        <Animated.View
          className="absolute right-[22px] top-5 h-8 w-8 items-center justify-center"
          style={closeButtonStyle}>
          <TouchableOpacity onPress={handlePress}>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-[#1a2f2a]">
              <Plus size={20} color="#9ca3af" strokeWidth={2} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View className="flex-1 px-5 pt-[50px]">
          {menuItems.map((item, index) => (
            <MenuItem
              key={index}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              index={index}
              isExpanded={isExpanded}
              onPress={() => {
                if (item.onPress) {
                  item.onPress();
                }
                isExpanded.value = false;
              }}
            />
          ))}
        </View>
      </AnimatedTouchableOpacity>
    </>
  );
};

export default FloatingActionButton;
