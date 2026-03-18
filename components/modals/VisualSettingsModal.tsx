import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  Dumbbell,
  MessageSquare,
  Settings,
  User,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { NavItemKey } from '../../constants/settings';
import { useNavigationItems } from '../../hooks/useNavigationItems';
import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';
import { PickerButton } from '../theme/PickerButton';
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

export function VisualSettingsModal({ visible, onClose }: VisualSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { rawSlots, isAiFeaturesEnabled, isCycleActive, hasPendingCheckin, setNavSlot } =
    useNavigationItems();

  const [activeSlot, setActiveSlot] = useState<SlotNumber | null>(null);

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
    if (item === 'coach' && !isAiFeaturesEnabled) {
      return false;
    }

    if (item === 'cycle' && !isCycleActive) {
      return false;
    }

    if (item === 'checkin' && !hasPendingCheckin) {
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
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('settings.visualSettings.title')}
      >
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
        </View>
      </FullScreenModal>

      <BottomPopUpMenu
        visible={activeSlot !== null}
        onClose={() => setActiveSlot(null)}
        title={activeSlot !== null ? slotLabels[activeSlot] : ''}
        subtitle={t('settings.visualSettings.selectItem')}
        items={menuItems}
      />
    </>
  );
}
