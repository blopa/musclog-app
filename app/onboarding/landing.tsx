import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight, Download, Dumbbell } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Linking, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MasterLayout } from '../../components/MasterLayout';
import { CenteredModal } from '../../components/modals/CenteredModal';
import { Button } from '../../components/theme/Button';
import { TextInput } from '../../components/theme/TextInput';
import { useSnackbar } from '../../context/SnackbarContext';
import { seedDevData } from '../../database/seeders/dev';
import { seedProductionData } from '../../database/seeders/prod';
import { verifyDatabaseTables } from '../../database/verify';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { useTheme } from '../../hooks/useTheme';
import { importDatabase, shouldSeedDevData } from '../../utils/file';
import { captureException } from '../../utils/sentry';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LandingScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const router = useRouter();

  const [isInitializing, setIsInitializing] = useState(true);
  const [initPhase, setInitPhase] = useState<'seeding' | 'migrating' | null>(null);
  const [initStep, setInitStep] = useState<string | null>(null);
  const [initProgressCurrent, setInitProgressCurrent] = useState<number | null>(null);
  const [initProgressTotal, setInitProgressTotal] = useState<number | null>(null);

  // Import functionality state
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [decryptionPhrase, setDecryptionPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (__DEV__) {
          const result = await verifyDatabaseTables();
          if (!result.success) {
            console.error('⚠️  DATABASE NOT INITIALIZED PROPERLY');
            console.error('Missing tables:', result.missingTables);
            console.error('Solution: Uninstall the app completely and reinstall it.');
          }
        }

        await seedProductionData({
          onProgress: (info) => {
            setInitPhase(info.phase);
            setInitStep(info.step ?? null);
            setInitProgressCurrent(info.current ?? null);
            setInitProgressTotal(info.total ?? null);
          },
        });

        // access via http://localhost:8081/onboarding/landing?demoModeEnabled=true
        if (shouldSeedDevData()) {
          await seedDevData();

          router.navigate('/');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        captureException(error, { data: { context: 'landing.initializeApp' } });
        showSnackbar('error', t('errors.somethingWentWrong'));
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [router]);

  const handleImportConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await importDatabase(decryptionPhrase || undefined);
      setImportModalVisible(false);
      setDecryptionPhrase('');
      showSnackbar('success', t('settings.advancedSettings.importSuccessMessage'));
    } catch (err) {
      console.error('Import failed:', err);
      showSnackbar('error', t('settings.advancedSettings.importFailedMessage'));
    } finally {
      setLoading(false);
    }
  }, [decryptionPhrase, t, showSnackbar]);

  return (
    <MasterLayout showNavigationMenu={false}>
      {/* Main Background Gradient */}
      <LinearGradient
        colors={theme.colors.gradients.landingBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Ambient Background Effects */}
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        {/* Top left blob */}
        <View
          className="absolute rounded-full opacity-60"
          style={{
            top: -SCREEN_HEIGHT * 0.2,
            left: -SCREEN_WIDTH * 0.1,
            width: SCREEN_WIDTH * 1.2,
            height: SCREEN_HEIGHT * 0.6,
            backgroundColor: theme.colors.status.indigo10, // indigo-600/20 equivalent
          }}
        />
        {/* Bottom right blob */}
        <View
          className="absolute rounded-full opacity-60"
          style={{
            bottom: -SCREEN_HEIGHT * 0.1,
            right: -SCREEN_WIDTH * 0.2,
            width: SCREEN_WIDTH * 0.8,
            height: SCREEN_HEIGHT * 0.5,
            backgroundColor: theme.colors.status.emerald20, // primary/10 equivalent
          }}
        />
      </View>

      {/* Main Content */}
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        {/* Import Button - Top Right */}
        <TouchableOpacity
          className="absolute right-4 top-4 z-10 rounded-lg p-2"
          style={{
            backgroundColor: theme.colors.background.black30,
            opacity: isInitializing ? theme.colors.opacity.medium : theme.colors.opacity.full,
          }}
          onPress={() => setImportModalVisible(true)}
          disabled={isInitializing}
          accessibilityLabel={t('onboarding.landing.importData')}
          accessibilityRole="button"
        >
          <Download size={20} color={theme.colors.text.white} />
        </TouchableOpacity>

        <View className="w-full max-w-md flex-1 justify-between self-center px-6">
          {/* Top Spacer */}
          <View style={{ height: theme.size['12'] }} />

          {/* Hero Section */}
          <View className="flex-1 items-center justify-center gap-8 py-6">
            {/* Logo Icon with Gradient Background */}
            <View className="mb-4">
              <LinearGradient
                colors={theme.colors.gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: theme.size['12'],
                  height: theme.size['12'],
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  overflow: 'hidden',
                  ...theme.shadows.lg,
                }}
              >
                <Dumbbell size={theme.iconSize['3xl']} color={theme.colors.text.white} />
              </LinearGradient>
            </View>

            {/* Typography Section */}
            <View className="mt-4 items-center gap-2">
              {/* App Name */}
              <Text
                className="font-black leading-none tracking-tight"
                style={{
                  color: theme.colors.text.white,
                  fontSize: theme.typography.fontSize['4xl'],
                  letterSpacing: theme.typography.letterSpacing.tight,
                  lineHeight: theme.typography.fontSize['4xl'] * 1.1,
                }}
              >
                {t('onboarding.landing.appName')}
              </Text>

              {/* Tagline */}
              <Text
                className="font-medium tracking-wide"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.lg,
                  letterSpacing: theme.typography.letterSpacing.wide,
                }}
              >
                {t('onboarding.landing.tagline')}
              </Text>

              {/* Description */}
              <Text
                className="mt-2 text-center"
                style={{
                  color: theme.colors.text.gray500,
                  fontSize: theme.typography.fontSize.sm,
                  maxWidth: theme.maxWidth.md,
                  lineHeight: theme.typography.fontSize.sm * 1.5,
                }}
              >
                {t('onboarding.landing.description')}
              </Text>
            </View>
          </View>

          {/* Loading state or button block */}
          <View className="gap-3 pb-8 pt-4">
            {isInitializing ? (
              <View className="items-center gap-4">
                {initPhase === 'migrating' ? (
                  <Text
                    className="text-center"
                    style={{
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.fontSize.sm,
                      lineHeight: theme.typography.fontSize.sm * 1.4,
                      paddingHorizontal: theme.size[4],
                    }}
                  >
                    {t('onboarding.landing.migratingPreamble')}
                  </Text>
                ) : null}
                <ActivityIndicator size="large" color={theme.colors.text.white} />
                <View className="items-center gap-1">
                  {initPhase === 'migrating' &&
                  initStep &&
                  initProgressTotal != null &&
                  initProgressTotal > 0 &&
                  initProgressCurrent != null ? (
                    <Text
                      className="text-center font-medium tabular-nums"
                      style={{
                        color: theme.colors.text.white,
                        fontSize: theme.typography.fontSize.xl,
                      }}
                    >
                      {formatInteger(initProgressCurrent)} / {formatInteger(initProgressTotal)}
                    </Text>
                  ) : null}
                  <View style={{ height: theme.size.xs }} />
                  <Text
                    className="text-center"
                    style={{
                      color: theme.colors.text.white,
                      fontSize: theme.typography.fontSize.lg,
                    }}
                  >
                    {initPhase === 'migrating' && initStep
                      ? t('onboarding.landing.migratingStep', {
                          step: t(`onboarding.landing.migrationSteps.${initStep}`),
                        })
                      : initPhase === 'migrating'
                        ? t('onboarding.landing.migratingData')
                        : t('onboarding.landing.preparingApp')}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {/* Primary Button */}
                <Button
                  label={t('onboarding.landing.getStarted')}
                  onPress={() => {
                    // Navigate to home or onboarding
                    router.navigate('/onboarding/onboarding');
                  }}
                  icon={ArrowRight}
                  iconPosition="right"
                  variant="gradientCta"
                  size="lg"
                  width="full"
                />

                {/* Terms / Footer Text */}
                <View className="mt-2">
                  <Text
                    className="text-center"
                    style={{
                      color: theme.colors.text.gray500,
                      fontSize: theme.typography.fontSize.xs,
                    }}
                  >
                    {t('onboarding.landing.termsAndPrivacy')}
                  </Text>

                  <Text
                    accessibilityRole="link"
                    onPress={async () => {
                      const url = 'https://musclog.app/en-us/terms';
                      try {
                        await Linking.openURL(url);
                      } catch (e) {
                        console.error('Failed to open privacy link', e);
                      }
                    }}
                    className="mt-1 text-center"
                    style={{
                      color: theme.colors.accent.primary,
                      fontSize: theme.typography.fontSize.xs,
                      textDecorationLine: 'underline',
                    }}
                  >
                    {t('onboarding.landing.viewTerms')}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Import confirmation modal */}
      <CenteredModal
        visible={importModalVisible}
        onClose={() => {
          if (!loading) {
            setImportModalVisible(false);
            setDecryptionPhrase('');
          }
        }}
        title={t('settings.advancedSettings.confirmImport')}
        subtitle={t('settings.advancedSettings.importConfirmationSubtitle')}
        footer={
          <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
            <Button
              label={t('common.cancel')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={() => {
                setImportModalVisible(false);
                setDecryptionPhrase('');
              }}
              disabled={loading}
            />
            <Button
              label={t('common.confirm')}
              variant="accent"
              size="sm"
              width="flex-1"
              onPress={handleImportConfirm}
              disabled={loading}
              loading={loading}
            />
          </View>
        }
      >
        <View className="gap-4">
          <TextInput
            label={t(
              'settings.advancedSettings.enterDecryptionPhrase',
              'Enter Decryption Phrase (Optional)'
            )}
            value={decryptionPhrase}
            onChangeText={setDecryptionPhrase}
            placeholder={t(
              'settings.advancedSettings.decryptionPhrasePlaceholder',
              'Leave empty if no encryption was used'
            )}
            secureTextEntry
          />
        </View>
      </CenteredModal>
    </MasterLayout>
  );
}
