import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dumbbell, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '../theme';
import { Button } from '../components/theme/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LandingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Main Background Gradient */}
      <LinearGradient
        colors={['#11211a', '#0a1f1a', '#0f251f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient Background Effects */}
      <View style={styles.ambientContainer} pointerEvents="none">
        {/* Top left blob */}
        <View
          style={[
            styles.blob,
            {
              top: -SCREEN_HEIGHT * 0.2,
              left: -SCREEN_WIDTH * 0.1,
              width: SCREEN_WIDTH * 1.2,
              height: SCREEN_HEIGHT * 0.6,
              backgroundColor: 'rgba(99, 102, 241, 0.2)', // indigo-600/20
            },
          ]}
        />
        {/* Bottom right blob */}
        <View
          style={[
            styles.blob,
            {
              bottom: -SCREEN_HEIGHT * 0.1,
              right: -SCREEN_WIDTH * 0.2,
              width: SCREEN_WIDTH * 0.8,
              height: SCREEN_HEIGHT * 0.5,
              backgroundColor: 'rgba(41, 224, 142, 0.1)', // primary/10
            },
          ]}
        />
      </View>

      {/* Main Content */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Top Spacer */}
          <View style={styles.topSpacer} />

          {/* Hero Section */}
          <View style={styles.heroSection}>
            {/* Logo Icon with Gradient Background */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#4f46e5', '#29e08e']} // indigo-600 to primary
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}>
                <Dumbbell size={theme.iconSize['3xl']} color={theme.colors.text.white} />
              </LinearGradient>
            </View>

            {/* Typography Section */}
            <View style={styles.typographySection}>
              {/* App Name */}
              <Text style={styles.appName}>Musclog</Text>

              {/* Tagline */}
              <Text style={styles.tagline}>Lift, Log, Repeat</Text>

              {/* Description */}
              <Text style={styles.description}>
                Track your progress with data-driven insights and crush your fitness goals.
              </Text>
            </View>
          </View>

          {/* Action Section */}
          <View style={styles.actionSection}>
            {/* Primary Button */}
            <Button
              label="Get Started"
              onPress={() => {
                // Navigate to home or onboarding
                router.push('/');
              }}
              icon={ArrowRight}
              iconPosition="right"
              variant="gradientCta"
              size="lg"
              width="full"
            />

            {/* Secondary Action */}
            <Pressable
              style={styles.loginLink}
              onPress={() => {
                // Navigate to login
                console.log('Navigate to login');
              }}>
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginTextAccent}>Log In</Text>
              </Text>
            </Pressable>

            {/* Terms / Footer Text */}
            <Text style={styles.termsText}>
              By continuing, you agree to our Terms & Privacy Policy.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.6,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 416, // max-w-md equivalent
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.padding['6'],
    justifyContent: 'space-between',
  },
  topSpacer: {
    height: theme.size['12'],
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.padding['6'],
    gap: theme.spacing.gap['2xl'],
  },
  logoContainer: {
    marginBottom: theme.spacing.padding.base,
  },
  logoGradient: {
    width: theme.size['12'],
    height: theme.size['12'],
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  typographySection: {
    alignItems: 'center',
    gap: theme.spacing.gap.sm,
    marginTop: theme.spacing.padding.base,
  },
  appName: {
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.black,
    color: theme.colors.text.white,
    letterSpacing: -0.5,
    lineHeight: theme.typography.fontSize['4xl'] * 1.1,
  },
  tagline: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.gray400,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.gray500,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: theme.spacing.padding.sm,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  actionSection: {
    paddingBottom: theme.spacing.padding['2xl'],
    paddingTop: theme.spacing.padding.base,
    gap: theme.spacing.gap.md,
  },
  loginLink: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.gray400,
  },
  loginTextAccent: {
    color: theme.colors.status.emeraldLight, // #29e08e
  },
  termsText: {
    fontSize: 10,
    textAlign: 'center',
    color: theme.colors.text.gray500,
    marginTop: theme.spacing.padding.sm,
  },
});

