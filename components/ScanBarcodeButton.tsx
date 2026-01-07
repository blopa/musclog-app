import { Text, Pressable } from 'react-native';
import { ScanLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type ScanBarcodeButtonProps = {
  onPress?: () => void;
};

export function ScanBarcodeButton({ onPress }: ScanBarcodeButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      className="flex-1 flex-row items-center justify-center gap-3 rounded-2xl border border-border-default bg-bg-overlay py-4"
      onPress={onPress}>
      <ScanLine size={theme.iconSize.md} color={theme.colors.accent.secondary} />
      <Text className="text-lg font-semibold text-text-primary">
        {t('food.actions.scanBarcode')}
      </Text>
    </Pressable>
  );
}
