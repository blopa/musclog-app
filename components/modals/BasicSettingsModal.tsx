import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight,
  Globe,
  Heart,
  Languages,
  Leaf,
  Moon,
  RefreshCw,
  Ruler,
  Scale,
  Search,
  Settings,
  Sun,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { type FoodSearchSource } from '../../constants/settings';
import { useDebouncedSettings } from '../../hooks/useDebouncedSettings';
import { useSyncTracking } from '../../hooks/useSyncTracking';
import { useTheme } from '../../hooks/useTheme';
import i18n, { AVAILABLE_LANGUAGES, EN_US, PT_BR } from '../../lang/lang';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { SettingsCard } from '../cards/SettingsCard';
import { Button } from '../theme/Button';
import { PickerButton } from '../theme/PickerButton';
import { SegmentedControl } from '../theme/SegmentedControl';
import { ToggleInput } from '../theme/ToggleInput';
import { FullScreenModal } from './FullScreenModal';

type ThemeOption = 'system' | 'light' | 'dark';

const HAS_THEMES = false; // TODO: remove this once we have option to pick dark or light theme

type BasicSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function BasicSettingsModal({ visible, onClose }: BasicSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { syncNow, isSyncing, isSyncEnabled } = useSyncTracking();

  // Use debounced settings for instant UI updates
  const {
    theme: themeValue,
    units,
    connectHealthData: debouncedConnectHealthData,
    readHealthData: debouncedReadHealthData,
    writeHealthData: debouncedWriteHealthData,
    handleThemeChange,
    foodSearchSource,
    language,
    handleUnitsChange,
    handleConnectHealthDataChange,
    handleReadHealthDataChange,
    handleWriteHealthDataChange,
    handleFoodSearchSourceChange,
    handleLanguageChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(500);

  const [foodSearchMenuVisible, setFoodSearchMenuVisible] = useState(false);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);

  // Flush pending settings changes when modal closes
  useEffect(() => {
    if (!visible) {
      flushAllPendingChanges();
    }
  }, [visible, flushAllPendingChanges]);

  // TODO: actually implement light theme OR remove/hide this option
  const themeOptions = [
    {
      value: 'system',
      label: t('settings.basicSettings.themeSystem'),
      icon: (
        <Settings
          size={theme.iconSize.md}
          color={themeValue === 'system' ? theme.colors.accent.primary : theme.colors.text.tertiary}
        />
      ),
    },
    {
      value: 'light',
      label: t('settings.basicSettings.themeLight'),
      icon: (
        <Sun
          size={theme.iconSize.md}
          color={themeValue === 'light' ? theme.colors.accent.primary : theme.colors.text.tertiary}
        />
      ),
    },
    {
      value: 'dark',
      label: t('settings.basicSettings.themeDark'),
      icon: (
        <Moon
          size={theme.iconSize.md}
          color={themeValue === 'dark' ? theme.colors.accent.primary : theme.colors.text.tertiary}
        />
      ),
    },
  ];

  const hasUsdaApiKey = !!process.env.EXPO_PUBLIC_USDA_API_KEY;

  // TODO: add an option for local search only, and update the rest of the codebase to handle this case
  const foodSearchMenuItems: BottomPopUpMenuItem[] = [
    ...(hasUsdaApiKey
      ? [
          {
            icon: Search,
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.accent.primary10,
            title: t('settings.basicSettings.foodSearchBoth'),
            description: t('settings.basicSettings.foodSearchBothDescription'),
            onPress: () => handleFoodSearchSourceChange('both' as any),
          },
        ]
      : []),
    {
      icon: Globe,
      iconColor: theme.colors.status.info,
      iconBgColor: theme.colors.status.info10,
      title: t('settings.basicSettings.foodSearchOpenFoodFacts'),
      description: t('settings.basicSettings.foodSearchOpenFoodFactsDescription'),
      onPress: () => handleFoodSearchSourceChange('openfood' as any),
    },
    ...(hasUsdaApiKey
      ? [
          {
            icon: Leaf,
            iconColor: theme.colors.status.success,
            iconBgColor: theme.colors.status.emerald10,
            title: t('settings.basicSettings.foodSearchUSDA'),
            description: t('settings.basicSettings.foodSearchUSDADescription'),
            onPress: () => handleFoodSearchSourceChange('usda' as any),
          },
        ]
      : []),
  ];

  const effectiveFoodSearchSource: FoodSearchSource =
    !hasUsdaApiKey && (foodSearchSource === 'usda' || foodSearchSource === 'both')
      ? 'openfood'
      : ((foodSearchSource ?? (hasUsdaApiKey ? 'both' : 'openfood')) as FoodSearchSource);

  const foodSearchLabel = {
    both: t('settings.basicSettings.foodSearchBoth'),
    openfood: t('settings.basicSettings.foodSearchOpenFoodFacts'),
    usda: t('settings.basicSettings.foodSearchUSDA'),
  }[effectiveFoodSearchSource];

  const languageLabels: Record<string, string> = {
    [EN_US]: 'English (US)',
    [PT_BR]: 'Português (BR)',
  };

  const currentLanguageLabel = languageLabels[language ?? EN_US] ?? language ?? 'English (US)';

  const languageMenuItems: BottomPopUpMenuItem[] = AVAILABLE_LANGUAGES.map((lang) => ({
    icon: Languages,
    iconColor: theme.colors.accent.primary,
    iconBgColor: theme.colors.accent.primary10,
    title: languageLabels[lang] ?? lang,
    description: lang,
    onPress: () => {
      handleLanguageChange(lang);
      i18n.changeLanguage(lang);
    },
  }));

  const unitsOptions = [
    {
      label: t('editFitnessDetails.imperial'),
      value: 'imperial',
      icon: (
        <Scale
          size={theme.iconSize.md}
          color={units === 'imperial' ? theme.colors.accent.primary : theme.colors.text.tertiary}
        />
      ),
    },
    {
      label: t('editFitnessDetails.metric'),
      value: 'metric',
      icon: (
        <Ruler
          size={theme.iconSize.md}
          color={units === 'metric' ? theme.colors.accent.primary : theme.colors.text.tertiary}
        />
      ),
    },
  ];

  const healthSettingsItems = [
    {
      key: 'connect',
      label: t('settings.basicSettings.connectHealthData'),
      value: debouncedConnectHealthData,
      onValueChange: handleConnectHealthDataChange,
    },
    ...(debouncedConnectHealthData
      ? [
          {
            key: 'read',
            label: t('settings.basicSettings.readHealthData'),
            value: debouncedReadHealthData,
            onValueChange: handleReadHealthDataChange,
          },
          {
            key: 'write',
            label: t('settings.basicSettings.writeHealthData'),
            value: debouncedWriteHealthData,
            onValueChange: handleWriteHealthDataChange,
          },
        ]
      : []),
  ];

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.basicSettings.title')}>
      <View className="gap-8 py-6">
        {/* Appearance Section */}
        {HAS_THEMES ? (
          <View>
            <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
              {t('settings.basicSettings.appearance')}
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.background.card,
                borderRadius: theme.borderRadius.lg,
                marginHorizontal: theme.spacing.padding.base,
                padding: theme.spacing.padding.base,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
              }}
            >
              <Text className="mb-3 text-sm font-medium text-text-secondary">
                {t('settings.basicSettings.appTheme')}
              </Text>
              <SegmentedControl
                options={themeOptions}
                value={themeValue}
                onValueChange={(val) => handleThemeChange(val as ThemeOption)}
              />
            </View>
          </View>
        ) : null}

        {/* Units Section */}
        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}
        >
          <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
            {t('editFitnessDetails.units')}
          </Text>
          <View className="gap-2">
            <SegmentedControl
              options={unitsOptions}
              value={units || 'metric'}
              onValueChange={(val) => handleUnitsChange(val as 'metric' | 'imperial')}
            />
          </View>
        </View>

        {foodSearchMenuItems.length > 1 ? (
          <View
            style={{
              marginHorizontal: theme.spacing.padding.base,
            }}
          >
            <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
              {t('settings.basicSettings.foodSearchSource')}
            </Text>
            <View className="gap-2">
              <PickerButton
                label={foodSearchLabel}
                icon={<Search size={theme.iconSize.lg} color={theme.colors.text.secondary} />}
                onPress={() => setFoodSearchMenuVisible(true)}
              />
            </View>
          </View>
        ) : null}

        {/* Localization Section */}
        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}
        >
          <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
            {t('settings.basicSettings.localization')}
          </Text>
          <SettingsCard
            title={t('settings.basicSettings.language')}
            subtitle={t('settings.basicSettings.languageSubtitle')}
            onPress={() => setLanguageMenuVisible(true)}
            icon={<Languages size={theme.iconSize.xl} color={theme.colors.text.primary} />}
            rightIcon={
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-sm font-medium"
                  style={{ color: theme.colors.accent.primary }}
                >
                  {currentLanguageLabel}
                </Text>
                <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
              </View>
            }
          />
        </View>

        {/* Integrations Section */}
        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}
        >
          <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
            {t('settings.basicSettings.integrations')}
          </Text>

          <ToggleInput
            items={healthSettingsItems}
            header={
              <LinearGradient
                colors={[
                  theme.colors.status.purple40,
                  theme.colors.accent.secondary10,
                  'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="border-b p-4"
                style={{
                  borderBottomColor: theme.colors.border.light,
                }}
              >
                <View className="mb-2 flex-row items-center gap-3">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: theme.colors.background.white }}
                  >
                    <Heart
                      size={theme.iconSize.xl}
                      color={theme.colors.status.error}
                      fill={theme.colors.status.error}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-text-primary">
                      {t('settings.basicSettings.healthData')}
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      {t('settings.basicSettings.healthDataSubtitle')}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            }
          />

          {isSyncEnabled ? (
            <View className="mt-3">
              <Button
                label={
                  isSyncing
                    ? t('settings.basicSettings.syncing')
                    : t('settings.basicSettings.syncNow')
                }
                onPress={syncNow}
                icon={RefreshCw}
                variant="secondary"
                size="sm"
                width="full"
                loading={isSyncing}
              />
            </View>
          ) : null}

          <Text
            className="mt-3 px-8 text-center text-xs"
            style={{ color: theme.colors.text.tertiary }}
          >
            {t('settings.basicSettings.healthDataPrivacy')}
          </Text>
        </View>
      </View>
      <BottomPopUpMenu
        visible={foodSearchMenuVisible}
        onClose={() => setFoodSearchMenuVisible(false)}
        title={t('settings.basicSettings.foodSearchSource')}
        items={foodSearchMenuItems}
      />
      <BottomPopUpMenu
        visible={languageMenuVisible}
        onClose={() => setLanguageMenuVisible(false)}
        title={t('settings.basicSettings.language')}
        items={languageMenuItems}
      />
    </FullScreenModal>
  );
}
