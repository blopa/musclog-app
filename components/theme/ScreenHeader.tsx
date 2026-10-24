import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import type { AppLockArea, NavItemKey } from '@/constants/settings';
import { useAppLock } from '@/context/AppLockContext';
import { useNavigationItems } from '@/hooks/useNavigationItems';
import { useTheme } from '@/hooks/useTheme';

import { IconButton } from './IconButton';
import { navigateBack, resolveScreenHeaderForm } from './screenHeaderForm';

type ScreenHeaderProps = {
  /** What this screen is. Always required: it is the screen-reader heading even when `center` replaces it visually. */
  title: string;
  /** One line under the title: where in the screen's content you are (a phase, a week). */
  subtitle?: ReactNode;
  /**
   * The navigation destination this screen is, for screens that show the bottom bar. While it is
   * one of the bar's slots the header is `root`; otherwise it is `pushed` and shows a back button.
   * Omit it on screens that hide the bar: they are always pushed.
   */
  destination?: NavItemKey;
  /** Trailing icon actions (`IconButton`, `MenuButton`). */
  actions?: ReactNode;
  /** Replaces the visible title with a control that already says where you are (Food's day navigator). */
  center?: ReactNode;
  /**
   * The area(s) the screen's `AreaLockGate` holds. The header sits outside the gate, so the way
   * back stays usable behind the lock; while it is locked the header shows only the title and the
   * back button. `subtitle` describes the gated records (Cycle's phase) and `actions` and `center`
   * would open sheets the gate does not render.
   */
  lockArea?: AppLockArea | readonly AppLockArea[];
  testID?: string;
};

/**
 * The one screen header. Every screen shows what it is, and how to get back when it was reached
 * from somewhere, in the same place and the same style: `root` (a large title, for a screen that is
 * a bottom-bar tab right now) or `pushed` (a back button and a smaller title). It sits above the
 * screen's scroll view, so the way back never scrolls away, and inside `MasterLayout`, which owns
 * the top safe-area inset.
 */
export function ScreenHeader({
  title,
  subtitle: subtitleProp,
  destination,
  actions: actionsProp,
  center: centerProp,
  lockArea,
  testID,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { rawSlots } = useNavigationItems();
  const { isLocked } = useAppLock();
  const form = resolveScreenHeaderForm(destination, rawSlots);
  const pushed = form === 'pushed';
  const lockedAreas: readonly AppLockArea[] =
    typeof lockArea === 'string' ? [lockArea] : (lockArea ?? []);
  const locked = lockedAreas.some((area) => isLocked(area));
  const subtitle = locked ? null : subtitleProp;
  const actions = locked ? null : actionsProp;
  const center = locked ? null : centerProp;

  return (
    <View
      className={`min-h-16 flex-row items-center gap-2 border-b border-border-light bg-bg-primary py-2 ${pushed ? 'pl-2 pr-4' : 'px-4'}`}
      testID={testID}
    >
      {pushed ? (
        <IconButton
          icon={ArrowLeft}
          variant="ghost"
          accessibilityLabel={t('common.back')}
          onPress={() => navigateBack(router)}
          testID="screen-header-back"
        />
      ) : null}
      {center ? (
        <>
          {/* The title is still the screen's heading for a screen reader; the control shows it. */}
          <Text accessibilityRole="header" className="absolute h-px w-px opacity-0">
            {title}
          </Text>
          <View className="min-w-0 flex-1">{center}</View>
        </>
      ) : (
        <View className="min-w-0 flex-1 py-1">
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            className={pushed ? 'text-xl font-bold' : 'text-3xl font-bold'}
            style={{ color: theme.colors.text.primary }}
          >
            {title}
          </Text>
          {typeof subtitle === 'string' ? (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
              className="mt-0.5 text-sm text-text-secondary"
            >
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
        </View>
      )}
      {actions ? <View className="flex-row items-center gap-1">{actions}</View> : null}
    </View>
  );
}
