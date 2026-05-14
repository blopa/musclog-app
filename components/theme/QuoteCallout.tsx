import { Quote } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type QuoteCalloutProps = {
  text: string;
};

export function QuoteCallout({ text }: QuoteCalloutProps) {
  const theme = useTheme();

  if (!text.trim()) {
    return null;
  }

  return (
    <View className="flex-row overflow-hidden rounded-sm">
      <View className="w-1" style={{ backgroundColor: theme.colors.accent.primary }} />
      <View
        className="flex-1 px-5 py-4"
        style={{ backgroundColor: theme.colors.background.white5 }}
      >
        <Quote
          size={18}
          color={theme.colors.accent.primary}
          fill={theme.colors.accent.primary}
          style={{ opacity: 0.55, marginBottom: theme.spacing.margin.xs }}
        />
        <Text
          className="text-base font-semibold leading-6"
          style={{ color: theme.colors.text.primary }}
        >
          {text.trim()}
        </Text>
      </View>
    </View>
  );
}
