import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { WHATS_NEW_SEEN_THROUGH_KEY } from '@/constants/whatsNew';
import { whatsNewReleases } from '@/data/whatsNew/releases';
import { resetWhatsNewAutoFlowSession } from '@/hooks/useWhatsNewAutoFlow';
import { getAppVersion } from '@/utils/appVersion';
import { selectReplayFlow, type WhatsNewFlow } from '@/utils/whatsNew/flow';
import { getWhatsNewSeenThrough, whatsNewSeenEntry } from '@/utils/whatsNew/storage';
import { parseVersion } from '@/utils/whatsNew/version';

import { WhatsNewModal } from './WhatsNewModal';

export function WhatsNewDebugSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const [seen, setSeen] = useState<string | null>(null);
  const [version, setVersion] = useState(getAppVersion);
  const [preview, setPreview] = useState<WhatsNewFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void getWhatsNewSeenThrough()
      .then(setSeen)
      .catch(() => setError('whatsNew.loadFailed'));
  }, []);
  const editRecord = async (clear: boolean) => {
    if (!clear && !parseVersion(version)) {
      setError('whatsNew.debug.invalid');
      return;
    }

    try {
      if (clear) {
        await AsyncStorage.removeItem(WHATS_NEW_SEEN_THROUGH_KEY);
      } else {
        await AsyncStorage.setItem(...whatsNewSeenEntry(version));
      }

      resetWhatsNewAutoFlowSession();
      setSeen(await getWhatsNewSeenThrough());
      setError(null);
    } catch {
      setError('whatsNew.saveFailed');
    }
  };

  return (
    <View className="gap-3 rounded-xl border border-border-light bg-bg-card p-4">
      <Text accessibilityRole="header" className="text-xl font-bold text-text-primary">
        {t('whatsNew.debug.title')}
      </Text>
      <Text className="text-sm text-text-secondary">
        {t('whatsNew.debug.record', { version: seen ?? t('whatsNew.debug.none') })}
      </Text>
      <Button
        variant="outline"
        label={t('whatsNew.debug.clear')}
        onPress={() => void editRecord(true)}
      />
      <TextInput value={version} onChangeText={setVersion} label={t('whatsNew.debug.version')} />
      <Button
        variant="outline"
        label={t('whatsNew.debug.set')}
        onPress={() => void editRecord(false)}
      />
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-status-error">
          {t(error)}
        </Text>
      ) : null}
      {whatsNewReleases.map((release) => (
        <Button
          key={release.version}
          label={t('whatsNew.debug.preview', { version: release.version })}
          onPress={() =>
            setPreview(selectReplayFlow({
                releases: [release],
                currentVersion: release.version,
                context: { cycleTracking: true },
              }))
          }
        />
      ))}
      {preview ? (
        <WhatsNewModal
          visible
          flow={preview}
          mode="replay"
          onDismiss={() => setPreview(null)}
          onNavigate={(route) => router.navigate(route)}
        />
      ) : null}
    </View>
  );
}
