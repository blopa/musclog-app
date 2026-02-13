import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'hooks/useTheme';
import { ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { Button } from '../../components/theme/Button';

export default function SetGoals() {
  const theme = useTheme();

  return (
    <View className="bg-background-dark flex-1">
      {/* Main Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.padding['4xl'] }}
      >
        <View className="gap-2 px-6 py-6" />
        <View className="flex-col items-center px-6 pb-48">
          {/* Orbital Animation Area */}
          <View className="relative mb-2 mt-2 aspect-square w-full items-center justify-center">
            {/* Background Blurs */}
            <View
              className="absolute h-64 w-64 rounded-full"
              style={{
                backgroundColor: `${theme.colors.status.indigo}33`,
                width: 256,
                height: 256,
                borderRadius: 128,
              }}
            />
            <View
              className="absolute h-64 w-64 rounded-full"
              style={{
                backgroundColor: `${theme.colors.accent.primary}33`,
                width: 256,
                height: 256,
                transform: [{ translateX: 48 }],
                borderRadius: 128,
              }}
            />

            {/* Orbit Paths */}
            <View
              className="absolute rounded-full border"
              style={{
                width: 280,
                height: 280,
                borderColor: `${theme.colors.text.white}0D`,
                transform: [{ rotate: '-15deg' }],
              }}
            />
            <View
              className="absolute rounded-full border"
              style={{
                width: 220,
                height: 220,
                borderColor: `${theme.colors.text.white}0D`,
                transform: [{ rotate: '10deg' }],
              }}
            />

            {/* Central Icon */}
            <View className="relative z-20 h-32 w-32 items-center justify-center">
              <View
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundColor: `${theme.colors.accent.primary}33`,
                  opacity: 0.2,
                  borderRadius: 64,
                }}
              />
              <View
                className="relative h-24 w-24 items-center justify-center rounded-3xl"
                style={{
                  borderRadius: theme.borderRadius['3xl'],
                  shadowColor: theme.colors.status.indigo,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.4,
                  shadowRadius: 40,
                  elevation: 5,
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
                <MaterialIcons
                  name="auto-awesome"
                  size={56}
                  color={theme.colors.text.white}
                  style={{ position: 'relative', zIndex: 1 }}
                />
              </View>
            </View>

            {/* Floating Nodes */}
            {/* KCAL Node */}
            <View
              className="absolute left-[10%] top-[15%] z-30 h-16 w-16 flex-col items-center justify-center rounded-2xl"
              style={{
                top: '15%',
                left: '10%',
                backgroundColor: `${theme.colors.text.white}0D`,
                borderColor: `${theme.colors.text.white}1A`,
                borderWidth: 1,
                borderRadius: theme.borderRadius['2xl'],
                shadowColor: theme.colors.text.black,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 32,
                elevation: 5,
              }}
            >
              <MaterialIcons
                name="local-fire-department"
                size={24}
                color={theme.colors.status.amber}
                style={{ marginBottom: theme.spacing.margin.xs }}
              />
              <Text
                className="text-[10px] font-bold tracking-wider"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: 10,
                  fontWeight: theme.typography.fontWeight.bold,
                  letterSpacing: 2,
                }}
              >
                KCAL
              </Text>
            </View>

            {/* PROTEIN Node */}
            <View
              className="absolute right-[8%] top-[20%] z-30 h-20 w-20 flex-col items-center justify-center rounded-[2rem]"
              style={{
                top: '20%',
                right: '8%',
                backgroundColor: `${theme.colors.text.white}0D`,
                borderColor: `${theme.colors.text.white}1A`,
                borderWidth: 1,
                borderRadius: 32,
                shadowColor: theme.colors.text.black,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 32,
                elevation: 5,
              }}
            >
              <MaterialIcons
                name="fitness-center"
                size={28}
                color={theme.colors.status.indigo}
                style={{ marginBottom: theme.spacing.margin.sm }}
              />
              <Text
                className="text-[10px] font-bold tracking-wider"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: 10,
                  fontWeight: theme.typography.fontWeight.bold,
                  letterSpacing: 2,
                }}
              >
                PROTEIN
              </Text>
            </View>

            {/* MACROS Node */}
            <View
              className="absolute bottom-[20%] right-[15%] z-30 h-16 w-16 flex-col items-center justify-center rounded-2xl"
              style={{
                bottom: '20%',
                right: '15%',
                backgroundColor: `${theme.colors.text.white}0D`,
                borderColor: `${theme.colors.text.white}1A`,
                borderWidth: 1,
                borderRadius: theme.borderRadius['2xl'],
                shadowColor: theme.colors.text.black,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 32,
                elevation: 5,
              }}
            >
              <MaterialIcons
                name="eco"
                size={24}
                color={theme.colors.accent.primary}
                style={{ marginBottom: theme.spacing.margin.xs }}
              />
              <Text
                className="text-[10px] font-bold tracking-wider"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: 10,
                  fontWeight: theme.typography.fontWeight.bold,
                  letterSpacing: 2,
                }}
              >
                MACROS
              </Text>
            </View>

            {/* Connection Lines (SVG-like representation using View) */}
            <View className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              {/* Line 1: Center to KCAL */}
              <View
                className="absolute"
                style={{
                  left: '40%',
                  top: '35%',
                  width: 60,
                  height: 2,
                  backgroundColor: `${theme.colors.status.indigo}4D`,
                  transform: [{ rotate: '-30deg' }],
                }}
              />
              {/* Line 2: Center to PROTEIN */}
              <View
                className="absolute"
                style={{
                  right: '32%',
                  top: '40%',
                  width: 60,
                  height: 2,
                  backgroundColor: `${theme.colors.accent.primary}4D`,
                  transform: [{ rotate: '20deg' }],
                }}
              />
              {/* Line 3: Center to MACROS */}
              <View
                className="absolute"
                style={{
                  right: '25%',
                  bottom: '40%',
                  width: 60,
                  height: 2,
                  backgroundColor: `${theme.colors.accent.primary}4D`,
                  transform: [{ rotate: '45deg' }],
                }}
              />
            </View>
          </View>

          {/* Header */}
          <Text
            className="mb-4 text-center text-[32px] font-bold leading-[1.1]"
            style={{
              color: theme.colors.text.primary,
              fontSize: 32,
              fontWeight: theme.typography.fontWeight.bold,
            }}
          >
            Smart Goal{' '}
            <Text
              style={{
                color: theme.colors.status.indigoLight,
                fontSize: 32,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              Calculation
            </Text>
          </Text>

          <Text
            className="mb-8 text-center text-[16px] font-normal leading-relaxed"
            style={{
              color: theme.colors.text.secondary,
              fontSize: 16,
              fontWeight: theme.typography.fontWeight.normal,
              maxWidth: '90%',
            }}
          >
            Based on your activity level and fitness goals, our AI can calculate your optimal daily
            calorie and macro targets for you.
          </Text>

          {/* Feature Tags */}
          <View className="mb-8 flex flex-wrap justify-center gap-2">
            <View
              className="flex-row items-center gap-2 rounded-full px-4 py-2"
              style={{
                backgroundColor: `${theme.colors.status.indigo}0D`,
                borderColor: `${theme.colors.status.indigo}1A`,
                borderWidth: 1,
              }}
            >
              <MaterialIcons name="restaurant" size={14} color={theme.colors.status.indigo} />
              <Text
                className="text-xs font-medium"
                style={{
                  color: theme.colors.status.indigoLight,
                  fontSize: 12,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                Personalized Macros
              </Text>
            </View>

            <View
              className="flex-row items-center gap-2 rounded-full px-4 py-2"
              style={{
                backgroundColor: `${theme.colors.accent.primary}0D`,
                borderColor: `${theme.colors.accent.primary}1A`,
                borderWidth: 1,
              }}
            >
              <MaterialIcons name="auto-graph" size={14} color={theme.colors.accent.primary} />
              <Text
                className="text-xs font-medium"
                style={{
                  color: theme.colors.accent.secondary,
                  fontSize: 12,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                Dynamic Adjustments
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <BottomButtonWrapper>
        <Button
          label="Calculate for Me"
          variant="gradientCta"
          width="full"
          size="md"
          icon={() => (
            <MaterialIcons name="auto-awesome" size={20} color={theme.colors.text.white} />
          )}
          onPress={() => {
            // Handle AI calculation
          }}
          style={{ marginBottom: theme.spacing.margin.sm }}
        />

        {/* explicit spacer so spacing shows reliably inside the wrapper */}
        <View style={{ height: theme.spacing.margin.sm }} />

        <Button
          label="I'll Set Them Myself"
          variant="secondary"
          width="full"
          size="md"
          onPress={() => {
            // Handle manual setup
          }}
        />

        <Text
          className="mt-2 text-center text-[11px] leading-relaxed"
          style={{
            color: theme.colors.text.tertiary,
            fontSize: 11,
            textAlign: 'center',
            marginTop: theme.spacing.margin.sm,
          }}
        >
          Musclogs AI engine uses verified metabolic formulas to ensure your safety and progress
          efficiency.
        </Text>
      </BottomButtonWrapper>
    </View>
  );
}
