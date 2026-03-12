import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight,
  Heart,
  Moon,
  RefreshCw,
  Ruler,
  Scale,
  Settings,
  Sun,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useDebouncedSettings } from '../../hooks/useDebouncedSettings';
import { useSyncTracking } from '../../hooks/useSyncTracking';
import { useTheme } from '../../hooks/useTheme';
import { SettingsCard } from '../cards/SettingsCard';
import { Button } from '../theme/Button';
import { SegmentedControl } from '../theme/SegmentedControl';
import { ToggleInput } from '../theme/ToggleInput';
import { FullScreenModal } from './FullScreenModal';

type ThemeOption = 'system' | 'light' | 'dark';

const HAS_THEMES = false; // TODO: remove this once we have option to pick dark or light theme

type BasicSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  // Language settings
  language?: string;
  onLanguagePress?: () => void;
};

export function BasicSettingsModal({
  visible,
  onClose,
  language = 'English (US)',
  onLanguagePress,
}: BasicSettingsModalProps) {
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
    handleUnitsChange,
    handleConnectHealthDataChange,
    handleReadHealthDataChange,
    handleWriteHealthDataChange,
    handleFoodSearchSourceChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(1500);

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

  const foodSearchOptions = [
    ...(hasUsdaApiKey
      ? [
          {
            label: t('settings.basicSettings.foodSearchBoth'),
            value: 'both',
          },
        ]
      : []),
    {
      label: t('settings.basicSettings.foodSearchOpenFoodFacts'),
      value: 'openfood',
    },
    ...(hasUsdaApiKey
      ? [
          {
            label: t('settings.basicSettings.foodSearchUSDA'),
            value: 'usda',
          },
        ]
      : []),
  ];

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

        {/* Food Search Section */}
        {foodSearchOptions.length > 1 ? (
          <View
            style={{
              marginHorizontal: theme.spacing.padding.base,
            }}
          >
            <Text className="mb-3 px-5 text-lg font-bold tracking-tight text-text-primary">
              {t('settings.basicSettings.foodSearchSource')}
            </Text>
            <View className="gap-2">
              <SegmentedControl
                options={foodSearchOptions}
                value={
                  !hasUsdaApiKey && (foodSearchSource === 'usda' || foodSearchSource === 'both')
                    ? 'openfood'
                    : foodSearchSource || (hasUsdaApiKey ? 'both' : 'openfood')
                }
                onValueChange={(val) => handleFoodSearchSourceChange(val as any)}
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
            onPress={onLanguagePress || (() => {})}
            icon={<Settings size={theme.iconSize.xl} color={theme.colors.text.primary} />}
            rightIcon={
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-sm font-medium"
                  style={{ color: theme.colors.accent.primary }}
                >
                  {language}
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
    </FullScreenModal>
  );
}
