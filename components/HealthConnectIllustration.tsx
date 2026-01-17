import { View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield,
  Dumbbell,
  Scale,
  Apple,
  Heart,
} from 'lucide-react-native';
import { theme } from '../theme';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ILLUSTRATION_SIZE = SCREEN_WIDTH * 0.4; // 40% of screen width

export function HealthConnectIllustration() {
  return (
    <View
      className="relative mb-8 mt-4 w-full items-center justify-center"
      style={{
        aspectRatio: theme.aspectRatio.square,
        minHeight: ILLUSTRATION_SIZE,
      }}>
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
          ...theme.shadows.lg,
          shadowColor: theme.colors.status.indigo,
          shadowOpacity: theme.colors.opacity.subtle,
        }}>
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
          }}>
          <Shield
            size={ILLUSTRATION_SIZE * 0.5}
            color={theme.colors.text.white}
            strokeWidth={theme.strokeWidth.medium}
          />
        </LinearGradient>
      </View>

      {/* Floating Icons */}
      {/* Top Left - Dumbbell */}
      <View
        className="absolute items-center justify-center rounded-2xl border border-white/5"
        style={{
          width: theme.size['56'],
          height: theme.size['56'],
          top: '10%',
          left: '20%',
          backgroundColor: theme.colors.background.card,
          ...theme.shadows.lg,
        }}>
        <Dumbbell
          size={theme.iconSize.xl}
          color={theme.colors.status.indigoLight}
          strokeWidth={theme.borderWidth.medium}
        />
      </View>

      {/* Top Right - Scale */}
      <View
        className="absolute items-center justify-center rounded-2xl border border-white/5"
        style={{
          width: theme.size['48'],
          height: theme.size['48'],
          top: '15%',
          right: '15%',
          backgroundColor: theme.colors.background.card,
          ...theme.shadows.lg,
        }}>
        <Scale
          size={theme.iconSize.lg}
          color={theme.colors.status.emerald}
          strokeWidth={theme.borderWidth.medium}
        />
      </View>

      {/* Bottom Left - Apple/Nutrition */}
      <View
        className="absolute items-center justify-center rounded-2xl border border-white/5"
        style={{
          width: theme.size['48'],
          height: theme.size['48'],
          bottom: '20%',
          left: '10%',
          backgroundColor: theme.colors.background.card,
          ...theme.shadows.lg,
        }}>
        <Apple
          size={theme.iconSize.lg}
          color={theme.colors.status.emeraldLight}
          strokeWidth={theme.borderWidth.medium}
        />
      </View>

      {/* Bottom Right - Heart */}
      <View
        className="absolute items-center justify-center rounded-2xl border border-white/5"
        style={{
          width: theme.size['64'],
          height: theme.size['64'],
          bottom: '10%',
          right: '20%',
          backgroundColor: theme.colors.background.card,
          ...theme.shadows.lg,
        }}>
        <Heart
          size={theme.iconSize['2xl']}
          color={theme.colors.status.purple}
          strokeWidth={theme.borderWidth.medium}
        />
      </View>

      {/* Dashed Lines SVG */}
      <Svg
        className="absolute inset-0 h-full w-full"
        style={{ opacity: theme.colors.opacity.subtle }}
        viewBox="0 0 400 400"
        preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient id="lineGradient" x1="60" y1="60" x2="340" y2="340">
            <Stop offset="0" stopColor={theme.colors.status.indigo} />
            <Stop offset="1" stopColor={theme.colors.status.emeraldLight} />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M120 100C160 80 240 80 280 120"
          stroke={theme.colors.text.white}
          strokeDasharray="4 4"
          strokeWidth={theme.strokeWidth.thin}
          fill="none"
        />
        <Path
          d="M300 280C260 320 180 340 100 280"
          stroke={theme.colors.text.white}
          strokeDasharray="4 4"
          strokeWidth={theme.strokeWidth.thin}
          fill="none"
        />
        <Circle
          cx="200"
          cy="200"
          r="140"
          stroke="url(#lineGradient)"
          strokeWidth={theme.strokeWidth.extraThin}
          fill="none"
          opacity={theme.colors.opacity.subtle}
        />
      </Svg>
    </View>
  );
}
