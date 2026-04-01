import Constants from 'expo-constants';
import { ExternalLink } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { SUPPORT_PROJECT_DONATION_URL } from '../../constants/misc';
import { useTheme } from '../../hooks/useTheme';
import packageJson from '../../package.json';
import { isSupportProjectListLinkVisible } from '../../utils/supportProjectInstallSource';
import { GenericCard } from './GenericCard';

const buildNumber =
  Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? null;

interface LegalLinksCardProps {
  containerStyle?: any;
}

export function LegalLinksCard({ containerStyle }: LegalLinksCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

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

  const divider = (
    <View
      style={{
        height: theme.borderWidth.thin,
        backgroundColor: theme.colors.border.light,
        marginVertical: theme.spacing.padding.sm,
      }}
    />
  );

  const linkRowStyle = ({ pressed }: { pressed: boolean }) => [
    {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: theme.spacing.padding.md,
      paddingRight: theme.size.xl + theme.spacing.padding.sm,
      paddingHorizontal: 0,
      paddingLeft: 0,
      backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
      borderRadius: theme.borderRadius.sm,
    },
  ];

  const linkIconSlot = (
    <View
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: theme.size.xl,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      pointerEvents="none"
    >
      <ExternalLink size={theme.iconSize.lg} color={theme.colors.text.secondary} />
    </View>
  );

  const showSupportLink = supportHref !== null;

  return (
    <View style={{ marginBottom: theme.spacing.padding.sm, width: '100%', ...containerStyle }}>
      <GenericCard variant="default" size="sm" containerStyle={{ width: '100%' }}>
        <View
          style={{
            width: '100%',
            paddingHorizontal: theme.spacing.padding.base,
            paddingTop: theme.spacing.padding.sm,
            paddingBottom: theme.spacing.padding.sm,
          }}
        >
          <Pressable
            style={linkRowStyle}
            onPress={() => Linking.openURL('https://musclog.app/en-us/terms')}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.primary,
              }}
              numberOfLines={1}
            >
              {t('settings.termsOfService')}
            </Text>
            {linkIconSlot}
          </Pressable>

          {divider}

          <Pressable
            style={linkRowStyle}
            onPress={() => Linking.openURL('https://musclog.app/en-us/privacy')}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.primary,
              }}
              numberOfLines={1}
            >
              {t('settings.privacyPolicy')}
            </Text>
            {linkIconSlot}
          </Pressable>

          {showSupportLink ? (
            <>
              {divider}
              <Pressable
                style={linkRowStyle}
                onPress={() => {
                  Linking.openURL(supportHref).catch(() => {});
                }}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    color: theme.colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {t('settings.supportProject.title')}
                </Text>
                {linkIconSlot}
              </Pressable>
            </>
          ) : null}

          {divider}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: theme.spacing.padding.md,
              paddingHorizontal: 0,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.secondary,
              }}
            >
              Musclog v{packageJson.version}
              {buildNumber != null ? ` (Build ${buildNumber})` : ''}
            </Text>
          </View>
        </View>
      </GenericCard>
    </View>
  );
}
