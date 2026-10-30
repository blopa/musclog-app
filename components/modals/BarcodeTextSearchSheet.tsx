import { ScanBarcode, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput as RNTextInput, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { useTheme } from '@/hooks/useTheme';

type BarcodeTextSearchSheetProps = {
  visible: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function BarcodeTextSearchSheet({
  visible,
  value,
  onChangeText,
  onClose,
  onSubmit,
}: BarcodeTextSearchSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const sanitizedValue = value.replace(/\D/g, '');

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('food.aiCamera.barcodeTextSearchTitle')}
      subtitle={t('food.aiCamera.barcodeTextSearchDescription')}
      maxHeight="55%"
      headerIcon={
        <View
          className="h-10 w-10 items-center justify-center rounded-control"
          style={{ backgroundColor: theme.colors.background.primary }}
        >
          <ScanBarcode size={theme.iconSize.xl} color={theme.colors.text.primary} />
        </View>
      }
    >
      <View className="pt-2">
        <Text className="mb-2 ml-1 text-xs font-semibold text-text-secondary">
          {t('food.aiCamera.barcodeTextSearchLabel')}
        </Text>
        <View
          className="mb-6 w-full rounded-control border px-4 py-3"
          style={{
            backgroundColor: theme.colors.background.primary,
            borderColor: theme.colors.background.ink10,
          }}
        >
          <RNTextInput
            className="w-full bg-transparent text-text-primary"
            style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.text.primary,
            }}
            placeholder={t('food.aiCamera.barcodeTextSearchPlaceholder')}
            placeholderTextColor={theme.colors.background.ink20}
            value={sanitizedValue}
            onChangeText={(text) => onChangeText(text.replace(/\D/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="numeric"
            keyboardType="numeric"
            returnKeyType="search"
            onSubmitEditing={onSubmit}
          />
        </View>

        <Pressable
          onPress={onSubmit}
          className="rounded-control px-6 py-4 active:scale-[0.98]"
          style={{ backgroundColor: theme.colors.accent.primary }}
        >
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-sm font-semibold" style={{ color: theme.colors.text.onAccent }}>
              {t('food.aiCamera.barcodeTextSearchSubmit')}
            </Text>
            <Search size={theme.iconSize.md} color={theme.colors.text.onAccent} />
          </View>
        </Pressable>
      </View>
    </BottomPopUp>
  );
}
