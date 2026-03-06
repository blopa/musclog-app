import { ReactNode, useMemo } from 'react';
import { Animated, Platform, Text, TextInput as RNTextInput, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

type TestInputProps = {
  label: ReactNode;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  icon?: ReactNode;
  secureTextEntry?: boolean;
  required?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  selectTextOnFocus?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
};

const ANIMATION_DURATION = 100;

/**
 * Uses React Native's Animated API (not React state) to track focus and style accordingly.
 * On web, uses focus-within CSS. On native, uses Animated.Value updated via onFocus/onBlur.
 * This is a "native" React Native approach without useState/useReducer/useRef hooks.
 */
export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  icon,
  secureTextEntry,
  onFocus,
  onBlur,
  required = false,
  selectTextOnFocus = true,
  multiline = false,
  numberOfLines = 4,
}: TestInputProps) {
  const theme = useTheme();

  // Use Animated.Value (React Native native API, not a React hook)
  // Create once per component instance using useMemo to avoid recreating
  const focusAnim = useMemo(() => new Animated.Value(0), []);

  const handleFocus = () => {
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: ANIMATION_DURATION,
      useNativeDriver: false, // Color animations need JS driver
    }).start();
    onFocus?.();
  };

  const handleBlur = () => {
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    }).start();
    onBlur?.();
  };

  // Interpolate colors based on focus state
  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.background.white10, theme.colors.accent.primary50],
  });

  const labelColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.text.secondary, theme.colors.accent.primary],
  });

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, theme.shadowOpacity.light],
  });

  return (
    <View className="flex-col gap-2">
      <View className="ml-1 flex-row items-center">
        {Platform.OS === 'web' ? (
          <Text className="text-sm font-medium text-text-secondary">{label}</Text>
        ) : (
          <Animated.Text className="text-sm font-medium" style={{ color: labelColor }}>
            {label}
          </Animated.Text>
        )}
        {required ? <Text className="ml-1 text-sm font-medium text-red-500">*</Text> : null}
      </View>
      {Platform.OS === 'web' ? (
        <View
          // TODO: use classnames
          className={`${multiline ? 'min-h-14 py-3' : 'h-14'} w-full flex-row ${multiline ? 'items-start' : 'items-center'} rounded-lg border-2 border-white/10 bg-bg-card px-4 focus-within:border-accent-primary/50 focus-within:shadow-md`}
        >
          <RNTextInput
            className="flex-1 border-none bg-transparent p-0 pr-10 text-text-primary"
            placeholder={placeholder}
            placeholderTextColor={theme.colors.text.tertiary}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{ borderWidth: theme.borderWidth.none, minWidth: 0 }}
            selectTextOnFocus={selectTextOnFocus}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines : undefined}
            textAlignVertical={multiline ? 'top' : 'center'}
          />
          {icon ? (
            <View className="absolute right-4 items-center justify-center">{icon}</View>
          ) : null}
        </View>
      ) : (
        <Animated.View
          // TODO: use classnames
          className={`${multiline ? 'min-h-14 py-3' : 'h-14'} w-full flex-row ${multiline ? 'items-start' : 'items-center'} rounded-lg border-2 bg-bg-card px-4`}
          style={{
            borderColor,
            shadowColor: theme.colors.accent.primary,
            shadowOffset: theme.shadowOffset.zero,
            shadowOpacity,
            shadowRadius: theme.shadowRadius.md,
            // Note: elevation doesn't support Animated values, so we use shadowOpacity instead
            elevation: theme.elevation.sm, // Static elevation for Android
          }}
        >
          <RNTextInput
            className="flex-1 border-none bg-transparent p-0 pr-10 text-text-primary"
            placeholder={placeholder}
            placeholderTextColor={theme.colors.text.tertiary}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{ borderWidth: theme.borderWidth.none, minWidth: 0 }}
            selectTextOnFocus={selectTextOnFocus}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines : undefined}
            textAlignVertical={multiline ? 'top' : 'center'}
          />
          {icon ? (
            <View className="absolute right-4 items-center justify-center">{icon}</View>
          ) : null}
        </Animated.View>
      )}
    </View>
  );
}
