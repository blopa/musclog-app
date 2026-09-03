import { ChevronRight } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type NewWorkoutCardProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export function NewWorkoutCard({ icon, title, subtitle, onPress }: NewWorkoutCardProps) {
  const theme = useTheme();

  return (
    <GenericCard onPress={onPress} isPressable={true} variant="flat">
      <View
        style={{
          padding: theme.spacing.padding.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.gap.base,
        }}
      >
        <View
          style={{
            width: theme.size['12'],
            height: theme.size['12'],
            borderRadius: theme.borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.background.ink5,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.background.ink5,
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
                marginTop: theme.spacing.margin['2'],
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
      </View>
    </GenericCard>
  );
}
