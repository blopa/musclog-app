import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from '../cards/GenericCard';
import { Button } from './Button';

type EmptyStateCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel: string;
  onButtonPress?: () => void;
  iconGradient?: boolean;
  buttonVariant?: 'gradientCta' | 'secondary';
};

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onButtonPress,
  iconGradient = false,
  buttonVariant = 'gradientCta',
}: EmptyStateCardProps) {
  const theme = useTheme();
  return (
    <GenericCard variant="card">
      <View className="flex-col items-center gap-6 p-8">
        {/* Icon */}
        {iconGradient ? (
          <View className="h-40 w-40 items-center justify-center rounded-full">
            <LinearGradient
              colors={theme.colors.gradients.progress}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-40 w-40 items-center justify-center rounded-full overflow-hidden"
              style={{ opacity: theme.colors.opacity.strong }}
            >
              <View className="h-36 w-36 items-center justify-center rounded-full bg-white/10">
                <Icon size={theme.iconSize['6xl']} color={theme.colors.text.primary} />
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View
            className="h-40 w-40 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <Icon size={theme.iconSize['6xl']} color={theme.colors.accent.primary} />
          </View>
        )}

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
