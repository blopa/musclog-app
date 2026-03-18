import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import {
  EditPersonalInfoBody,
  PersonalInfo as PersonalInfoType,
} from '../../components/EditPersonalInfoBody';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { TEMP_GOOGLE_USER_NAME } from '../../constants/misc';
import { useSnackbar } from '../../context/SnackbarContext';
import { type Gender } from '../../database/models';
import { UserService } from '../../database/services';
import { theme } from '../../theme';
import { setOnboardingCompleted } from '../../utils/onboardingService';

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
  const { showSnackbar } = useSnackbar();
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
        } else {
          const tempName = await AsyncStorage.getItem(TEMP_GOOGLE_USER_NAME);
          setInitialData({
            fullName: tempName || '',
            email: '',
            dob: '',
            gender: 'other',
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
          gender: data.gender as Gender,
          avatarIcon: data.avatarIcon || null,
          avatarColor: data.avatarColor || null,
        });
      } else {
        // Create new user with minimal required fields
        // We'll update fitness info in the next step
        await UserService.initializeUser({
          fullName: data.fullName,
          dateOfBirth,
          gender: data.gender as Gender,
          email: data.email,
          avatarIcon: data.avatarIcon,
          avatarColor: data.avatarColor,
          fitnessGoal: 'general',
          weightGoal: 'maintain',
          activityLevel: 3, // Default, will be updated
          liftingExperience: 'beginner', // Default, will be updated
        });
      }

      if (data.trackCycle) {
        router.push('/onboarding/cycle-setup');
      } else {
        // Mark onboarding as completed and navigate to home
        await setOnboardingCompleted();
        router.push('/');
      }
    } catch (error) {
      console.error('Error saving personal info:', error);
      showSnackbar('error', t('onboarding.personalInfo.errorSaving'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFloatingSave = async () => {
    if (currentFormData) {
      await handleSave(currentFormData);
    }
  };

  // Form validation: check if required fields are filled
  const isFormValid = (): boolean => {
    if (!currentFormData) {
      return false;
    }

    return currentFormData.fullName.trim().length > 0;
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
            hideGender
            hideDob
          />
          <View className="h-4" />
        </ScrollView>

        {/* Floating Save Button */}
        <BottomButtonWrapper>
          <Button
            label={t('onboarding.personalInfo.finish')}
            onPress={handleFloatingSave}
            variant="accent"
            size="md"
            width="full"
            loading={isSaving}
            disabled={!isFormValid() || isSaving}
          />
          <View style={{ height: theme.spacing.gap.md }} />
        </BottomButtonWrapper>
      </View>
    </MasterLayout>
  );
}
