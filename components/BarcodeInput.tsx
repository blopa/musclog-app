import { ScanLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';

import { TextInput } from '@/components/theme/TextInput';
import { useTheme } from '@/hooks/useTheme';

type BarcodeInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onScanPress: () => void;
};

export function BarcodeInput({
  label,
  value,
  onChangeText,
  placeholder,
  onScanPress,
}: BarcodeInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const sanitizedValue = value.replace(/\D/g, '');

  return (
    <View className="relative">
      <TextInput
        label={label}
        value={sanitizedValue}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, ''))}
        placeholder={placeholder}
        inputMode="numeric"
        keyboardType="numeric"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('food.actions.scanBarcode')}
        className="absolute right-2 items-center justify-center rounded-lg"
        style={{
          ...(Platform.OS !== 'web'
            ? {
                top: theme.size['14'] / 2,
              }
            : {
                top: theme.size['18'] / 2,
              }),
          width: theme.size['10'],
          height: theme.size['10'],
          backgroundColor: theme.colors.accent.primary10,
          borderRadius: theme.borderRadius.sm,
        }}
        onPress={onScanPress}
      >
        <ScanLine size={theme.iconSize.md} color={theme.colors.accent.primary} />
      </Pressable>
    </View>
  );
}
