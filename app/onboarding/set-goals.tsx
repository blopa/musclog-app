import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'hooks/useTheme';
import { ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { Button } from '../../components/theme/Button';

// Orbital Illustration Component
function OrbitalIllustration() {
  const theme = useTheme();

  return (
    <View className="relative mb-2 mt-2 aspect-square w-full items-center justify-center">
      {/* Background Blurs with larger blur radius */}
      <View
        className="absolute h-64 w-64 rounded-full"
        style={{
          backgroundColor: `${theme.colors.status.indigo}33`,
          width: 256,
          height: 256,
          borderRadius: 128,
          // blur-[100px] equivalent
          shadowColor: theme.colors.status.indigo,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 100,
          elevation: 0,
        }}
      />
      <View
        className="absolute h-64 w-64 rounded-full"
        style={{
          backgroundColor: `${theme.colors.accent.primary}33`,
          width: 256,
          height: 256,
          transform: [{ translateX: 48 }], // translate-x-12 = 48px
          borderRadius: 128,
          // blur-[100px] equivalent
          shadowColor: theme.colors.accent.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 100,
          elevation: 0,
        }}
      />

      {/* Orbit Paths with border-white/5 */}
      <View
        className="absolute rounded-full border"
        style={{
          width: 280,
          height: 280,
          borderColor: `${theme.colors.text.white}0D`, // border-white/5
          transform: [{ rotate: '-15deg' }],
        }}
      />
      <View
        className="absolute rounded-full border"
        style={{
          width: 220,
          height: 220,
          borderColor: `${theme.colors.text.white}0D`, // border-white/5
          transform: [{ rotate: '10deg' }],
        }}
      />

      {/* Central Icon with decorative elements */}
      <View className="relative z-20 h-32 w-32 items-center justify-center">
        <View
          className="absolute inset-0 rounded-full"
          style={{
            // brand-gradient opacity-20 blur-2xl
            backgroundColor: `${theme.colors.status.indigo}33`,
            opacity: 0.2,
            borderRadius: 64,
            shadowColor: theme.colors.status.indigo,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 80, // blur-2xl equivalent
            elevation: 0,
          }}
        />
        <View
          className="relative h-24 w-24 items-center justify-center rounded-3xl"
          style={{
            // brand-gradient shadow-[0_0_40px_rgba(99,102,241,0.4)]
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
          {/* Decorative dots */}
          <View
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full"
            style={{
              backgroundColor: theme.colors.text.white,
              width: 12,
              height: 12,
              marginTop: -4,
              marginRight: -4,
            }}
          />
          <View
            className="absolute -bottom-2 left-4 h-2 w-2 rounded-full"
            style={{
              backgroundColor: `${theme.colors.accent.primary}80`, // bg-primary/50
              width: 8,
              height: 8,
              marginBottom: -8,
              marginLeft: 16,
            }}
          />
        </View>
      </View>

      {/* Floating Nodes with glass-node styling */}
      {/* KCAL Node */}
      <View
        className="absolute left-[10%] top-[15%] z-30 h-16 w-16 flex-col items-center justify-center rounded-2xl"
        style={{
          top: '15%',
          left: '10%',
          // glass-node: bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]
          backgroundColor: `${theme.colors.text.white}0D`, // bg-white/5
          borderColor: `${theme.colors.text.white}1A`, // border-white/10
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
          size={24} // text-2xl
          color={theme.colors.status.amber}
          style={{ marginBottom: 2 }} // mb-0.5
        />
        <Text
          className="text-[10px] font-bold tracking-wider"
          style={{
            color: theme.colors.text.tertiary, // text-gray-400
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
          // glass-node styling
          backgroundColor: `${theme.colors.text.white}0D`,
          borderColor: `${theme.colors.text.white}1A`,
          borderWidth: 1,
          borderRadius: 32, // rounded-[2rem]
          shadowColor: theme.colors.text.black,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 32,
          elevation: 5,
        }}
      >
        <MaterialIcons
          name="fitness-center"
          size={30} // text-3xl
          color={theme.colors.status.indigo}
          style={{ marginBottom: 4 }} // mb-1
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
          // glass-node styling
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
          size={24} // text-2xl
          color={theme.colors.accent.primary}
          style={{ marginBottom: 2 }} // mb-0.5
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

      {/* Connection Lines with gradient and dashed effect */}
      <View className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {/* Line 1: Center to KCAL - from (160,140) to (110,110) */}
        <View
          className="absolute"
          style={{
            left: '27.5%', // 110/400
            top: '27.5%', // 110/400
            width: 60, // sqrt((160-110)^2 + (140-110)^2) ≈ 58
            height: 1.5,
            backgroundColor: 'transparent',
            transform: [{ rotate: '-30deg' }],
          }}
        >
          <LinearGradient
            colors={[`${theme.colors.status.indigo}4D`, `${theme.colors.accent.primary}4D`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 1,
            }}
          />
          {/* Dashed effect using overlay */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent',
              borderStyle: 'dashed',
              borderColor: 'transparent',
              borderWidth: 0,
              borderRadius: 1,
            }}
          />
        </View>
        
        {/* Line 2: Center to PROTEIN - from (240,160) to (290,140) */}
        <View
          className="absolute"
          style={{
            right: '27.5%', // 110/400
            top: '35%', // 140/400
            width: 60, // sqrt((290-240)^2 + (140-160)^2) ≈ 54
            height: 1.5,
            backgroundColor: 'transparent',
            transform: [{ rotate: '20deg' }],
          }}
        >
          <LinearGradient
            colors={[`${theme.colors.status.indigo}4D`, `${theme.colors.accent.primary}4D`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 1,
            }}
          />
        </View>
        
        {/* Line 3: Center to MACROS - from (220,240) to (260,280) */}
        <View
          className="absolute"
          style={{
            right: '35%', // 140/400
            bottom: '30%', // 120/400
            width: 60, // sqrt((260-220)^2 + (280-240)^2) ≈ 57
            height: 1.5,
            backgroundColor: 'transparent',
            transform: [{ rotate: '45deg' }],
          }}
        >
          <LinearGradient
            colors={[`${theme.colors.status.indigo}4D`, `${theme.colors.accent.primary}4D`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 1,
            }}
          />
        </View>
      </View>
    </View>
  );
}

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
          <OrbitalIllustration />

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
