import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { LoggyPose, type LoggyPoseName, useLoggyVisible } from '@/components/LoggyPose';
import { YEAR_STORY_ART } from '@/components/yearInReview/yearStoryArt';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { POSTER_GROUNDS, type PosterGround } from '@/constants/loggyPalette';
import type { Units } from '@/constants/settings';
import { getWeightUnitI18nKey } from '@/utils/units';
import type { YearStoryCard } from '@/utils/yearInReview/storyCards';
import { fitFontSize, storyScale } from '@/utils/yearInReview/storyLayout';
import type { YearInReview } from '@/utils/yearInReview/types';

export const POSTER_PADDING = 24;
const HERO_SIZE = 132;
/** The free column beside the mascot, as a share of the poster's width. */
const BESIDE_LOGGY_SHARE = 0.38;
/** How far the mascot hangs past the poster's edge, so it stands in the frame, not on a shelf. */
const POSE_BLEED_RIGHT = 12;
const POSE_BLEED_BOTTOM = 4;

export type PosterSize = { width: number; height: number };

/** What a poster's children read instead of being handed it: one card's ground, pose and room. */
type PosterLayout = {
  ground: PosterGround;
  pose: LoggyPoseName | null;
  poseShare: number;
  size: PosterSize;
  /** The sizes drawn for a 600pt poster, scaled to this one. */
  scale: number;
  /** The width inside the poster's padding. */
  innerWidth: number;
};

const PosterLayoutContext = createContext<PosterLayout | null>(null);

/** Gives every poster component below it the layout of `kind` at `size`. */
export function PosterScope({
  kind,
  size,
  children,
}: {
  kind: YearStoryCard['kind'];
  size: PosterSize;
  children: ReactNode;
}) {
  const { width, height } = size;
  const layout = useMemo((): PosterLayout => {
    const { ground, pose, poseShare } = YEAR_STORY_ART[kind];

    return {
      ground: POSTER_GROUNDS[ground],
      pose,
      poseShare,
      size: { width, height },
      scale: storyScale(height),
      innerWidth: width - POSTER_PADDING * 2,
    };
  }, [kind, width, height]);

  return <PosterLayoutContext.Provider value={layout}>{children}</PosterLayoutContext.Provider>;
}

export function usePoster(): PosterLayout {
  const layout = useContext(PosterLayoutContext);
  if (!layout) {
    throw new Error('A poster component was rendered outside a PosterScope.');
  }

  return layout;
}

/** What every poster of the story reads besides its card: the review and how to write it. */
export type PosterData = {
  review: YearInReview;
  units: Units;
  /** BCP 47 tag for month names, from the app language. */
  locale: string;
};

export type PosterCardProps<K extends YearStoryCard['kind']> = PosterData & {
  card: Extract<YearStoryCard, { kind: K }>;
};

/** The translated weight unit ("kg", "lbs") of the account. */
export function useWeightUnitLabel(units: Units): string {
  const { t } = useTranslation();
  return t(getWeightUnitI18nKey(units));
}

/**
 * The style that keeps text off the mascot: a column of `share` of the poster beside him, or the
 * full width when he is hidden or the poster has no pose.
 */
export function useLoggyColumn(share = BESIDE_LOGGY_SHARE): ViewStyle | undefined {
  const { pose, size } = usePoster();
  const showLoggy = useLoggyVisible();

  return pose && showLoggy ? { maxWidth: size.width * share } : undefined;
}

/** One page of the story: a flat ground, a title, the content, and Loggy standing in the corner. */
export function Poster({ title, children }: { title: string; children: ReactNode }) {
  const { ground, pose, poseShare, size, scale } = usePoster();
  const showLoggy = useLoggyVisible();

  return (
    <View className="flex-1 overflow-hidden" style={{ backgroundColor: ground.background }}>
      {pose && showLoggy ? (
        <Animated.View
          entering={FadeInDown.duration(360)}
          pointerEvents="none"
          style={{ bottom: -POSE_BLEED_BOTTOM, position: 'absolute', right: -POSE_BLEED_RIGHT }}
        >
          <LoggyPose pose={pose} height={size.height * poseShare} />
        </Animated.View>
      ) : null}
      {/* A style, not a class: NativeWind does not reach reanimated's Animated.View. */}
      <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1, padding: POSTER_PADDING }}>
        <Text
          accessibilityRole="header"
          className="font-semibold"
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          style={{ color: ground.ink, fontSize: 22 * scale }}
        >
          {title}
        </Text>
        {children}
      </Animated.View>
    </View>
  );
}

type HeroProps = {
  value: string;
  caption?: string;
  /** Cap for a word rather than a number ("September"). */
  maxSize?: number;
};

/** The one number a poster exists to show. */
export function Hero({ value, caption, maxSize = HERO_SIZE }: HeroProps) {
  const { ground, scale, innerWidth } = usePoster();
  const fontSize = fitFontSize(value, innerWidth, maxSize * scale);

  return (
    <View className="mt-2">
      <Text
        allowFontScaling={false}
        className="font-bold tabular-nums"
        numberOfLines={1}
        style={{ color: ground.ink, fontSize, lineHeight: fontSize * 1.12 }}
      >
        {value}
      </Text>
      {caption ? (
        <Text
          className="font-medium"
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          style={{ color: ground.ink, fontSize: 24 * scale, lineHeight: 30 * scale }}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** A supporting figure in the free corner beside Loggy. */
export function SideStat({ value, label }: { value: string; label: string }) {
  const { ground, scale, size } = usePoster();
  const fontSize = fitFontSize(value, size.width * BESIDE_LOGGY_SHARE, 56 * scale);

  return (
    <View>
      <Text
        allowFontScaling={false}
        className="font-bold tabular-nums"
        numberOfLines={1}
        style={{ color: ground.ink, fontSize, lineHeight: fontSize * 1.15 }}
      >
        {value}
      </Text>
      <Text
        className="font-medium"
        maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
        style={{ color: ground.ink, fontSize: 18 * scale, lineHeight: 23 * scale }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Keeps text off the mascot: the bottom-left column beside him (the full width when he is hidden). */
export function BesideLoggy({ children }: { children: ReactNode }) {
  return (
    <View className="mt-auto gap-4" style={useLoggyColumn()}>
      {children}
    </View>
  );
}

type BodyTextProps = {
  children: ReactNode;
  /** Spacing from the content above, as classes (`mt-3`). */
  className?: string;
  /** At design scale. */
  fontSize?: number;
  semibold?: boolean;
  style?: ViewStyle;
};

/** The sentence under a poster's figure. */
export function BodyText({
  children,
  className = '',
  fontSize = 20,
  semibold = false,
  style,
}: BodyTextProps) {
  const { ground, scale } = usePoster();
  const weight = semibold ? 'font-semibold' : 'font-medium';

  return (
    <Text
      className={`${weight} ${className}`}
      maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
      style={{
        color: ground.ink,
        fontSize: fontSize * scale,
        lineHeight: Math.round(fontSize * 1.3) * scale,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}
