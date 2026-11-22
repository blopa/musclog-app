import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { LoggyPose, type LoggyPoseName, useLoggyVisible } from '@/components/LoggyPose';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { pageHeadlineDetailKeys, pageHeadlineKey, type WhatsNewFlow } from '@/utils/whatsNew/flow';

import { WhatsNewIconBadge } from './WhatsNewIconBadge';
import { whatsNewIcons } from './whatsNewIcons';
import { WhatsNewText } from './WhatsNewText';

/** Modest on purpose: an upgrade intro already runs past one screen. */
const INTRO_POSE_HEIGHT = 144;

/** A release's own intro is a banner: Loggy takes this share of the window's height... */
const RELEASE_POSE_HEIGHT_SHARE = 0.26;
/** ...within these bounds, so a short phone still fits the copy and the promises below him. */
const RELEASE_POSE_MIN_HEIGHT = 140;
const RELEASE_POSE_MAX_HEIGHT = 220;

/** The poses that can open the tour; one is picked each time it opens. */
const INTRO_POSES: readonly LoggyPoseName[] = ['pointing', 'wave', 'flex', 'default'];

function pickIntroPose(): LoggyPoseName {
  return INTRO_POSES[Math.floor(Math.random() * INTRO_POSES.length)];
}

/**
 * The tour's first page. It is centred in the space the footer leaves, leads with Loggy in a random pose and
 * larger type than the pages after it, and — for an upgrade — lists what the pages cover, so the
 * person knows what the tour holds before choosing to take it or skip it.
 */
export function WhatsNewIntro({
  flow,
  showHighlights,
}: {
  flow: WhatsNewFlow;
  showHighlights: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  // Lazy initial state: picked once per mount, so a re-render never swaps the pose under the reader.
  const [pose] = useState(pickIntroPose);
  const { intro } = flow;
  // A release that brings its own intro already says what its pages are about; the list is kept
  // only when the tour also carries pages from older releases the banner does not mention.
  const listPages = showHighlights && (!intro || flow.releaseVersions.length > 1);
  const headlines = listPages
    ? flow.pages.flatMap((page) => {
        const key = pageHeadlineKey(page);
        return key ? [{ id: page.key, key, detailKeys: pageHeadlineDetailKeys(page) }] : [];
      })
    : [];

  return (
    <View className="flex-1 justify-center gap-6 py-6">
      {intro ? (
        <ReleaseIntro intro={intro} />
      ) : (
        <View className="items-center gap-5">
          {/* Loggy opens the tour, and only the first page: every later page keeps its own icon. */}
          <LoggyPose pose={pose} height={INTRO_POSE_HEIGHT} />
          <WhatsNewText
            accessibilityRole="header"
            size={36}
            minSize={28}
            className="text-center text-4xl font-bold text-text-primary"
          >
            {t('whatsNew.intro.title')}
          </WhatsNewText>
          <WhatsNewText
            size={18}
            minSize={16}
            className="text-center text-lg leading-7 text-text-secondary"
          >
            {t('whatsNew.intro.description')}
          </WhatsNewText>
          {showHighlights && flow.truncated ? (
            <Text className="text-center text-sm text-text-secondary">
              {t('whatsNew.intro.truncated')}
            </Text>
          ) : null}
        </View>
      )}

      {headlines.length > 0 ? (
        <View className="gap-3 rounded-card bg-bg-overlay p-4">
          <Text className="text-xs font-semibold text-text-secondary">
            {t('whatsNew.intro.inside')}
          </Text>
          {headlines.map((headline, index) => (
            <View key={headline.id} className="flex-row items-start gap-3">
              <View
                className="items-center justify-center rounded-full bg-accent-primary/15"
                style={{ width: theme.iconSize['2xl'], height: theme.iconSize['2xl'] }}
              >
                <Text className="text-sm font-semibold text-accent-primary">
                  {formatInteger(index + 1)}
                </Text>
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <WhatsNewText
                  size={16}
                  minSize={14}
                  className="text-base font-semibold text-text-primary"
                >
                  {t(headline.key)}
                </WhatsNewText>
                {headline.detailKeys.length > 0 ? (
                  <WhatsNewText size={14} minSize={12} className="text-sm text-text-secondary">
                    {headline.detailKeys.map((key) => t(key)).join(' · ')}
                  </WhatsNewText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The first page a release wrote for itself: a banner rather than a table of contents, with a
 * big Loggy, a bold headline and its promises as large filled rows. With "Show Loggy" off the
 * heart badge stands in, so the page never opens on a gap.
 */
function ReleaseIntro({ intro }: { intro: NonNullable<WhatsNewFlow['intro']> }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const loggyVisible = useLoggyVisible();
  const { height: windowHeight } = useWindowDimensions();
  const poseHeight = Math.round(
    Math.min(
      RELEASE_POSE_MAX_HEIGHT,
      Math.max(RELEASE_POSE_MIN_HEIGHT, windowHeight * RELEASE_POSE_HEIGHT_SHARE)
    )
  );

  return (
    <View className="gap-6">
      <View className="items-center gap-5">
        {intro.pose && loggyVisible ? (
          <LoggyPose pose={intro.pose} height={poseHeight} />
        ) : (
          <WhatsNewIconBadge icon={Heart} />
        )}
        <WhatsNewText
          accessibilityRole="header"
          size={40}
          minSize={30}
          className="text-center text-4xl font-bold text-text-primary"
        >
          {t(intro.titleKey)}
        </WhatsNewText>
        {intro.descriptionKey ? (
          <WhatsNewText
            size={18}
            minSize={16}
            className="text-center text-lg leading-7 text-text-secondary"
          >
            {t(intro.descriptionKey)}
          </WhatsNewText>
        ) : null}
      </View>
      {intro.items?.length ? (
        <View className="gap-3">
          {intro.items.map((item) => {
            const Icon = whatsNewIcons[item.icon];
            return (
              <View
                key={item.id}
                className="flex-row items-center gap-4 rounded-card bg-accent-primary/10 px-4 py-4"
              >
                <View
                  className="items-center justify-center rounded-full bg-accent-primary"
                  style={{ width: theme.iconSize['3xl'], height: theme.iconSize['3xl'] }}
                >
                  <Icon size={theme.iconSize.md} color={theme.colors.text.onAccent} />
                </View>
                <WhatsNewText
                  size={17}
                  minSize={15}
                  className="min-w-0 flex-1 text-base font-semibold text-text-primary"
                >
                  {t(item.labelKey)}
                </WhatsNewText>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
