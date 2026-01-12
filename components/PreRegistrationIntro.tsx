import { View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Path,
} from 'react-native-svg';
import { TrendingUp, Dumbbell } from 'lucide-react-native';
import { theme } from '../theme';

export default function PreRegistrationIntro() {
  const screenWidth = Dimensions.get('window').width;
  const containerSize = screenWidth * 0.64; // w-64 equivalent (256px on standard screen)
  const innerCircleSize = screenWidth * 0.4; // w-40 equivalent (160px on standard screen)
  const maxHeight = Dimensions.get('window').height * 0.4;

  return (
    <View
      className="relative w-full items-center justify-center"
      style={{
        aspectRatio: 1,
        maxHeight: maxHeight,
      }}>
      {/* Ambient Background Glow */}
      <View className="absolute inset-0 rounded-full opacity-70">
        <LinearGradient
          colors={[
            'rgba(79, 70, 229, 0.3)', // indigo-brand/30
            'rgba(41, 224, 142, 0.1)', // primary/10
            'rgba(16, 185, 129, 0.3)', // emerald-brand/30
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: 9999,
          }}
        />
      </View>

      {/* Main Container */}
      <View
        className="relative z-10 items-center justify-center"
        style={{
          width: containerSize,
          height: containerSize,
        }}>
        {/* Outer Concentric Circles */}
        <View
          className="absolute inset-0 rounded-full border"
          style={{
            borderWidth: 1.5,
            borderColor: theme.colors.background.white10,
            transform: [{ scale: 1.1 }],
          }}
        />
        <View
          className="absolute inset-0 rounded-full border"
          style={{
            borderWidth: 1.5,
            borderColor: theme.colors.background.white5,
            transform: [{ scale: 1.25 }],
          }}
        />

        {/* Central Circle with Person Icon */}
        <View
          className="relative items-center justify-center rounded-full border"
          style={{
            width: innerCircleSize,
            height: innerCircleSize,
            backgroundColor: theme.colors.background.white5,
            borderColor: theme.colors.background.white10,
            ...theme.shadows.lg,
            shadowColor: theme.colors.status.indigo,
            shadowOpacity: 0.4,
            shadowRadius: 20,
          }}>
          {/* Person Icon with Gradient Effect */}
          <View
            style={{
              width: innerCircleSize * 0.6,
              height: innerCircleSize * 0.6,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Svg
              width={innerCircleSize * 0.8}
              height={innerCircleSize * 0.8}
              viewBox="0 0 24 24"
              fill="none">
              <Defs>
                <SvgLinearGradient id="userGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={theme.colors.text.white} />
                  <Stop offset="50%" stopColor={theme.colors.status.emeraldLight} />
                  <Stop offset="100%" stopColor={theme.colors.status.indigoLight} />
                </SvgLinearGradient>
              </Defs>
              {/* CircleUserRound icon - circle for head */}
              <Circle
                cx="12"
                cy="8"
                r="5"
                fill="none"
                stroke="url(#userGradient)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Shoulders/body path */}
              <Path
                d="M20 21a8 8 0 0 0-16 0"
                fill="none"
                stroke="url(#userGradient)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          {/* Top-Right Floating Icon - Insights */}
          <View
            className="absolute items-center justify-center rounded-2xl"
            style={{
              top: -theme.size['4'],
              right: -theme.size['4'],
              width: theme.size['14'],
              height: theme.size['14'],
              ...theme.shadows.lg,
              shadowColor: theme.colors.status.emeraldLight,
              shadowOpacity: 0.2,
            }}>
            <LinearGradient
              colors={theme.colors.gradients.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: theme.borderRadius['2xl'],
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <TrendingUp
                size={theme.iconSize['2xl']}
                color={theme.colors.text.white}
                strokeWidth={2.5}
              />
            </LinearGradient>
          </View>

          {/* Bottom-Left Floating Icon - Fitness */}
          <View
            className="absolute items-center justify-center rounded-full border"
            style={{
              bottom: theme.size['4'],
              left: -theme.size['8'],
              width: theme.size['10'],
              height: theme.size['10'],
              backgroundColor: theme.colors.background.white10,
              borderColor: theme.colors.background.white10,
            }}>
            <Dumbbell
              size={theme.iconSize.xl}
              color={theme.colors.status.emeraldLight}
              strokeWidth={2.5}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
