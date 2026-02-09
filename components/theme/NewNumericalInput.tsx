import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

interface NewNumericalInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}

export default function NewNumericalInput({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: NewNumericalInputProps) {
  const theme = useTheme();
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleInputChange = (val: string) => {
    if (val === '' || /^\d+$/.test(val)) {
      setInputValue(val);
    }
  };

  const handleInputBlur = () => {
    let newValue = inputValue === '' ? min : parseInt(inputValue, 10);

    if (newValue < min) {
      newValue = min;
    }

    if (newValue !== value) {
      onChange(newValue);
    }

    setInputValue(newValue.toString());
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    onChange(value + step);
  };

  return (
    <View className="w-full">
      <Text
        className="mb-3 text-xs font-semibold uppercase tracking-wide"
        style={{ color: theme.colors.background.workoutIcon }}
      >
        {label}
      </Text>
      <View
        className="flex w-full flex-row items-center justify-between gap-2 rounded-2xl px-4 py-3"
        style={{ backgroundColor: theme.colors.background.filterTab }}
      >
        <Pressable
          onPress={handleDecrement}
          className="flex-shrink-0"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Minus size={20} color={theme.colors.accent.secondary} strokeWidth={3} />
        </Pressable>
        <TextInput
          ref={inputRef}
          value={inputValue}
          onChangeText={handleInputChange}
          onBlur={handleInputBlur}
          className="min-w-0 flex-1 bg-transparent text-center text-2xl font-bold"
          style={{ color: theme.colors.text.white }}
          keyboardType="numeric"
          placeholderTextColor={theme.colors.text.secondary}
          selectTextOnFocus={true}
        />
        <Pressable
          onPress={handleIncrement}
          className="flex-shrink-0"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={20} color={theme.colors.accent.secondary} strokeWidth={3} />
        </Pressable>
      </View>
    </View>
  );
}
