import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppLockSettings } from '@/components/lock/AppLockSettings';

import { FullScreenModal } from './FullScreenModal';

type AppLockSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function AppLockSettingsModal({ visible, onClose }: AppLockSettingsModalProps) {
  const { t } = useTranslation();

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('lock.settings.title')}>
      <View className="gap-4 px-4 py-6">
        <AppLockSettings />
        <Text className="text-xs text-text-tertiary">{t('lock.settings.note')}</Text>
      </View>
    </FullScreenModal>
  );
}
