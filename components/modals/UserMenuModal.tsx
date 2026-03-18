import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Calendar,
  Dumbbell,
  MessageSquare,
  Settings,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { createElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigationItems } from '../../hooks/useNavigationItems';
import { useTheme } from '../../hooks/useTheme';
import { AvatarColor } from '../../types/AvatarColor';
import { AvatarIcon } from '../../types/AvatarIcon';
import { getAvatarDisplayProps } from '../../utils/avatarUtils';

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
};

function MenuItem({ icon, label, onPress }: MenuItemProps) {
  return (
    <Pressable
      className="active:bg-bg-card-elevated flex-row items-center gap-4 rounded-2xl bg-bg-overlay p-4"
      onPress={onPress}
    >
      <View className="bg-bg-card-elevated h-12 w-12 items-center justify-center rounded-full">
        {icon}
      </View>
      <Text className="flex-1 text-lg font-semibold text-text-primary">{label}</Text>
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
  const { rawSlots, isAiFeaturesEnabled, isCycleActive } = useNavigationItems();

  const isInNav = (item: string) =>
    rawSlots[1] === item || rawSlots[2] === item || rawSlots[3] === item;

  // Web-specific styles for proper viewport positioning
  const webBackdropStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
        } as any)
      : {};

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
        <SafeAreaView
          className="flex-1 justify-start"
          edges={['top']}
          style={
            Platform.OS === 'web'
              ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }
              : undefined
          }
        >
          {/* Modal Content */}
          <View className="overflow-hidden rounded-b-3xl border-b border-border-dark bg-bg-card">
            {/* Gradient Header */}
            <LinearGradient
              colors={[
                theme.colors.status.purple40,
                theme.colors.accent.secondary10,
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="border-b border-border-dark"
            >
              <View className="flex-row items-center justify-between p-6">
                <View className="flex-row items-center gap-4">
                  <View
                    className="h-14 w-14 overflow-hidden rounded-full border-2"
                    style={{
                      borderColor: user.avatarIcon
                        ? getAvatarDisplayProps(user.avatarIcon, user.avatarColor).color
                        : theme.colors.accent.primary,
                      backgroundColor: user.avatarIcon
                        ? getAvatarDisplayProps(user.avatarIcon, user.avatarColor).backgroundColor
                        : theme.colors.background.imageLight,
                    }}
                  >
                    {user.avatarIcon ? (
                      <View className="h-full w-full items-center justify-center rounded-full">
                        {createElement(
                          getAvatarDisplayProps(user.avatarIcon, user.avatarColor).IconComponent,
                          {
                            size: 24,
                            color: getAvatarDisplayProps(user.avatarIcon, user.avatarColor).color,
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
            </LinearGradient>

            {/* Menu Items */}
            <View className="gap-3 p-6">
              {!isInNav('profile') ? (
                <MenuItem
                  icon={<User size={theme.iconSize.md} color={theme.colors.accent.primary} />}
                  label={t('userMenu.profile')}
                  onPress={() => {
                    onProfilePress ? onProfilePress() : router.push('/profile');
                    onClose();
                  }}
                />
              ) : null}

              {!isInNav('progress') ? (
                <MenuItem
                  icon={
                    <BarChart3 size={theme.iconSize.md} color={theme.colors.accent.secondary} />
                  }
                  label={t('userMenu.progress')}
                  onPress={() => {
                    onProgressPress ? onProgressPress() : router.push('/progress');
                    onClose();
                  }}
                />
              ) : null}

              {!isInNav('cycle') && isCycleActive ? (
                <MenuItem
                  icon={<Calendar size={theme.iconSize.md} color={theme.colors.status.purple40} />}
                  label={t('userMenu.cycle')}
                  onPress={() => {
                    onCyclePress ? onCyclePress() : router.push('/cycle');
                    onClose();
                  }}
                />
              ) : null}

              {!isInNav('workouts') ? (
                <MenuItem
                  icon={<Dumbbell size={theme.iconSize.md} color={theme.colors.accent.primary} />}
                  label={t('userMenu.workouts')}
                  onPress={() => {
                    router.push('/workout/workouts');
                    onClose();
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
                  onPress={() => {
                    router.push('/nutrition/food');
                    onClose();
                  }}
                />
              ) : null}

              {!isInNav('coach') && isAiFeaturesEnabled && onCoachPress ? (
                <MenuItem
                  icon={
                    <MessageSquare size={theme.iconSize.md} color={theme.colors.text.secondary} />
                  }
                  label={t('userMenu.coach')}
                  onPress={() => {
                    onCoachPress();
                    onClose();
                  }}
                />
              ) : null}

              {!isInNav('settings') ? (
                <MenuItem
                  icon={<Settings size={theme.iconSize.md} color={theme.colors.text.secondary} />}
                  label={t('userMenu.settings')}
                  onPress={() => {
                    onSettingsPress ? onSettingsPress() : router.push('/settings');
                    onClose();
                  }}
                />
              ) : null}

              {onDebugMenuPress ? (
                <Pressable
                  className="active:bg-bg-card-elevated flex-row items-center gap-4 rounded-2xl bg-bg-overlay p-4"
                  onPress={() => {
                    onDebugMenuPress?.();
                    onClose();
                  }}
                >
                  <Text className="flex-1 text-lg font-semibold text-text-primary">
                    {t('userMenu.debugPage')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Top safe area spacing */}
            <View className="h-8" />
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
