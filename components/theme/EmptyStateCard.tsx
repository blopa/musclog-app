import { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { useTheme } from '@/hooks/useTheme';

import { Button } from './Button';

type EmptyStateCardProps = {
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
  /**
   * Drop the card surface. Use it when the empty state IS the whole screen: a card around the only
   * thing on the page is a container with nothing to separate it from.
   */
  bare?: boolean;
};

/**
 * What a list shows before it has anything in it: a plain icon, one line saying what belongs here,
 * one line on how to add it, and the button that does. The icon used to sit in a 160px tinted
 * circle over a gradient button, the template every generated empty state shares.
 */
export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onButtonPress,
  buttonVariant = 'secondary',
  bare = false,
}: EmptyStateCardProps) {
  const theme = useTheme();
  const content = (
    <View className={`flex-col items-center gap-4 ${bare ? 'py-8' : 'p-6'}`}>
      <Icon size={theme.iconSize['5xl']} color={theme.colors.text.tertiary} />

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
