import { useRouter } from 'expo-router';
import { Megaphone } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMenstrualCycleContext } from '@/components/MenstrualCycleContext';
import { WhatsNewModal } from '@/components/whatsNew/WhatsNewModal';
import { whatsNewReleases } from '@/data/whatsNew/releases';
import { useTheme } from '@/hooks/useTheme';
import { getAppVersion } from '@/utils/appVersion';
import { selectReplayFlow } from '@/utils/whatsNew/flow';

import { SettingsCard } from './SettingsCard';

export function WhatsNewCard() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const { isActive: cycleTracking } = useMenstrualCycleContext();
  const flow = useMemo(
    () =>
      selectReplayFlow({
        releases: whatsNewReleases,
        currentVersion: getAppVersion(),
        context: { cycleTracking },
      }),
    [cycleTracking]
  );
  if (!flow.pages.length) {
    return null;
  }

  return (
    <>
      <SettingsCard
        icon={<Megaphone size={theme.iconSize['2xl']} color={theme.colors.accent.primary} />}
        title={t('whatsNew.settingsCard.title')}
        subtitle={t('whatsNew.settingsCard.subtitle')}
        onPress={() => setVisible(true)}
      />
      <WhatsNewModal
        visible={visible}
        flow={flow}
        mode="replay"
        onDismiss={() => setVisible(false)}
        onNavigate={(route) => router.navigate(route)}
      />
    </>
  );
}
