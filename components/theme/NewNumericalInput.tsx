import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface NewNumericalInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  variant?: 'default' | 'compact';
}

export default function NewNumericalInput({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  variant = 'default',
}: NewNumericalInputProps) {
  const theme = useTheme();
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<TextInput | null>(null);
  const isCompact = variant === 'compact';

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleInputChange = (val: string) => {
    if (val === '' || /^\d+$/.test(val)) {
      setInputValue(val);
      if (val !== '') {
        const numVal = parseInt(val, 10);
        onChange(Math.max(min, numVal));
      }
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
        className={`text-xs font-semibold tracking-wide uppercase ${isCompact ? 'mb-1.5' : 'mb-3'}`}
        style={{ color: theme.colors.background.workoutIcon }}
      >
        {label}
      </Text>
      <View
        className={`flex w-full flex-row items-center justify-between rounded-2xl ${isCompact ? 'gap-0.5 px-2.5 py-1.5' : 'gap-2 px-4 py-3'}`}
        style={{ backgroundColor: theme.colors.background.filterTab }}
      >
        <Pressable
          onPress={handleDecrement}
          className="flex-shrink-0"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Minus size={isCompact ? 16 : 20} color={theme.colors.accent.secondary} strokeWidth={3} />
        </Pressable>
        <TextInput
          ref={inputRef}
          value={inputValue}
          onChangeText={handleInputChange}
          onBlur={handleInputBlur}
          className={`min-w-0 flex-1 bg-transparent text-center font-bold ${isCompact ? 'text-lg' : 'text-2xl'}`}
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
          <Plus size={isCompact ? 16 : 20} color={theme.colors.accent.secondary} strokeWidth={3} />
        </Pressable>
      </View>
    </View>
  );
}
