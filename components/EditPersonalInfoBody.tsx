import { Calendar, Check, Mail, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { theme } from '../theme';
import { AvatarColor } from '../types/AvatarColor';
import { AvatarIcon } from '../types/AvatarIcon';
import { AvatarSelector } from './AvatarSelector';
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
};

export type PersonalInfo = {
  fullName: string;
  email: string;
  dob: string;
  gender: string;
  avatarIcon?: AvatarIcon;
  avatarColor?: AvatarColor;
};

export function EditPersonalInfoBody({
  onSave,
  onFormChange,
  initialData,
  isLoading,
  hideSaveButton = false,
  showEmailInput = false,
}: EditPersonalInfoBodyProps) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(initialData?.fullName ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [dob, setDob] = useState(initialData?.dob ?? '');
  const [gender, setGender] = useState(initialData?.gender ?? 'other');
  const [avatarIcon, setAvatarIcon] = useState<AvatarIcon>(initialData?.avatarIcon ?? 'person');
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(
    initialData?.avatarColor ?? 'emerald'
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  // Helper function to convert DOB string to Date object
  const parseDobToDate = (dobString: string): Date => {
    if (!dobString) return new Date();
    const parts = dobString.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }

    return new Date();
  };

  // Helper function to convert Date object to DOB string
  const formatDateToDob = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Get current date as Date object for picker
  const currentDate = parseDobToDate(dob);

  // Handle date selection from picker
  const handleDateSelect = (date: Date) => {
    const newDob = formatDateToDob(date);
    setDob(newDob);
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
      });
    }
  }, [fullName, email, dob, gender, avatarIcon, avatarColor, onFormChange]);

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
        />
      </View>

      {/* Form Fields */}
      <View className="mt-2 gap-6">
        <TextInput
          label={
            <View className="flex-row items-center gap-1">
              <Text>{t('editPersonalInfo.fullName')}</Text>
              <Text style={{ color: theme.colors.status.error }}>*</Text>
            </View>
          }
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

        <View className="flex-col gap-2">
          <Text className="ml-1 text-sm font-medium text-text-secondary">
            <View className="flex-row items-center gap-1">
              <Text>{t('editPersonalInfo.dateOfBirth')}</Text>
              <Text style={{ color: theme.colors.status.error }}>*</Text>
            </View>
          </Text>
          <Pressable
            className="h-14 w-full flex-row items-center rounded-lg border-2 border-white/10 bg-bg-card px-4 active:opacity-80"
            onPress={() => setIsDatePickerVisible(true)}
          >
            <View className="ml-3 flex-1">
              <Text className={`text-base ${dob ? 'text-text-primary' : 'text-text-tertiary'}`}>
                {dob || t('editPersonalInfo.dateOfBirthPlaceholder')}
              </Text>
            </View>
            <Calendar size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
          </Pressable>
        </View>

        <View className="gap-2">
          <Text className="ml-1 text-sm font-medium text-text-secondary">
            <View className="flex-row items-center gap-1">
              <Text>{t('editPersonalInfo.gender')}</Text>
              <Text style={{ color: theme.colors.status.error }}>*</Text>
            </View>
          </Text>
          <SegmentedControl options={genderOptions} value={gender} onValueChange={setGender} />
        </View>
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
              })
            }
          />
        </View>
      ) : null}

      {/* Date Picker Modal */}
      {isDatePickerVisible ? (
        <DatePickerModal
          visible={isDatePickerVisible}
          onClose={() => setIsDatePickerVisible(false)}
          selectedDate={currentDate}
          onDateSelect={handleDateSelect}
          minYear={1900}
          maxYear={new Date().getFullYear()}
        />
      ) : null}
    </View>
  );
}
