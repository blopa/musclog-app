import { View, Text, Pressable, Modal, Image, ImageSourcePropType, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, User, Settings, BarChart3 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type UserMenuModalProps = {
  visible: boolean;
  onClose: () => void;
  user: {
    name: string;
    avatar: ImageSourcePropType;
  };
  onProfilePress?: () => void;
  onSettingsPress?: () => void;
  onProgressPress?: () => void;
  onDebugMenuPress?: () => void;
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
};

function MenuItem({ icon, label, onPress }: MenuItemProps) {
  return (
    <Pressable
      className="active:bg-bg-card-elevated flex-row items-center gap-4 rounded-2xl bg-bg-overlay p-4"
      onPress={onPress}>
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
  onProfilePress,
  onSettingsPress,
  onProgressPress,
  onDebugMenuPress,
}: UserMenuModalProps) {
  const { t } = useTranslation();

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
          height: '100vh',
        } as any)
      : {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}>
      {/* Backdrop */}
      <Pressable
        className="flex-1"
        style={[{ backgroundColor: theme.colors.overlay.black60 }, webBackdropStyle]}
        onPress={onClose}>
        <View
          className="flex-1 justify-start"
          style={
            Platform.OS === 'web'
              ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }
              : undefined
          }>
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
              className="border-b border-border-dark">
              <View className="flex-row items-center justify-between p-6">
                <View className="flex-row items-center gap-4">
                  <View
                    className="h-14 w-14 overflow-hidden rounded-full border-2 border-accent-primary"
                    style={{ backgroundColor: theme.colors.background.imageLight }}>
                    <Image source={user.avatar} className="h-full w-full" resizeMode="cover" />
                  </View>
                  <View>
                    <Text className="text-sm text-text-secondary">{t('userMenu.greeting')}</Text>
                    <Text className="text-xl font-bold text-text-primary">{user.name}</Text>
                  </View>
                </View>
                <Pressable
                  className="active:bg-bg-card-elevated h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                  onPress={onClose}>
                  <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </Pressable>
              </View>
            </LinearGradient>

            {/* Menu Items */}
            <View className="gap-3 p-6">
              <MenuItem
                icon={<User size={theme.iconSize.md} color={theme.colors.accent.primary} />}
                label={t('userMenu.profile')}
                onPress={() => {
                  onProfilePress?.();
                  onClose();
                }}
              />
              <MenuItem
                icon={<BarChart3 size={theme.iconSize.md} color={theme.colors.accent.secondary} />}
                label={t('userMenu.progress')}
                onPress={() => {
                  onProgressPress?.();
                  onClose();
                }}
              />
              <MenuItem
                icon={<Settings size={theme.iconSize.md} color={theme.colors.text.secondary} />}
                label={t('userMenu.settings')}
                onPress={() => {
                  onSettingsPress?.();
                  onClose();
                }}
              />
              <Pressable
                className="active:bg-bg-card-elevated flex-row items-center gap-4 rounded-2xl bg-bg-overlay p-4"
                onPress={() => {
                  onDebugMenuPress?.();
                  onClose();
                }}>
                <Text className="flex-1 text-lg font-semibold text-text-primary">
                  {'Debug Page'}
                </Text>
              </Pressable>
            </View>

            {/* Top safe area spacing */}
            <View className="h-8" />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
