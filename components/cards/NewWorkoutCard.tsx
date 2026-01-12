import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type NewWorkoutCardProps = {
  variant?: 'default' | 'popular';
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export function NewWorkoutCard({
  variant = 'default',
  icon,
  title,
  subtitle,
  onPress,
}: NewWorkoutCardProps) {
  const isPopular = variant === 'popular';

  const content = (
    <View
      style={[
        { padding: theme.spacing.padding.lg },
        isPopular
          ? {
              backgroundColor: theme.colors.background.aiCardBackground,
              borderRadius: theme.borderRadius.xl - 2,
            }
          : {
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.gap.base,
            },
      ]}>
      <View
        style={
          isPopular
            ? {
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: theme.spacing.padding.sm,
              }
            : null
        }>
        <View
          style={[
            {
              width: isPopular ? theme.size['10'] : theme.size['12'],
              height: isPopular ? theme.size['10'] : theme.size['12'],
              borderRadius: theme.borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
            },
            !isPopular && {
              backgroundColor: theme.colors.background.white5,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.background.white5,
            },
          ]}>
          {isPopular ? (
            <LinearGradient
              colors={theme.colors.gradients.cta}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: theme.borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.shadows.accent,
              }}>
              {icon}
            </LinearGradient>
          ) : (
            icon
          )}
        </View>

        {isPopular && (
          <View
            style={{
              backgroundColor: theme.colors.background.white10,
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: 2,
              borderRadius: theme.borderRadius.sm,
            }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize['10'],
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.secondary,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
              Popular
            </Text>
          </View>
        )}
      </View>
      <View style={!isPopular ? { flex: 1 } : null}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.white,
          }}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.secondary,
              marginTop: isPopular ? 4 : 2,
              lineHeight: isPopular ? 16 : undefined,
            }}>
            {subtitle}
          </Text>
        )}
      </View>

      {!isPopular && <ChevronRight size={20} color={theme.colors.text.tertiary} />}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: '100%',
          borderRadius: theme.borderRadius.xl,
          overflow: 'hidden',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        !isPopular && {
          backgroundColor: pressed
            ? theme.colors.background.cardDark
            : theme.colors.background.cardElevated,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.background.white5,
          ...theme.shadows.md,
        },
      ]}>
      {isPopular ? (
        <LinearGradient
          colors={theme.colors.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 2 }}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}
