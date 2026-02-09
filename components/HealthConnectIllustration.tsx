import { LinearGradient } from 'expo-linear-gradient';
import { Apple, Dumbbell, Heart, Scale, Shield } from 'lucide-react-native';
import { Dimensions, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ILLUSTRATION_SIZE = SCREEN_WIDTH * 0.4; // 40% of screen width

export function HealthConnectIllustration() {
  const theme = useTheme();
  return (
    <View
      className="relative mb-8 mt-4 w-full items-center justify-center"
      style={{
        aspectRatio: theme.aspectRatio.square,
        minHeight: ILLUSTRATION_SIZE,
      }}
    >
      {/* Ambient Background Glows */}
      <View
        className="absolute rounded-full"
        style={{
          width: theme.size['256'],
          height: theme.size['256'],
          left: -theme.size['48'],
          top: -theme.size['32'],
          backgroundColor: theme.colors.status.indigo10,
          opacity: theme.colors.opacity.medium,
        }}
      />
      <View
        className="absolute rounded-full"
        style={{
          width: theme.size['256'],
          height: theme.size['256'],
          right: -theme.size['48'],
          bottom: -theme.size['32'],
          backgroundColor: theme.colors.status.emerald20,
          opacity: theme.colors.opacity.medium,
        }}
      />

      {/* Central Health Shield */}
      <View
        className="relative z-10 items-center justify-center"
        style={{
          width: ILLUSTRATION_SIZE,
          height: ILLUSTRATION_SIZE,
        }}
      >
        <LinearGradient
          colors={[theme.colors.status.indigo, theme.colors.status.emeraldLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: theme.borderRadius['3xl'],
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.background.white20,
          }}
        >
          <Shield
            size={ILLUSTRATION_SIZE * 0.5}
            color={theme.colors.text.white}
            strokeWidth={theme.strokeWidth.medium}
          />
        </LinearGradient>
      </View>

      {/* Floating Icons - Simplified without background cards */}
      {/* Top Left - Dumbbell */}
      <View
        className="absolute items-center justify-center"
        style={{
          top: '10%',
          left: '20%',
        }}
      >
        <Dumbbell
          size={theme.iconSize.xl}
          color={theme.colors.status.indigoLight}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>

      {/* Top Right - Scale */}
      <View
        className="absolute items-center justify-center"
        style={{
          top: '15%',
          right: '15%',
        }}
      >
        <Scale
          size={theme.iconSize.lg}
          color={theme.colors.status.emerald}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>

      {/* Bottom Left - Apple/Nutrition */}
      <View
        className="absolute items-center justify-center"
        style={{
          bottom: '20%',
          left: '10%',
        }}
      >
        <Apple
          size={theme.iconSize.lg}
          color={theme.colors.status.emeraldLight}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>

      {/* Bottom Right - Heart */}
      <View
        className="absolute items-center justify-center"
        style={{
          bottom: '10%',
          right: '20%',
        }}
      >
        <Heart
          size={theme.iconSize['2xl']}
          color={theme.colors.status.purple}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>
    </View>
  );
}
