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
  buttonVariant?: 'gradientCta' | 'secondary';
};

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onButtonPress,
  buttonVariant = 'gradientCta',
}: EmptyStateCardProps) {
  const theme = useTheme();
  return (
    <GenericCard variant="flat">
      <View className="flex-col items-center gap-6 p-8">
        {/* Icon */}
        <View
          className="h-40 w-40 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.colors.accent.primary10 }}
        >
          <Icon size={theme.iconSize['6xl']} color={theme.colors.accent.primary} />
        </View>

        {/* Content */}
        <View className="flex-col items-center gap-2" style={{ maxWidth: theme.maxWidth['480'] }}>
          <Text className="text-center text-xl font-bold leading-tight tracking-tight text-text-primary">
            {title}
          </Text>
          <Text className="text-center text-sm font-normal leading-relaxed text-text-secondary">
            {description}
          </Text>
        </View>

        {/* Button */}
        <Button
          label={buttonLabel}
          variant={buttonVariant}
          width="full"
          onPress={onButtonPress}
          size="md"
        />
      </View>
    </GenericCard>
  );
}
