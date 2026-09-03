import {
  BarChart3,
  Beef,
  Droplets,
  Flame,
  Heart,
  LayoutGrid,
  Leaf,
  Monitor,
  Moon,
  Palette,
  Sun,
  Wheat,
  Wine,
  Zap,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { NAV_DESTINATIONS } from '@/components/navigation/navDestinations';
import { OptionsMultiSelector } from '@/components/theme/OptionsMultiSelector/OptionsMultiSelector';
import { PickerButton } from '@/components/theme/PickerButton';
import {
  type HomeSummaryCard,
  NAV_ITEM_KEYS,
  type NavItemKey,
  THEME_IDS,
  type ThemeOption,
} from '@/constants/settings';
import SettingsService from '@/database/services/SettingsService';
import { isNavItemAvailable, useNavigationItems } from '@/hooks/useNavigationItems';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';

type VisualSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

type SlotNumber = 1 | 2 | 3;

/** Ordered macro keys — index maps to the binary string position. */
const MACRO_KEYS = ['carbs', 'protein', 'fats', 'fiber', 'alcohol'] as const;
type MacroKey = (typeof MACRO_KEYS)[number];

const MACRO_ICON: Record<MacroKey, typeof Wheat> = {
  carbs: Wheat,
  protein: Beef,
  fats: Droplets,
  fiber: Leaf,
  alcohol: Wine,
};

/** Home summary card options and their icons. */
const HOME_SUMMARY_CARD_OPTIONS = ['daily_summary', 'weekly_streak'] as const;

const HOME_SUMMARY_CARD_ICON: Record<HomeSummaryCard, typeof LayoutGrid> = {
  daily_summary: LayoutGrid,
  weekly_streak: Flame,
};

/** Appearance options, in the order they are offered. */
const THEME_OPTIONS = ['system', ...THEME_IDS] as const satisfies readonly ThemeOption[];

// Exhaustive by type: adding a palette to the registry fails the build here until
// it has an icon, which is the reminder that a theme needs a face in the picker.
const THEME_ICON: Record<ThemeOption, typeof Monitor> = {
  system: Monitor,
  'kinetic-depth': Moon,
  'kinetic-light': Sun,
  'kinetic-shock': Palette,
  'kinetic-volt': Zap,
  'kinetic-blush': Heart,
};

/** Convert a 5-char binary string to an array of visible macro keys. */
function binaryToSelected(binary: string): MacroKey[] {
  return MACRO_KEYS.filter((_, i) => binary[i] === '1');
}

/** Convert an array of visible macro keys back to a 5-char binary string. */
function selectedToBinary(selected: MacroKey[]): string {
  return MACRO_KEYS.map((k) => (selected.includes(k) ? '1' : '0')).join('');
}

export function VisualSettingsModal({ visible, onClose }: VisualSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { rawSlots, isCycleActive, setNavSlot } = useNavigationItems();
  // The stored preference, not the resolved mode: 'system' has to stay selectable
  // and visible as itself.
  const { theme: themePreference } = useSettings();

  const [themePopupVisible, setThemePopupVisible] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SlotNumber | null>(null);
  const [macrosPopupVisible, setMacrosPopupVisible] = useState(false);
  const [selectedMacros, setSelectedMacros] = useState<MacroKey[]>([...MACRO_KEYS]);
  const [homeCardPopupVisible, setHomeCardPopupVisible] = useState(false);
  const [homeSummaryCard, setHomeSummaryCard] = useState<HomeSummaryCard>('daily_summary');

  useEffect(() => {
    if (!visible) {
      return;
    }
    SettingsService.getNutritionDisplay().then((binary) => {
      setSelectedMacros(binaryToSelected(binary));
    });
    SettingsService.getHomeSummaryCard().then(setHomeSummaryCard);
  }, [visible]);

  const handleThemeChange = async (option: ThemeOption) => {
    setThemePopupVisible(false);
    // No local state: SettingsProvider observes the settings table, so writing the
    // row is what re-themes the app.
    await SettingsService.setTheme(option);
  };

  const handleHomeSummaryCardChange = async (card: HomeSummaryCard) => {
    setHomeSummaryCard(card);
    setHomeCardPopupVisible(false);
    await SettingsService.setHomeSummaryCard(card);
  };

  const HomeSummaryCardIcon = HOME_SUMMARY_CARD_ICON[homeSummaryCard];
  const ThemeIcon = THEME_ICON[themePreference];

  const handleMacrosChange = async (ids: MacroKey[]) => {
    setSelectedMacros(ids);
    await SettingsService.setNutritionDisplay(selectedToBinary(ids));
  };

  const macroSummaryLabel = (): string => {
    if (selectedMacros.length === MACRO_KEYS.length) {
      return t('settings.nutritionDisplay.allSelected');
    }
    return t('settings.nutritionDisplay.selected', { count: selectedMacros.length });
  };

  const currentSlots = rawSlots;

  const slotLabels: Record<SlotNumber, string> = {
    1: t('settings.visualSettings.slot1Label'),
    2: t('settings.visualSettings.slot2Label'),
    3: t('settings.visualSettings.slot3Label'),
  };

  const getItemLabel = (item: NavItemKey): string => t(`settings.visualSettings.navItems.${item}`);

  const getItemDescription = (item: NavItemKey): string => {
    const inSlot = ([1, 2, 3] as SlotNumber[]).find(
      (s) => s !== activeSlot && currentSlots[s] === item
    );
    if (inSlot) {
      return t('settings.visualSettings.currentlyInSlot', { slot: inSlot });
    }
    return '';
  };

  const menuItems =
    activeSlot !== null
      ? NAV_ITEM_KEYS.filter((item) => isNavItemAvailable(item, isCycleActive)).map((item) => ({
          icon: NAV_DESTINATIONS[item].icon,
          iconColor: theme.colors.accent.primary,
          iconBgColor: theme.colors.background.iconDark,
          title: getItemLabel(item),
          description: getItemDescription(item),
          onPress: () => {
            setNavSlot(activeSlot, item);
          },
        }))
      : [];

  const renderPickerButton = (slot: SlotNumber) => {
    const currentItem = currentSlots[slot];
    const Icon = NAV_DESTINATIONS[currentItem].icon;

    return (
      <View key={slot} className="mb-4">
        <Text
          className="mb-1.5 ml-1 text-sm font-medium"
          style={{ color: theme.colors.text.secondary }}
        >
          {slotLabels[slot]}
        </Text>
        <PickerButton
          label={getItemLabel(currentItem)}
          icon={<Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />}
          onPress={() => setActiveSlot(slot)}
        />
      </View>
    );
  };

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.visualSettings.title')}>
      <View className="gap-2 py-6">
        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}
        >
          <Text className="mb-2 px-1 text-lg font-bold tracking-tight text-text-primary">
            {t('settings.theme.sectionTitle')}
          </Text>
          <Text className="mb-6 px-1 text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('settings.theme.sectionSubtitle')}
          </Text>
          <PickerButton
            icon={<ThemeIcon size={theme.iconSize.md} color={theme.colors.accent.primary} />}
            label={t(`settings.theme.options.${themePreference}.label`)}
            onPress={() => setThemePopupVisible(true)}
          />
        </View>

        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}
        >
          <Text className="mb-2 px-1 text-lg font-bold tracking-tight text-text-primary">
            {t('settings.visualSettings.sectionTitle')}
          </Text>
          <Text className="mb-6 px-1 text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('settings.visualSettings.sectionSubtitle')}
          </Text>

          {renderPickerButton(1)}
          {renderPickerButton(2)}
          {renderPickerButton(3)}
        </View>

        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}
        >
          <Text className="mb-2 px-1 text-lg font-bold tracking-tight text-text-primary">
            {t('settings.nutritionDisplay.sectionTitle')}
          </Text>
          <Text className="mb-6 px-1 text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('settings.nutritionDisplay.sectionSubtitle')}
          </Text>
          <PickerButton
            icon={<BarChart3 size={20} />}
            label={macroSummaryLabel()}
            onPress={() => setMacrosPopupVisible(true)}
          />
        </View>

        <View
          style={{
            marginHorizontal: theme.spacing.padding.base,
          }}
        >
          <Text className="mb-2 px-1 text-lg font-bold tracking-tight text-text-primary">
            {t('settings.homeSummaryCard.sectionTitle')}
          </Text>
          <Text className="mb-6 px-1 text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('settings.homeSummaryCard.sectionSubtitle')}
          </Text>
          <PickerButton
            icon={
              <HomeSummaryCardIcon size={theme.iconSize.md} color={theme.colors.accent.primary} />
            }
            label={t(`settings.homeSummaryCard.options.${homeSummaryCard}.label`)}
            onPress={() => setHomeCardPopupVisible(true)}
          />
        </View>
      </View>
      <BottomPopUp
        visible={macrosPopupVisible}
        onClose={() => setMacrosPopupVisible(false)}
        title={t('settings.nutritionDisplay.popupTitle')}
        subtitle={t('settings.nutritionDisplay.popupSubtitle')}
      >
        <OptionsMultiSelector
          title=""
          hasGroups={false}
          options={MACRO_KEYS.map((key) => ({
            id: key,
            label: t(`settings.nutritionDisplay.${key}`),
            description: '',
            icon: MACRO_ICON[key],
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.background.iconDark,
          }))}
          selectedIds={selectedMacros}
          onChange={(ids) => handleMacrosChange(ids as MacroKey[])}
        />
      </BottomPopUp>
      <BottomPopUpMenu
        visible={activeSlot !== null}
        onClose={() => setActiveSlot(null)}
        title={activeSlot !== null ? slotLabels[activeSlot] : ''}
        subtitle={t('settings.visualSettings.selectItem')}
        items={menuItems}
      />
      <BottomPopUpMenu
        visible={themePopupVisible}
        onClose={() => setThemePopupVisible(false)}
        title={t('settings.theme.popupTitle')}
        subtitle={t('settings.theme.popupSubtitle')}
        items={THEME_OPTIONS.map((option) => ({
          icon: THEME_ICON[option],
          iconColor: theme.colors.accent.primary,
          iconBgColor: theme.colors.background.iconDark,
          title: t(`settings.theme.options.${option}.label`),
          description: t(`settings.theme.options.${option}.description`),
          onPress: () => handleThemeChange(option),
        }))}
      />
      <BottomPopUpMenu
        visible={homeCardPopupVisible}
        onClose={() => setHomeCardPopupVisible(false)}
        title={t('settings.homeSummaryCard.popupTitle')}
        subtitle={t('settings.homeSummaryCard.popupSubtitle')}
        items={HOME_SUMMARY_CARD_OPTIONS.map((card) => ({
          icon: HOME_SUMMARY_CARD_ICON[card],
          iconColor: theme.colors.accent.primary,
          iconBgColor: theme.colors.background.iconDark,
          title: t(`settings.homeSummaryCard.options.${card}.label`),
          description: t(`settings.homeSummaryCard.options.${card}.description`),
          onPress: () => handleHomeSummaryCardChange(card),
        }))}
      />
    </FullScreenModal>
  );
}
