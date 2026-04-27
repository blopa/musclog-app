import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable, Text, TextInput as RNTextInput, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type TestNumericInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  unitColor?: string;
  onIncrement?: () => void;
  onDecrement?: () => void;
  // variant?: 'vertical' | 'horizontal';
};

export function NumericInput({
  label,
  value,
  onChangeText,
  unit,
  unitColor,
  onIncrement,
  onDecrement,
  // variant = 'vertical',
}: TestNumericInputProps) {
  const theme = useTheme();
  const unitColorFinal = unitColor || theme.colors.accent.primary;
  const inputRef = useRef<RNTextInput | null>(null);

  const handleFocus = () => {
    // iOS supports selectTextOnFocus; on Android explicitly set selection
    if (inputRef.current && typeof inputRef.current.setNativeProps === 'function') {
      try {
        inputRef.current.setNativeProps({ selection: { start: 0, end: value?.length ?? 0 } });
      } catch (e) {
        // ignore any native errors
      }
    }
  };

  return (
    <View className="bg-bg-card flex-1 flex-col items-center gap-1 rounded-lg border border-white/10 p-4">
      <Text
        className="text-text-tertiary font-bold tracking-widest uppercase"
        style={{ fontSize: theme.typography.fontSize.xs }}
      >
        {label}
      </Text>
      {onIncrement ? (
        <Pressable
          className="bg-accent-primary w-full items-center justify-center rounded-lg py-1.5 active:opacity-80"
          onPress={onIncrement}
        >
          <ChevronUp size={theme.iconSize.sm} color={theme.colors.text.black} />
        </Pressable>
      ) : null}
      <TextInput
        ref={inputRef}
        selectTextOnFocus
        className="text-text-primary w-full border-none bg-transparent p-0 text-center text-3xl font-black"
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        onFocus={handleFocus}
        style={{ borderWidth: theme.borderWidth.none }}
      />
      <Text className="text-xs font-medium" style={{ color: unitColorFinal }}>
        {unit}
      </Text>
      {onDecrement ? (
        <Pressable
          className="bg-accent-primary w-full items-center justify-center rounded-lg py-1.5 active:opacity-80"
          onPress={onDecrement}
        >
          <ChevronDown size={theme.iconSize.sm} color={theme.colors.text.black} />
        </Pressable>
      ) : null}
    </View>
  );
}
