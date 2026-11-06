import { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { LoggyPose, type LoggyPoseName } from '@/components/LoggyPose';
import { useTheme } from '@/hooks/useTheme';

import { Button } from './Button';

const EMPTY_POSE_HEIGHT = 168;

type EmptyStateCardBaseProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel: string;
  onButtonPress?: () => void;
  /**
   * `secondary` by default. Pass `gradientCta` only when the empty state is the screen and its
   * button is that screen's one primary action (an empty Notes screen, an empty workout library).
   */
  buttonVariant?: 'gradientCta' | 'secondary';
};

/**
 * `bare` drops the card surface. Use it when the empty state IS the whole screen: a card around
 * the only thing on the page is a container with nothing to separate it from. Only that form can
 * take a `pose`: Loggy stands in for the icon on a screen that has nothing else on it yet, and
 * leaves on his own because the empty state unmounts once there is content. An empty list inside a
 * card keeps its plain icon, so the type refuses a pose there.
 */
type EmptyStateCardProps = EmptyStateCardBaseProps &
  ({ bare: true; pose?: LoggyPoseName } | { bare?: false; pose?: never });

/**
 * What a list shows before it has anything in it: a plain icon (or, on a whole-screen first use,
 * Loggy), one line saying what belongs here, one line on how to add it, and the button that does.
 * The icon used to sit in a 160px tinted circle over a gradient button, the template every
 * generated empty state shares.
 */
export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onButtonPress,
  buttonVariant = 'secondary',
  bare = false,
  pose,
}: EmptyStateCardProps) {
  const theme = useTheme();
  const content = (
    <View className={`flex-col items-center gap-4 ${bare ? 'py-8' : 'p-6'}`}>
      {pose ? (
        <LoggyPose pose={pose} height={EMPTY_POSE_HEIGHT} />
      ) : (
        <Icon size={theme.iconSize['5xl']} color={theme.colors.text.tertiary} />
      )}

      <View className="flex-col items-center gap-2" style={{ maxWidth: theme.maxWidth['480'] }}>
        <Text className="text-center text-lg font-semibold leading-tight text-text-primary">
          {title}
        </Text>
        <Text className="text-center text-sm font-normal leading-relaxed text-text-secondary">
          {description}
        </Text>
      </View>

      <Button
        label={buttonLabel}
        variant={buttonVariant}
        width="full"
        onPress={onButtonPress}
        size="md"
      />
    </View>
  );

  if (bare) {
    return content;
  }

  return <GenericCard variant="flat">{content}</GenericCard>;
}
