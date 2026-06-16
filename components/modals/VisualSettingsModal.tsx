import {
  BarChart3,
  Beef,
  Calendar,
  ClipboardCheck,
  Droplets,
  Dumbbell,
  Flame,
  LayoutGrid,
  Leaf,
  MessageSquare,
  Settings,
  User,
  UtensilsCrossed,
  Wheat,
  Wine,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { OptionsMultiSelector } from '@/components/theme/OptionsMultiSelector/OptionsMultiSelector';
import { PickerButton } from '@/components/theme/PickerButton';
import type { HomeSummaryCard, NavItemKey } from '@/constants/settings';
import SettingsService from '@/database/services/SettingsService';
import { useNavigationItems } from '@/hooks/useNavigationItems';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';

type VisualSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

type SlotNumber = 1 | 2 | 3;

const NAV_ITEM_ICON: Record<NavItemKey, typeof Dumbbell> = {
  workouts: Dumbbell,
  food: UtensilsCrossed,
  profile: User,
  coach: MessageSquare,
  cycle: Calendar,
  settings: Settings,
  progress: BarChart3,
  checkin: ClipboardCheck,
};

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
  const { rawSlots, isAiConfigured, isCycleActive, setNavSlot } = useNavigationItems();

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

  const handleHomeSummaryCardChange = async (card: HomeSummaryCard) => {
    setHomeSummaryCard(card);
    setHomeCardPopupVisible(false);
    await SettingsService.setHomeSummaryCard(card);
  };

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

  const allNavItems: NavItemKey[] = [
    'workouts',
    'food',
    'profile',
    'coach',
    'cycle',
    'settings',
    'progress',
    'checkin',
  ];

  const isItemAvailable = (item: NavItemKey): boolean => {
    if (item === 'cycle' && !isCycleActive) {
      return false;
    }

    return true;
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
      ? allNavItems.filter(isItemAvailable).map((item) => ({
          icon: NAV_ITEM_ICON[item],
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
    const Icon = NAV_ITEM_ICON[currentItem];

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
            icon={(() => {
              const Icon = HOME_SUMMARY_CARD_ICON[homeSummaryCard];
              return <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />;
            })()}
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
