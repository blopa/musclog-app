import { ExternalLink } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { ThirdPartyNoticesModal } from '@/components/modals/ThirdPartyNoticesModal';
import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import { SUPPORT_PROJECT_DONATION_URL } from '@/constants/misc';
import { useTheme } from '@/hooks/useTheme';
import { getAppBuildInfo } from '@/utils/appBuildInfo';
import { formatAppVersion } from '@/utils/appVersionLabel';
import { isSupportProjectListLinkVisible } from '@/utils/supportProjectInstallSource';
import { websitePageUrl } from '@/utils/websiteUrl';

const buildInfo = getAppBuildInfo();

interface LegalLinksCardProps {
  containerStyle?: StyleProp<ViewStyle>;
}

export function LegalLinksCard({ containerStyle }: LegalLinksCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [noticesVisible, setNoticesVisible] = useState(false);

  const supportHref = useMemo((): string | null => {
    if (Platform.OS === 'web') {
      return SUPPORT_PROJECT_DONATION_URL;
    }

    if (Platform.OS !== 'android') {
      return null;
    }

    try {
      const installer = DeviceInfo.getInstallerPackageNameSync();
      return isSupportProjectListLinkVisible('android', installer ?? '')
        ? SUPPORT_PROJECT_DONATION_URL
        : null;
    } catch {
      return null;
    }
  }, []);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const externalCue = <ExternalLink size={theme.iconSize.md} color={theme.colors.text.tertiary} />;

  return (
    <View style={{ width: '100%', ...containerStyle }}>
      <ListGroup footer={`Musclog v${formatAppVersion(buildInfo)}`}>
        <ListRow
          variant="grouped"
          title={t('settings.termsOfService')}
          trailing={externalCue}
          onPress={() => openLink(websitePageUrl('/terms', i18n.language))}
        />
        <ListRow
          variant="grouped"
          title={t('settings.privacyPolicy')}
          trailing={externalCue}
          onPress={() => openLink(websitePageUrl('/privacy', i18n.language))}
        />
        <ListRow
          variant="grouped"
          title={t('onDeviceAi.notices.link')}
          subtitle={t('onDeviceAi.notices.linkSubtitle')}
          onPress={() => setNoticesVisible(true)}
        />
        {supportHref !== null ? (
          <ListRow
            variant="grouped"
            title={t('settings.supportProject.title')}
            trailing={externalCue}
            onPress={() => openLink(supportHref)}
          />
        ) : null}
      </ListGroup>
      <ThirdPartyNoticesModal visible={noticesVisible} onClose={() => setNoticesVisible(false)} />
    </View>
  );
}
