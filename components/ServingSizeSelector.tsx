import { View, Text, Pressable, TextInput } from 'react-native';
import { BookmarkPlus, Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type ServingSizeSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  quickSizes?: { label: string; value: number }[];
};

export function ServingSizeSelector({ value, onChange, quickSizes }: ServingSizeSelectorProps) {
  const { t } = useTranslation();

  const defaultQuickSizes = [
    { label: `50${t('foodDetails.unitGrams')}`, value: 50 },
    { label: `100${t('foodDetails.unitGrams')}`, value: 100 },
    { label: `200${t('foodDetails.unitGrams')}`, value: 200 },
    { label: `1 ${t('foodDetails.unitCup')}`, value: 240 },
  ];

  const effectiveQuickSizes = quickSizes || defaultQuickSizes;

  const handleDecrease = () => {
    onChange(Math.max(0, value - 10));
  };

  const handleIncrease = () => {
    onChange(value + 10);
  };

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {t('foodDetails.servingSize')}
        </Text>
        <Pressable className="flex-row items-center gap-1">
          <BookmarkPlus size={16} color={theme.colors.accent.primary} />
          <Text className="text-xs font-medium text-accent-primary">
            {t('foodDetails.addFavorite')}
          </Text>
        </Pressable>
      </View>
      <View className="rounded-xl border border-white/10 bg-bg-cardDark p-2">
        <View className="mb-4 flex-row items-center gap-3">
          <Pressable
            className="h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-bg-overlay"
            onPress={handleDecrease}>
            <Minus size={theme.iconSize.md} color={theme.colors.text.secondary} />
          </Pressable>
          <View className="flex-1 items-center justify-center py-1" style={{ minWidth: 0 }}>
            <View className="relative flex-row items-baseline justify-center">
              <TextInput
                className="bg-transparent p-0 text-center text-4xl font-black text-text-primary"
                style={{
                  color: theme.colors.text.primary,
                  width: theme.size['30'],
                  maxWidth: '100%',
                }}
                value={String(value)}
                onChangeText={(text) => {
                  const num = parseInt(text) || 0;
                  onChange(num);
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.text.primary20}
              />
              <Text className="absolute -right-6 bottom-1.5 text-lg font-bold text-text-secondary">
                {t('foodDetails.unitGrams')}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-text-secondary">{t('foodDetails.grams')}</Text>
          </View>
          <Pressable
            className="h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent-primary/20 bg-accent-primary/10"
            onPress={handleIncrease}>
            <Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
        </View>
        <View className="flex-row justify-center gap-2 pb-2">
          {effectiveQuickSizes.map((size) => (
            <Pressable
              key={size.label}
              className={`rounded-full border px-4 py-1.5 ${
                value === size.value
                  ? 'border-accent-primary/20 bg-accent-primary/10'
                  : 'border-white/5 bg-bg-overlay/50'
              }`}
              onPress={() => onChange(size.value)}>
              <Text
                className={`text-xs font-medium ${
                  value === size.value ? 'font-bold text-accent-primary' : 'text-text-secondary'
                }`}>
                {size.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
