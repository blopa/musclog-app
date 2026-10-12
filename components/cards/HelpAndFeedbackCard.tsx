import { Bug, Lightbulb, Mail, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { DISCORD_INVITE_URL } from '@/constants/misc';
import { useSnackbar } from '@/context/SnackbarContext';
import { useTheme } from '@/hooks/useTheme';
import { getAppBuildInfo } from '@/utils/appBuildInfo';
import { buildIssueUrl, buildSupportMailto, type FeedbackEnvironment } from '@/utils/feedbackLinks';

import { SettingsCard } from './SettingsCard';

/**
 * One place to report a bug, ask for a feature, join the community or email support. Every route
 * is a link the user's own browser or mail app opens with the version, platform and language
 * pre-filled — nothing is sent from here, and nothing about the person is included.
 */
export function HelpAndFeedbackCard() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const open = (url: string) => {
    Linking.openURL(url).catch(() =>
      showSnackbar('error', t('settings.helpAndFeedback.openFailed'))
    );
  };
  const environment = (): FeedbackEnvironment => ({
    ...getAppBuildInfo(),
    locale: i18n.resolvedLanguage ?? i18n.language,
  });

  const item = (
    icon: BottomPopUpMenuItem['icon'],
    title: string,
    description: string,
    onPress: () => void
  ): BottomPopUpMenuItem => ({
    icon,
    iconColor: theme.colors.accent.primary,
    iconBgColor: theme.colors.accent.primary20,
    title,
    description,
    onPress,
  });

  const discordUrl = DISCORD_INVITE_URL;
  const items: BottomPopUpMenuItem[] = [
    item(
      Bug,
      t('settings.helpAndFeedback.reportBug'),
      t('settings.helpAndFeedback.githubHint'),
      () => open(buildIssueUrl('bug', environment()))
    ),
    item(
      Lightbulb,
      t('settings.helpAndFeedback.requestFeature'),
      t('settings.helpAndFeedback.githubHint'),
      () => open(buildIssueUrl('feature', environment()))
    ),
    // No community server yet: the item simply does not exist until there is an invite.
    ...(discordUrl
      ? [
          item(
            MessageCircle,
            t('settings.helpAndFeedback.community'),
            t('settings.helpAndFeedback.communityHint'),
            () => open(discordUrl)
          ),
        ]
      : []),
    item(Mail, t('settings.helpAndFeedback.email'), t('settings.helpAndFeedback.emailHint'), () =>
      open(buildSupportMailto(environment()))
    ),
  ];

  return (
    <>
      <SettingsCard
        icon={<MessageCircle size={theme.iconSize['2xl']} color={theme.colors.accent.primary} />}
        title={t('settings.helpAndFeedback.title')}
        subtitle={t('settings.helpAndFeedback.subtitle')}
        onPress={() => setIsMenuVisible(true)}
      />
      <BottomPopUpMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        title={t('settings.helpAndFeedback.title')}
        items={items}
      />
    </>
  );
}
