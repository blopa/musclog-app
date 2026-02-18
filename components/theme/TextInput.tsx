import { ReactNode, useState } from 'react';
import { Text, TextInput as RNTextInput, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

type TestInputProps = {
  label: ReactNode;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  focused?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  icon?: ReactNode;
  secureTextEntry?: boolean;
  required?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  selectTextOnFocus?: boolean;
  /** When true, focus/blur do not update styling (avoids re-render on Android that can steal focus) */
  disableFocusStyle?: boolean;
};

export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  focused: controlledFocused,
  keyboardType = 'default',
  icon,
  secureTextEntry,
  onFocus,
  onBlur,
  required = false,
  selectTextOnFocus = true,
  disableFocusStyle = false,
}: TestInputProps) {
  const theme = useTheme();
  const [internalFocused, setInternalFocused] = useState(false);
  const isControlled = controlledFocused !== undefined;
  const effectiveFocused = disableFocusStyle ? false : (isControlled ? controlledFocused : internalFocused);

  const handleFocus = () => {
    if (!disableFocusStyle && !isControlled) setInternalFocused(true);
    onFocus?.();
  };
  const handleBlur = () => {
    if (!disableFocusStyle && !isControlled) setInternalFocused(false);
    onBlur?.();
  };

  return (
    <View className="flex-col gap-2">
      <View className="ml-1 flex-row items-center">
        <Text
          className={`text-sm font-medium ${effectiveFocused ? 'text-accent-primary' : 'text-text-secondary'}`}
        >
          {label}
        </Text>
        {required ? <Text className="ml-1 text-sm font-medium text-red-500">*</Text> : null}
      </View>
      <View
        className={`h-14 w-full flex-row items-center rounded-lg border-2 bg-bg-card px-4 ${
          effectiveFocused ? 'border-accent-primary/50' : 'border-white/10'
        }`}
        style={
          effectiveFocused
            ? {
                borderColor: theme.colors.accent.primary50,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: theme.shadowOffset.zero,
                shadowOpacity: theme.shadowOpacity.light,
                shadowRadius: theme.shadowRadius.md,
                elevation: theme.elevation.sm,
              }
            : {}
        }
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
        />
        {icon ? <View className="absolute right-4 items-center justify-center">{icon}</View> : null}
      </View>
    </View>
  );
}
