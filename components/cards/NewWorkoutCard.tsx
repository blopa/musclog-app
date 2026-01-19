import { View, Text } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

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
  const { t } = useTranslation();
  const isPopular = variant === 'popular';

  return (
    <GenericCard isPopular={isPopular} onPress={onPress} isPressable={true} variant="highlighted">
      <View
        style={[
          { padding: theme.spacing.padding.lg },
          isPopular
            ? {
                backgroundColor: theme.colors.background.aiCardBackground,
                borderRadius: theme.borderRadius.xl - theme.spacing.padding.xs,
              }
            : {
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.gap.base,
              },
        ]}
      >
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
          }
        >
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
            ]}
          >
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
                }}
              >
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
                paddingVertical: theme.spacing.padding.xsHalf,
                borderRadius: theme.borderRadius.sm,
              }}
            >
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.accent.secondary,
                  textTransform: 'uppercase',
                  letterSpacing: theme.typography.letterSpacing.wider,
                }}
              >
                {t('common.popular')}
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
            }}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
                marginTop: isPopular ? theme.spacing.margin.xs : theme.spacing.margin['2'],
                lineHeight: isPopular ? theme.typography.fontSize.base : undefined,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {!isPopular && <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
      </View>
    </GenericCard>
  );
}
