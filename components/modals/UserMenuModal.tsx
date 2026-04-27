import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  Dumbbell,
  MessageSquare,
  Settings,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { createElement, ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  InteractionManager,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/theme/Modal';
import { useNavigationItems } from '@/hooks/useNavigationItems';
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

type MenuItemProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  isLoading?: boolean;
};

function MenuItem({ icon, label, onPress, isLoading }: MenuItemProps) {
  return (
    <Pressable
      className="active:bg-bg-card-elevated bg-bg-overlay flex-row items-center gap-4 rounded-2xl p-4"
      onPress={onPress}
      disabled={isLoading}
    >
      <View className="bg-bg-card-elevated h-12 w-12 items-center justify-center rounded-full">
        {icon}
      </View>
      <Text className="text-text-primary flex-1 text-lg font-semibold">{label}</Text>
      {isLoading ? <ActivityIndicator size="small" color="#10B981" /> : null}
    </Pressable>
  );
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
  const { rawSlots, isAiConfigured, isCycleActive } = useNavigationItems();

  const isInNav = (item: string) =>
    rawSlots[1] === item || rawSlots[2] === item || rawSlots[3] === item;

  const webBackdropStyle = useWebModalLayerStyle({ variant: 'fullscreen' });
  const insets = useSafeAreaInsets();

  // Track which menu item is currently loading
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  // Navigate and close modal after navigation transition completes
  const navigateAndClose = useCallback(
    (itemKey: string, navigateFn: () => void) => {
      setLoadingItem(itemKey);
      navigateFn();
      // Use InteractionManager to wait for navigation transition to complete
      InteractionManager.runAfterInteractions(() => {
        onClose();
        setLoadingItem(null);
      });
    },
    [onClose]
  );

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
        style={[{ backgroundColor: theme.colors.overlay.black60 }, webBackdropStyle]}
        onPress={onClose}
      >
        <View
          className="flex-1 justify-start"
          style={[
            Platform.OS === 'web'
              ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }
              : undefined,
            { paddingTop: insets.top },
          ]}
        >
          {/* Modal Content */}
          <View className="border-border-dark bg-bg-card overflow-hidden rounded-b-3xl border-b">
            {/* Gradient Header */}
            <LinearGradient
              colors={[
                theme.colors.status.purple40,
                theme.colors.accent.secondary10,
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="border-border-dark border-b"
            >
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
                        <Text className="text-text-primary text-lg font-bold">
                          {user.name?.charAt(0).toUpperCase() || 'G'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View>
                    <Text className="text-text-secondary text-sm">{t('userMenu.greeting')}</Text>
                    <Text className="text-text-primary text-xl font-bold">{user.name}</Text>
                  </View>
                </View>
                <Pressable
                  className="active:bg-bg-card-elevated bg-bg-overlay h-10 w-10 items-center justify-center rounded-full"
                  onPress={onClose}
                >
                  <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </Pressable>
              </View>
            </LinearGradient>

            {/* Menu Items */}
            <View className="gap-3 p-6">
              {!isInNav('profile') ? (
                <MenuItem
                  icon={<User size={theme.iconSize.md} color={theme.colors.accent.primary} />}
                  label={t('userMenu.profile')}
                  isLoading={loadingItem === 'profile'}
                  onPress={() => {
                    navigateAndClose('profile', () => {
                      onProfilePress ? onProfilePress() : router.navigate('/app/profile');
                    });
                  }}
                />
              ) : null}

              {!isInNav('progress') ? (
                <MenuItem
                  icon={
                    <BarChart3 size={theme.iconSize.md} color={theme.colors.accent.secondary} />
                  }
                  label={t('userMenu.progress')}
                  isLoading={loadingItem === 'progress'}
                  onPress={() => {
                    navigateAndClose('progress', () => {
                      onProgressPress ? onProgressPress() : router.navigate('/app/progress');
                    });
                  }}
                />
              ) : null}

              {!isInNav('cycle') && isCycleActive ? (
                <MenuItem
                  icon={<Calendar size={theme.iconSize.md} color={theme.colors.status.purple40} />}
                  label={t('userMenu.cycle')}
                  isLoading={loadingItem === 'cycle'}
                  onPress={() => {
                    navigateAndClose('cycle', () => {
                      onCyclePress ? onCyclePress() : router.navigate('/app/cycle');
                    });
                  }}
                />
              ) : null}

              {!isInNav('workouts') ? (
                <MenuItem
                  icon={<Dumbbell size={theme.iconSize.md} color={theme.colors.accent.primary} />}
                  label={t('userMenu.workouts')}
                  isLoading={loadingItem === 'workouts'}
                  onPress={() => {
                    navigateAndClose('workouts', () => router.navigate('/app/workout/workouts'));
                  }}
                />
              ) : null}

              {!isInNav('food') ? (
                <MenuItem
                  icon={
                    <UtensilsCrossed
                      size={theme.iconSize.md}
                      color={theme.colors.accent.secondary}
                    />
                  }
                  label={t('userMenu.food')}
                  isLoading={loadingItem === 'food'}
                  onPress={() => {
                    navigateAndClose('food', () => router.navigate('/app/nutrition/food'));
                  }}
                />
              ) : null}

              {!isInNav('checkin') ? (
                <MenuItem
                  icon={
                    <ClipboardCheck
                      size={theme.iconSize.md}
                      color={theme.colors.accent.secondary}
                    />
                  }
                  label={t('userMenu.checkin')}
                  isLoading={loadingItem === 'checkin'}
                  onPress={() => {
                    navigateAndClose('checkin', () =>
                      router.navigate('/app/nutrition/checkin-list')
                    );
                  }}
                />
              ) : null}

              {!isInNav('coach') && onCoachPress ? (
                <MenuItem
                  icon={
                    <MessageSquare size={theme.iconSize.md} color={theme.colors.text.secondary} />
                  }
                  label={t('userMenu.coach')}
                  isLoading={loadingItem === 'coach'}
                  onPress={() => {
                    navigateAndClose('coach', onCoachPress);
                  }}
                />
              ) : null}

              {!isInNav('settings') ? (
                <MenuItem
                  icon={<Settings size={theme.iconSize.md} color={theme.colors.text.secondary} />}
                  label={t('userMenu.settings')}
                  isLoading={loadingItem === 'settings'}
                  onPress={() => {
                    navigateAndClose('settings', () => {
                      onSettingsPress ? onSettingsPress() : router.navigate('/app/settings');
                    });
                  }}
                />
              ) : null}

              {onDebugMenuPress ? (
                <Pressable
                  className="active:bg-bg-card-elevated bg-bg-overlay flex-row items-center gap-4 rounded-2xl p-4"
                  disabled={loadingItem === 'debug'}
                  onPress={() => {
                    navigateAndClose('debug', onDebugMenuPress);
                  }}
                >
                  <Text className="text-text-primary flex-1 text-lg font-semibold">
                    {t('userMenu.debugPage')}
                  </Text>
                  {loadingItem === 'debug' ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : null}
                </Pressable>
              ) : null}
            </View>

            {/* Top safe area spacing */}
            <View className="h-8" />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
