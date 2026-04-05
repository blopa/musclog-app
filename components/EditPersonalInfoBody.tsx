import { subYears } from 'date-fns';
import { Check, Mail, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { type Gender } from '../database/models';
import { useTheme } from '../hooks/useTheme';
import { AvatarColor } from '../types/AvatarColor';
import { AvatarIcon } from '../types/AvatarIcon';
import { getAvatarIcon } from '../utils/avatarUtils';
import {
  formatLocalCalendarDayIso,
  getLocalCalendarYear,
  localCalendarDayDate,
} from '../utils/calendarDate';
import { parseDobDisplayStringToPickerDate } from '../utils/fitnessProfilePersistence';
import { AvatarSelector } from './AvatarSelector';
import { DatePickerInput } from './modals/DatePickerInput';
import { DatePickerModal } from './modals/DatePickerModal';
import { Button } from './theme/Button';
import { SegmentedControl } from './theme/SegmentedControl';
import { TextInput } from './theme/TextInput';

type EditPersonalInfoBodyProps = {
  initialData?: PersonalInfo;
  onSave?: (data: PersonalInfo) => void;
  onFormChange?: (data: PersonalInfo) => void;
  isLoading?: boolean;
  hideSaveButton?: boolean;
  showEmailInput?: boolean;
  hideGender?: boolean;
  hideDob?: boolean;
};

export type PersonalInfo = {
  fullName: string;
  email: string;
  dob: string;
  gender: Gender;
  avatarIcon?: AvatarIcon;
  avatarColor?: AvatarColor;
  trackCycle?: boolean;
};

const AVATAR_ICONS = [
  'sports',
  'directions_run',
  'monitoring',
  'person',
  'fitness_center',
  'bolt',
  'emoji_events',
  'heart',
  'flame',
  'meditation',
] as const;

export function EditPersonalInfoBody({
  onSave,
  onFormChange,
  initialData,
  isLoading,
  hideSaveButton = false,
  showEmailInput = false,
  hideGender = false,
  hideDob = false,
}: EditPersonalInfoBodyProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(initialData?.fullName ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [dob, setDob] = useState(initialData?.dob ?? '');
  const [gender, setGender] = useState<Gender>(initialData?.gender ?? 'other');
  const [avatarIcon, setAvatarIcon] = useState<AvatarIcon>(initialData?.avatarIcon ?? 'person');
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(
    initialData?.avatarColor ?? 'emerald'
  );
  const [trackCycle, setTrackCycle] = useState(initialData?.trackCycle ?? false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  const currentDate = parseDobDisplayStringToPickerDate(dob);

  // Handle date selection from picker
  const handleDateSelect = (date: Date) => {
    setDob(formatLocalCalendarDayIso(localCalendarDayDate(date)));
  };

  // Call onFormChange whenever form data changes
  useEffect(() => {
    if (onFormChange) {
      onFormChange({
        fullName,
        email,
        dob,
        gender,
        avatarIcon,
        avatarColor,
        trackCycle,
      });
    }
  }, [fullName, email, dob, gender, avatarIcon, avatarColor, trackCycle, onFormChange]);

  const genderOptions = [
    { label: t('editPersonalInfo.other'), value: 'other' },
    { label: t('editPersonalInfo.male'), value: 'male' },
    { label: t('editPersonalInfo.female'), value: 'female' },
  ];

  return (
    <View className="flex-1 px-4 pt-2">
      {/* Avatar Section */}
      <View className="py-6">
        <AvatarSelector
          selectedAvatar={avatarIcon}
          selectedColor={avatarColor}
          onAvatarSelect={setAvatarIcon}
          onColorSelect={setAvatarColor}
          label={t('chooseAvatar')}
          avatarOptions={AVATAR_ICONS.map((icon) => ({
            icon,
            component: getAvatarIcon(icon),
          }))}
        />
      </View>

      {/* Form Fields */}
      <View className="mt-2 gap-6">
        <TextInput
          label={t('editPersonalInfo.fullName')}
          required
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('editPersonalInfo.fullNamePlaceholder')}
          icon={<User size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
        />

        {showEmailInput ? (
          <TextInput
            label={t('editPersonalInfo.emailAddress')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('editPersonalInfo.emailPlaceholder')}
            keyboardType="email-address"
            icon={<Mail size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
          />
        ) : null}

        {!hideDob ? (
          <View className="flex-col gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              <View className="flex-row items-center gap-1">
                <Text className="text-lg font-bold text-text-primary">
                  {t('editPersonalInfo.dateOfBirth')}
                </Text>
                <Text style={{ color: theme.colors.status.error }}>*</Text>
              </View>
            </Text>
            <DatePickerInput
              hideLabel
              unset={!dob}
              unsetPlaceholder={t('editPersonalInfo.dateOfBirthPlaceholder')}
              selectedDate={currentDate}
              onPress={() => setIsDatePickerVisible(true)}
            />
          </View>
        ) : null}

        {!hideGender ? (
          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              <View className="flex-row items-center gap-1">
                <Text className="text-lg font-bold text-text-primary">
                  {t('editPersonalInfo.gender')}
                </Text>
                <Text style={{ color: theme.colors.status.error }}>*</Text>
              </View>
            </Text>
            <SegmentedControl
              options={genderOptions}
              value={gender}
              onValueChange={(val) => setGender(val as Gender)}
            />
          </View>
        ) : null}

        {hideGender || gender === 'female' || gender === 'other' ? (
          <View className="mt-2 rounded-2xl border-2 border-white/5 bg-bg-card p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-bold text-text-primary">
                  {t('onboarding.personalInfo.trackCycle')}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {t('onboarding.personalInfo.trackCycleDescription')}
                </Text>
              </View>
              <Pressable
                onPress={() => setTrackCycle(!trackCycle)}
                className={`h-8 w-14 rounded-full p-1 ${
                  trackCycle ? 'bg-accent-primary' : 'bg-bg-navActive'
                }`}
              >
                <View
                  className={`h-6 w-6 rounded-full bg-white transition-all ${
                    trackCycle ? 'ml-6' : 'ml-0'
                  }`}
                />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {!hideSaveButton ? (
        <View className="bg-transparent px-4 pb-6 pt-3">
          <Button
            label={t('editPersonalInfo.saveChanges')}
            icon={Check}
            variant="accent"
            size="md"
            width="full"
            loading={isLoading}
            onPress={() =>
              onSave?.({
                fullName,
                email,
                dob,
                gender,
                avatarIcon,
                avatarColor,
                trackCycle,
              })
            }
          />
        </View>
      ) : null}

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={currentDate}
        onDateSelect={handleDateSelect}
        minYear={1900}
        maxYear={getLocalCalendarYear(new Date())}
        quickDates={[
          { label: t('datePicker.xYearsAgo', { count: 20 }), date: subYears(new Date(), 20) },
          { label: t('datePicker.xYearsAgo', { count: 30 }), date: subYears(new Date(), 30) },
          { label: t('datePicker.xYearsAgo', { count: 40 }), date: subYears(new Date(), 40) },
        ]}
      />
    </View>
  );
}
