import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type TestToggleProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  type?: 'checkbox' | 'radio';
};

export function CheckRadioBox({ label, value, onValueChange, type = 'checkbox' }: TestToggleProps) {
  const theme = useTheme();
  const renderIndicator = () => {
    if (!value) {
      return null;
    }

    if (type === 'checkbox') {
      return <Check size={theme.iconSize.sm} color={theme.colors.accent.primary} />;
    }

    return (
      <View
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: theme.colors.accent.primary }}
      />
    );
  };

  return (
    <Pressable
      className="flex-row items-center gap-3 active:opacity-90"
      onPress={() => onValueChange(!value)}
    >
      <View
        className={`h-6 w-6 items-center justify-center border border-white/20 bg-bg-card ${
          type === 'radio' ? 'rounded-full' : 'rounded'
        }`}
      >
        {renderIndicator()}
      </View>
      <Text className="text-sm font-medium text-text-primary">{label}</Text>
    </Pressable>
  );
}
