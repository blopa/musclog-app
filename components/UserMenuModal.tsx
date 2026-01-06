import { View, Text, Pressable, Modal, Image, ImageSourcePropType } from 'react-native';
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
}: UserMenuModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <Pressable className="flex-1 bg-black/60" onPress={onClose}>
        <View className="flex-1 justify-start">
          {/* Modal Content */}
          <View className="rounded-b-3xl border-b border-border-dark bg-bg-card">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border-dark p-6">
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
                icon={<Settings size={theme.iconSize.md} color={theme.colors.text.secondary} />}
                label={t('userMenu.settings')}
                onPress={() => {
                  onSettingsPress?.();
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
            </View>

            {/* Top safe area spacing */}
            <View className="h-8" />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
