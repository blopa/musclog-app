import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { createElement, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachUnreadBadgeIcon } from '@/components/CoachUnreadBadgeIcon';
import { NAV_DESTINATIONS } from '@/components/navigation/navDestinations';
import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import { Modal } from '@/components/theme/Modal';
import { type NavItemKey, type NavItemKeyList } from '@/constants/settings';
import { isNavItemAvailable, useNavigationItems } from '@/hooks/useNavigationItems';
import { useTheme } from '@/hooks/useTheme';
import { AvatarColor } from '@/types/AvatarColor';
import { AvatarIcon } from '@/types/AvatarIcon';
import { getAvatarDisplayProps } from '@/utils/avatarUtils';
import { useWebModalLayerStyle } from '@/utils/webPhoneFrame';

type UserMenuModalProps = {
  visible: boolean;
  onClose: () => void;
  user: {
    name: string;
    avatar?: ImageSourcePropType;
    avatarIcon?: AvatarIcon;
    avatarColor?: AvatarColor;
  };
  onCoachPress?: () => void;
  onProfilePress?: () => void;
  onSettingsPress?: () => void;
  onProgressPress?: () => void;
  onCyclePress?: () => void;
  onDebugMenuPress?: () => void;
};

/**
 * Account-menu order. Deliberately not `NAV_ITEM_KEYS` order — an account menu leads with the
 * account — so it is spelled out, but `NavItemKeyList` makes the compiler reject a list that
 * misses a destination, which a bare `NavItemKey[]` would happily accept.
 */
const USER_MENU_ORDER = [
  'profile',
  'progress',
  'cycle',
  'workouts',
  'food',
  'checkin',
  'notes',
  'coach',
  'settings',
] as const satisfies NavItemKeyList;

/** The coach carries an unread badge, so it draws its own icon rather than the plain glyph. */
function CoachMenuIcon({ size, color }: { size: number; color: string }) {
  const theme = useTheme();

  return <CoachUnreadBadgeIcon color={color} size={size} strokeWidth={theme.borderWidth.medium} />;
}

export function UserMenuModal({
  visible,
  onClose,
  user,
  onCoachPress,
  onProfilePress,
  onSettingsPress,
  onProgressPress,
  onCyclePress,
  onDebugMenuPress,
}: UserMenuModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { rawSlots, isCycleActive } = useNavigationItems();

  const isInNav = (item: string) =>
    rawSlots[1] === item || rawSlots[2] === item || rawSlots[3] === item;

  const spinner = <ActivityIndicator size="small" color={theme.colors.accent.primary} />;

  const webBackdropStyle = useWebModalLayerStyle({ variant: 'fullscreen' });

  // Track which menu item is currently loading
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  // Navigate and close modal after navigation transition completes
  const navigateAndClose = useCallback(
    (itemKey: string, navigateFn: () => void) => {
      setLoadingItem(itemKey);
      navigateFn();
      requestIdleCallback(() => {
        onClose();
        setLoadingItem(null);
      });
    },
    [onClose]
  );

  // A few destinations let the host screen intercept the press instead of routing; the rest just
  // navigate to the destination's own route. `coach` has no route at all, so it is *only* ever
  // reachable through its handler and disappears from the menu when none is supplied.
  const pressHandlerOverrides: Partial<Record<NavItemKey, (() => void) | undefined>> = {
    profile: onProfilePress,
    progress: onProgressPress,
    cycle: onCyclePress,
    settings: onSettingsPress,
    coach: onCoachPress,
  };

  // Nine entries rendered inside a modal — cheap enough to build on every render, which keeps the
  // list free of a memo whose dependency list would have to restate every override prop.
  const menuItems = USER_MENU_ORDER.filter(
    (item) => !isInNav(item) && isNavItemAvailable(item, isCycleActive)
  )
    .map((item) => {
      const { icon: Icon, menuLabelKey, route } = NAV_DESTINATIONS[item];
      const navigate = pressHandlerOverrides[item] ?? (route ? () => router.navigate(route) : null);

      if (!navigate) {
        return null;
      }

      return {
        item,
        label: t(menuLabelKey),
        icon: item === 'coach' ? CoachMenuIcon : Icon,
        onPress: () => navigateAndClose(item, navigate),
      };
    })
    .filter((entry) => entry !== null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      {/* Backdrop */}
      <Pressable
        className="flex-1"
        style={[{ backgroundColor: theme.colors.overlay.scrim60 }, webBackdropStyle]}
        onPress={onClose}
      >
        <SafeAreaView
          edges={['top']}
          className="flex-1 justify-start"
          style={
            Platform.OS === 'web'
              ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }
              : undefined
          }
        >
          {/* Modal Content */}
          <View className="overflow-hidden rounded-b-3xl border-b border-border-dark bg-bg-card">
            {/* Header */}
            <View className="border-b border-border-dark">
              <View className="flex-row items-center justify-between p-6">
                <View className="flex-row items-center gap-4">
                  <View
                    className="h-14 w-14 overflow-hidden rounded-full border-2"
                    style={{
                      borderColor: user.avatarIcon
                        ? getAvatarDisplayProps(theme, user.avatarIcon, user.avatarColor).color
                        : theme.colors.accent.primary,
                      backgroundColor: user.avatarIcon
                        ? getAvatarDisplayProps(theme, user.avatarIcon, user.avatarColor)
                            .backgroundColor
                        : theme.colors.background.imageLight,
                    }}
                  >
                    {user.avatarIcon ? (
                      <View className="h-full w-full items-center justify-center rounded-full">
                        {createElement(
                          getAvatarDisplayProps(theme, user.avatarIcon, user.avatarColor)
                            .IconComponent,
                          {
                            size: 24,
                            color: getAvatarDisplayProps(theme, user.avatarIcon, user.avatarColor)
                              .color,
                          }
                        )}
                      </View>
                    ) : user.avatar ? (
                      <Image source={user.avatar} className="h-full w-full" resizeMode="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center rounded-full">
                        <Text className="text-lg font-bold text-text-primary">
                          {user.name?.charAt(0).toUpperCase() || 'G'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View>
                    <Text className="text-sm text-text-secondary">{t('userMenu.greeting')}</Text>
                    <Text className="text-xl font-bold text-text-primary">{user.name}</Text>
                  </View>
                </View>
                <Pressable
                  className="active:bg-bg-card-elevated h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                  onPress={onClose}
                >
                  <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </Pressable>
              </View>
            </View>

            {/* Menu Items */}
            <View className="p-6">
              <ListGroup>
                {menuItems.map(({ item, label, icon, onPress }) => (
                  <ListRow
                    key={item}
                    variant="grouped"
                    icon={icon}
                    title={label}
                    trailing={loadingItem === item ? spinner : null}
                    disabled={loadingItem === item}
                    onPress={onPress}
                  />
                ))}

                {onDebugMenuPress ? (
                  <ListRow
                    key="debug"
                    variant="grouped"
                    title={t('userMenu.debugPage')}
                    trailing={loadingItem === 'debug' ? spinner : null}
                    disabled={loadingItem === 'debug'}
                    onPress={() => {
                      navigateAndClose('debug', onDebugMenuPress);
                    }}
                  />
                ) : null}
              </ListGroup>
            </View>

            {/* Top safe area spacing */}
            <View className="h-8" />
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
