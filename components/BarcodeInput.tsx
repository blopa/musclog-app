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
  keyboardType?: 'default' | 'email-address' | 'numeric';
  onScanPress: () => void;
};

export function BarcodeInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'numeric',
  onScanPress,
}: BarcodeInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View className="relative">
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
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
