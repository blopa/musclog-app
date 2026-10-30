import { Lock } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useAppLock } from '@/context/AppLockContext';
import { useTheme } from '@/hooks/useTheme';

type LockScreenProps = {
  title: string;
  description: string;
};

/**
 * Asks the device to authenticate as soon as it appears (a lock that waits for a tap is one more
 * tap every time), and keeps a button for when the prompt was dismissed.
 */
export function LockScreen({ title, description }: LockScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { unlock } = useAppLock();
  const asked = useRef(false);

  useEffect(() => {
    if (!asked.current) {
      asked.current = true;
      void unlock();
    }
  }, [unlock]);

  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-bg-overlay">
        <Lock size={28} color={theme.colors.text.secondary} />
      </View>
      <Text className="mb-2 text-center text-xl font-semibold text-text-primary">{title}</Text>
      <Text className="mb-8 text-center text-sm text-text-secondary">{description}</Text>
      <Button label={t('cycle.lock.unlock')} onPress={() => void unlock()} variant="accent" />
    </View>
  );
}
