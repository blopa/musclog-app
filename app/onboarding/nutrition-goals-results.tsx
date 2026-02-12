import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'hooks/useTheme';
import { Text, View } from 'react-native';

import { GenericCard } from '../../components/cards/GenericCard';
import { Button } from '../../components/theme/Button';

export default function NutritionGoalsResults() {
  const theme = useTheme();

  return (
    <View className="bg-background-dark flex-1">
      {/* Progress Steps */}
      <View className="flex-row items-center justify-center gap-2 px-6 py-6">
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            className="h-1 flex-1 rounded-full"
            style={{
              backgroundColor: theme.colors.accent.primary,
              shadowColor: theme.colors.accent.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 4,
            }}
          />
        ))}
      </View>

      {/* Main Content */}
      <View className="flex-1 flex-col items-center px-6 pb-40">
        {/* Header */}
        <View className="mb-8 items-center text-center">
          <View
            className="mb-3 flex-row items-center gap-1.5 rounded-full px-3 py-1"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <MaterialIcons name="auto-awesome" size={14} color={theme.colors.accent.primary} />
            <Text
              className="text-xs font-bold uppercase tracking-wider"
              style={{
                color: theme.colors.accent.primary,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              AI Calculation Complete
            </Text>
          </View>

          <Text
            className="mb-2 text-center text-[32px] font-bold leading-[1.1]"
            style={{
              color: theme.colors.text.primary,
              fontSize: 32,
              fontWeight: theme.typography.fontWeight.black,
            }}
          >
            Your{' '}
            <Text
              style={{
                color: theme.colors.status.indigoLight,
                fontSize: 32,
                fontWeight: theme.typography.fontWeight.black,
              }}
            >
              Nutrition Plan
            </Text>
          </Text>

          <Text
            className="max-w-[300px] text-center text-[15px] font-normal leading-relaxed"
            style={{
              color: theme.colors.text.secondary,
              fontSize: 15,
              fontWeight: theme.typography.fontWeight.normal,
            }}
          >
            Based on your body metrics and activity levels, our AI has optimized your daily targets.
          </Text>
        </View>

        {/* Daily Calorie Target Card */}
        <View
          className="relative mb-6 w-full overflow-hidden rounded-3xl p-8"
          style={{
            borderRadius: theme.borderRadius['3xl'],
            padding: theme.spacing.padding['2xl'],
            marginBottom: theme.spacing.margin.lg,
          }}
        >
          <LinearGradient
            colors={theme.colors.gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: theme.borderRadius['3xl'],
            }}
          />

          {/* Bolt Icon */}
          <View className="absolute right-0 top-0 p-4">
            <MaterialIcons
              name="bolt"
              size={96}
              color={theme.colors.text.white}
              style={{ opacity: 0.2 }}
            />
          </View>

          <View className="relative z-10">
            <Text
              className="mb-1 text-sm font-semibold uppercase tracking-widest text-white/80"
              style={{
                color: `${theme.colors.text.white}CC`,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                letterSpacing: 2,
              }}
            >
              Daily Calorie Target
            </Text>

            <View className="flex-row items-baseline gap-2">
              <Text
                className="text-5xl font-black text-white"
                style={{
                  color: theme.colors.text.white,
                  fontSize: theme.typography.fontSize['5xl'],
                  fontWeight: theme.typography.fontWeight.black,
                }}
              >
                2,150
              </Text>
              <Text
                className="text-xl font-bold text-white/90"
                style={{
                  color: `${theme.colors.text.white}E6`,
                  fontSize: theme.typography.fontSize.xl,
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                KCAL
              </Text>
            </View>

            <View
              className="mt-4 flex-row items-center justify-between border-t pt-4"
              style={{
                borderTopColor: `${theme.colors.text.white}1A`,
                borderTopWidth: 1,
                marginTop: theme.spacing.margin.md,
                paddingTop: theme.spacing.padding.md,
              }}
            >
              <Text
                className="text-xs font-medium text-white/70"
                style={{
                  color: `${theme.colors.text.white}B3`,
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                Moderate Weight Loss Strategy
              </Text>
              <View
                className="h-1.5 w-12 overflow-hidden rounded-full bg-white/30"
                style={{
                  height: 6,
                  width: 48,
                  backgroundColor: `${theme.colors.text.white}4D`,
                  borderRadius: theme.borderRadius.full,
                }}
              >
                <View
                  className="h-full bg-white"
                  style={{
                    height: '100%',
                    width: '66%',
                    backgroundColor: theme.colors.text.white,
                    borderRadius: theme.borderRadius.full,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Macros Grid */}
        <View className="mb-8 w-full flex-row gap-3">
          {/* Protein */}
          <GenericCard
            variant="default"
            size="sm"
            containerStyle={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.spacing.padding.md,
            }}
          >
            <Text
              className="mb-1 text-center text-[10px] font-bold uppercase tracking-tighter text-indigo-400"
              style={{
                color: theme.colors.status.indigo,
                fontSize: 10,
                fontWeight: theme.typography.fontWeight.bold,
                letterSpacing: -0.5,
                marginBottom: theme.spacing.margin.xs,
              }}
            >
              Protein
            </Text>
            <Text
              className="text-center text-lg font-bold leading-tight text-white"
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              161g
            </Text>
            <Text
              className="text-center text-[11px] font-medium text-slate-500"
              style={{
                color: theme.colors.text.tertiary,
                fontSize: 11,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              30%
            </Text>
          </GenericCard>

          {/* Carbs */}
          <GenericCard
            variant="default"
            size="sm"
            containerStyle={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.spacing.padding.md,
            }}
          >
            <Text
              className="text-primary mb-1 text-center text-[10px] font-bold uppercase tracking-tighter"
              style={{
                color: theme.colors.accent.primary,
                fontSize: 10,
                fontWeight: theme.typography.fontWeight.bold,
                letterSpacing: -0.5,
                marginBottom: theme.spacing.margin.xs,
              }}
            >
              Carbs
            </Text>
            <Text
              className="text-center text-lg font-bold leading-tight text-white"
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              215g
            </Text>
            <Text
              className="text-center text-[11px] font-medium text-slate-500"
              style={{
                color: theme.colors.text.tertiary,
                fontSize: 11,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              40%
            </Text>
          </GenericCard>

          {/* Fats */}
          <GenericCard
            variant="default"
            size="sm"
            containerStyle={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.spacing.padding.md,
            }}
          >
            <Text
              className="mb-1 text-center text-[10px] font-bold uppercase tracking-tighter text-pink-400"
              style={{
                color: theme.colors.status.pink500,
                fontSize: 10,
                fontWeight: theme.typography.fontWeight.bold,
                letterSpacing: -0.5,
                marginBottom: theme.spacing.margin.xs,
              }}
            >
              Fats
            </Text>
            <Text
              className="text-center text-lg font-bold leading-tight text-white"
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              72g
            </Text>
            <Text
              className="text-center text-[11px] font-medium text-slate-500"
              style={{
                color: theme.colors.text.tertiary,
                fontSize: 11,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              30%
            </Text>
          </GenericCard>
        </View>

        {/* 90-Day Projection Card */}
        <GenericCard
          variant="default"
          containerStyle={{
            width: '100%',
            borderWidth: 1,
            borderColor: `${theme.colors.accent.primary}33`,
            padding: theme.spacing.padding.lg,
          }}
        >
          <View className="mb-4 flex-row items-center gap-2">
            <MaterialIcons name="trending-down" size={18} color={theme.colors.accent.primary} />
            <Text
              className="text-sm font-bold text-white"
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              90-Day Projection
            </Text>
          </View>

          <View className="flex-col items-center justify-center py-4">
            <Text
              className="mb-1 text-xs font-medium text-slate-400"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.xxs,
                fontWeight: theme.typography.fontWeight.medium,
                marginBottom: theme.spacing.margin.xs,
              }}
            >
              Estimated Weight Loss
            </Text>
            <View className="flex-row items-baseline">
              <Text
                className="mr-2 text-4xl font-black tracking-tight text-white"
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.fontSize['4xl'],
                  fontWeight: theme.typography.fontWeight.black,
                  letterSpacing: -0.5,
                }}
              >
                -4.5
              </Text>
              <Text
                className="text-primary text-xl font-bold"
                style={{
                  color: theme.colors.accent.primary,
                  fontSize: theme.typography.fontSize.xl,
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                kg
              </Text>
            </View>
            <Text
              className="max-w-[200px] text-center text-[11px] text-slate-500"
              style={{
                color: theme.colors.text.tertiary,
                fontSize: 11,
                fontWeight: theme.typography.fontWeight.medium,
                textAlign: 'center',
                maxWidth: 200,
              }}
            >
              By tracking these goals, you are projected to hit{' '}
              <Text
                style={{
                  color: theme.colors.text.primary,
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                78.5 kg
              </Text>{' '}
              by November.
            </Text>
          </View>

          {/* Progress Chart */}
          <View className="relative mt-4 h-16 w-full flex-row items-end gap-1">
            {[80, 75, 72, 65, 60, 55, 45, 40, 35, 25].map((height, index) => (
              <View
                key={index}
                className="flex-1 rounded-t-sm"
                style={{
                  height: `${height}%`,
                  backgroundColor:
                    index >= 6
                      ? `${theme.colors.accent.primary}33`
                      : `${theme.colors.text.white}0D`,
                  borderTopWidth: index >= 6 ? 2 : 0,
                  borderTopColor: index >= 6 ? theme.colors.accent.primary : 'transparent',
                  borderTopLeftRadius: theme.borderRadius.sm,
                  borderTopRightRadius: theme.borderRadius.sm,
                }}
              />
            ))}
          </View>
        </GenericCard>
      </View>

      {/* Bottom Actions */}
      <View
        className="absolute bottom-0 left-0 w-full p-6"
        style={{
          backgroundColor: 'transparent',
          paddingTop: theme.spacing.padding['3xl'],
        }}
      >
        <Button
          label="Accept and Continue"
          variant="gradientCta"
          width="full"
          size="md"
          icon={() => (
            <MaterialIcons name="arrow-forward" size={20} color={theme.colors.text.white} />
          )}
          iconPosition="right"
          onPress={() => {
            // Handle accept action
          }}
          className="mb-4"
        />

        <Button
          label="Adjust Goals Manually"
          variant="outline"
          width="full"
          size="md"
          onPress={() => {
            // Handle manual adjustment
          }}
        />
      </View>
    </View>
  );
}
