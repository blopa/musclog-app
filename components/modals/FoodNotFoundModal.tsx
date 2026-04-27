import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ChevronRight, Edit, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { useTheme } from '@/hooks/useTheme';

type FoodNotFoundModalProps = {
  visible: boolean;
  onClose: () => void;
  onTryAiScan?: () => void;
  onSearchAgain?: () => void;
  onCreateCustom?: () => void;
  /** When false, the "Try AI Camera" option is hidden. Defaults to true for backward compatibility. */
  isAiEnabled?: boolean;
};

export function FoodNotFoundModal({
  visible,
  onClose,
  onTryAiScan,
  onSearchAgain,
  onCreateCustom,
  isAiEnabled = true,
}: FoodNotFoundModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={t('nutrition.foodNotFound')}
      subtitle={t(
        'nutrition.foodNotFoundDescription',
        "We couldn't find this item in our database. What would you like to do?"
      )}
      headerIcon={
        <View className="size-16 items-center justify-center rounded-full bg-orange-500/10">
          <AlertTriangle size={theme.iconSize['2xl']} color={theme.colors.status.warning} />
        </View>
      }
      maxHeight="60%"
    >
      <View className="gap-3 p-2">
        {isAiEnabled ? (
          <Pressable
            onPress={() => {
              onTryAiScan?.();
              onClose();
            }}
            className="overflow-hidden rounded-2xl"
          >
            <LinearGradient
              colors={theme.colors.gradients.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                padding: 16,
              }}
            >
              <View className="h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                <Text className="text-2xl">✨</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-white">{t('nutrition.tryAICamera')}</Text>
                <Text className="text-xs text-white/80">{t('nutrition.tryAICameraDesc')}</Text>
              </View>
              <ChevronRight size={theme.iconSize.md} color={theme.colors.text.primary} />
            </LinearGradient>
          </Pressable>
        ) : null}

        {/* Search Again */}
        <Pressable
          onPress={() => {
            onSearchAgain?.();
            onClose();
          }}
          className="flex-row items-center gap-4 rounded-2xl border border-border-default bg-bg-overlay p-4"
        >
          <View className="h-12 w-12 items-center justify-center rounded-lg bg-white/10">
            <Search size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-text-primary">
              {t('nutrition.searchAgain')}
            </Text>
            <Text className="text-xs text-text-secondary">{t('nutrition.searchAgainDesc')}</Text>
          </View>
          <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
        </Pressable>

        {/* Create Custom Food */}
        <Pressable
          onPress={() => {
            onCreateCustom?.();
            onClose();
          }}
          className="flex-row items-center gap-4 rounded-2xl border border-border-default bg-bg-overlay p-4"
        >
          <View className="h-12 w-12 items-center justify-center rounded-lg bg-white/10">
            <Edit
              size={theme.iconSize.md}
              color={theme.colors.gradients.accent?.[0] || theme.colors.status.indigo}
            />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-text-primary">
              {t('nutrition.createCustom')}
            </Text>
            <Text className="text-xs text-text-secondary">{t('nutrition.createCustomDesc')}</Text>
          </View>
          <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
        </Pressable>
      </View>
    </BottomPopUpMenu>
  );
}
