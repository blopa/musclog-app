import { LinearGradient } from 'expo-linear-gradient';
import { ScanBarcode, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';

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
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: theme.colors.background.darkGraySolid }}
        >
          <ScanBarcode size={theme.iconSize.xl} color={theme.colors.text.primary} />
        </View>
      }
    >
      <View className="pt-2">
        <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-text-secondary">
          {t('food.aiCamera.barcodeTextSearchLabel')}
        </Text>
        <View
          className="mb-6 w-full rounded-lg border px-4 py-3"
          style={{
            backgroundColor: theme.colors.background.darkGraySolid,
            borderColor: theme.colors.background.white10,
          }}
        >
          <RNTextInput
            className="w-full bg-transparent text-text-primary"
            style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.text.primary,
            }}
            placeholder={t('food.aiCamera.barcodeTextSearchPlaceholder')}
            placeholderTextColor={theme.colors.background.white20}
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
          className="rounded-xl px-6 py-4 active:scale-[0.98]"
          style={{ overflow: 'hidden' }}
        >
          <LinearGradient
            colors={theme.colors.gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-sm font-bold text-white">
              {t('food.aiCamera.barcodeTextSearchSubmit')}
            </Text>
            <Search size={theme.iconSize.md} color={theme.colors.text.white} />
          </View>
        </Pressable>
      </View>
    </BottomPopUp>
  );
}
