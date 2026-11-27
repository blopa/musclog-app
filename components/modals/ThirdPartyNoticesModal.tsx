import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { TextButton } from '@/components/theme/TextButton';
import openSourceNotices from '@/data/openSourceNotices.json';
import notices from '@/data/thirdPartyNotices.json';
import { useTheme } from '@/hooks/useTheme';

type ThirdPartyNotice = (typeof notices)[number];

// One string for every package line keeps the list cheap to render.
const packageLines = openSourceNotices.packages
  .map((pkg) => [pkg.name, pkg.version, pkg.license, pkg.copyright].filter(Boolean).join(' · '))
  .join('\n');

// Apache-2.0 packages that ship a NOTICE file must reproduce it.
const packageNotices = openSourceNotices.packages
  .filter((pkg) => pkg.notice)
  .map((pkg) => `${pkg.name} ${pkg.version}\n${pkg.notice}`)
  .join('\n\n');

type ThirdPartyNoticesModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ThirdPartyNoticesModal({ visible, onClose }: ThirdPartyNoticesModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const openLicense = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('onDeviceAi.notices.title')}
      footer={null}
    >
      <View style={{ padding: theme.spacing.padding.lg, gap: 24 }}>
        <Text className="text-sm leading-relaxed text-text-secondary">
          {t('onDeviceAi.notices.intro')}
        </Text>
        {notices.map((notice: ThirdPartyNotice) => (
          <View key={notice.id} className="gap-2">
            <Text className="text-base font-semibold text-text-primary">{notice.name}</Text>
            <Text className="text-sm text-text-secondary">{notice.license}</Text>
            {notice.copyright ? (
              <Text className="text-sm text-text-secondary">{notice.copyright}</Text>
            ) : null}
            <TextButton
              label={t('onDeviceAi.notices.openLink')}
              tone="accent"
              align="start"
              onPress={() => openLicense(notice.licenseUrl)}
            />
            {notice.text ? (
              <Text className="text-xs leading-relaxed text-text-tertiary">{notice.text}</Text>
            ) : null}
          </View>
        ))}
        <View className="gap-2">
          <Text className="text-base font-semibold text-text-primary">
            {t('onDeviceAi.notices.packagesTitle')}
          </Text>
          <Text className="text-xs leading-relaxed text-text-tertiary">{packageLines}</Text>
        </View>
        {packageNotices ? (
          <View className="gap-2">
            <Text className="text-xs leading-relaxed text-text-tertiary">{packageNotices}</Text>
          </View>
        ) : null}
        {Object.entries(openSourceNotices.texts).map(([id, text]) => (
          <View key={id} className="gap-2">
            <Text className="text-base font-semibold text-text-primary">{id}</Text>
            <Text className="text-xs leading-relaxed text-text-tertiary">{text}</Text>
          </View>
        ))}
      </View>
    </FullScreenModal>
  );
}
