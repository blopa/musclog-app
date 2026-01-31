import { View, Text, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import {
  EditPersonalInfoBody,
  PersonalInfo as PersonalInfoType,
} from '../../components/EditPersonalInfoBody';
import { UserService } from '../../database/services';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { setOnboardingCompleted } from '../../utils/onboardingService';
import { AvatarColor } from '../../types/AvatarColor';

// Helper function to format date of birth timestamp to MM/DD/YYYY
function formatDateOfBirth(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export default function PersonalInfo() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<PersonalInfoType | undefined>(undefined);
  const [currentFormData, setCurrentFormData] = useState<PersonalInfoType | undefined>(undefined);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await UserService.getCurrentUser();
        if (user) {
          // Convert user data to PersonalInfo format
          setInitialData({
            fullName: user.fullName || '',
            email: user.email || '',
            dob: formatDateOfBirth(user.dateOfBirth),
            gender: user.gender,
            avatarIcon: user.avatarIcon || undefined,
            avatarColor: user.avatarColor || undefined,
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        // Continue with empty form if loading fails
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const handleSave = async (data: PersonalInfoType) => {
    setIsSaving(true);
    try {
      // Convert DOB string (MM/DD/YYYY) to Unix timestamp
      const dobParts = data.dob.split('/');
      if (dobParts.length !== 3) {
        throw new Error('Invalid date format. Please use MM/DD/YYYY');
      }
      const month = parseInt(dobParts[0], 10) - 1; // Month is 0-indexed
      const day = parseInt(dobParts[1], 10);
      const year = parseInt(dobParts[2], 10);
      const dateOfBirth = new Date(year, month, day).getTime();

      // Check if user already exists
      const existingUser = await UserService.getCurrentUser();

      if (existingUser) {
        // Update existing user
        await UserService.updateUserProfile({
          fullName: data.fullName,
          email: data.email || null,
          dateOfBirth,
          gender: data.gender as 'male' | 'female' | 'other',
          avatarIcon: data.avatarIcon || null,
          avatarColor: data.avatarColor || null,
        });
      } else {
        // Create new user with minimal required fields
        // We'll update fitness info in the next step
        await UserService.initializeUser({
          fullName: data.fullName,
          dateOfBirth,
          gender: data.gender as 'male' | 'female' | 'other',
          email: data.email,
          avatarIcon: data.avatarIcon,
          avatarColor: data.avatarColor,
          fitnessGoal: '', // Will be set in fitness-info step
          activityLevel: 3, // Default, will be updated
          liftingExperience: 'beginner', // Default, will be updated
        });
      }

      // Mark onboarding as completed and navigate to home
      await setOnboardingCompleted();
      router.push('/');
    } catch (error) {
      console.error('Error saving personal info:', error);
      // TODO: Show error message to user
    } finally {
      setIsSaving(false);
    }
  };

  const handleFloatingSave = async () => {
    if (currentFormData) {
      await handleSave(currentFormData);
    }
  };

  if (isLoading) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: theme.spacing.padding['4xl'],
          }}
        >
          <View className="px-6 pb-2 pt-4">
            <Text
              className="text-2xl font-bold tracking-tight"
              style={{ color: theme.colors.text.white }}
            >
              {t('onboarding.personalInfo.title')}
            </Text>
          </View>
          <EditPersonalInfoBody
            onSave={handleSave}
            onFormChange={setCurrentFormData}
            initialData={initialData}
            isLoading={isSaving}
            hideSaveButton
          />
        </ScrollView>

        {/* Floating Save Button */}
        <View
          className="absolute bottom-0 left-0 right-0"
          style={{
            paddingBottom: 0,
            paddingHorizontal: theme.spacing.padding.zero,
            backgroundColor: 'transparent',
          }}
        >
          <LinearGradient
            colors={[theme.colors.background.primary, 'transparent']}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
          >
            <View
              className="px-6 pb-6 pt-6"
              style={{
                paddingBottom: Platform.OS === 'web' ? theme.spacing.padding.lg : insets.bottom,
              }}
            >
              <Button
                label={t('onboarding.personalInfo.save')}
                onPress={handleFloatingSave}
                variant="accent"
                size="md"
                width="full"
                loading={isSaving}
              />
            </View>
          </LinearGradient>
        </View>
      </View>
    </MasterLayout>
  );
}
