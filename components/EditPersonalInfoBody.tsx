import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { User, Mail, Calendar, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { TextInput } from './theme/TextInput';
import { SegmentedControl } from './theme/SegmentedControl';
import { Button } from './theme/Button';
import { AvatarSelector } from './AvatarSelector';
import { AvatarIcon } from '../types/AvatarIcon';
import { AvatarColor } from '../types/AvatarColor';

type EditPersonalInfoBodyProps = {
  initialData?: PersonalInfo;
  onSave?: (data: PersonalInfo) => void;
  onFormChange?: (data: PersonalInfo) => void;
  isLoading?: boolean;
  hideSaveButton?: boolean;
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
}: EditPersonalInfoBodyProps) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(initialData?.fullName ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [dob, setDob] = useState(initialData?.dob ?? '');
  const [gender, setGender] = useState(initialData?.gender ?? 'male');
  const [avatarIcon, setAvatarIcon] = useState<AvatarIcon>(initialData?.avatarIcon ?? 'person');
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(
    initialData?.avatarColor ?? 'emerald'
  );

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
    { label: t('editPersonalInfo.male'), value: 'male' },
    { label: t('editPersonalInfo.female'), value: 'female' },
    { label: t('editPersonalInfo.other'), value: 'other' },
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
          label={t('editPersonalInfo.fullName')}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('editPersonalInfo.fullNamePlaceholder')}
          icon={<User size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
        />

        <TextInput
          label={t('editPersonalInfo.emailAddress')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('editPersonalInfo.emailPlaceholder')}
          keyboardType="email-address"
          icon={<Mail size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
        />

        <TextInput
          label={t('editPersonalInfo.dateOfBirth')}
          value={dob}
          onChangeText={setDob}
          placeholder={t('editPersonalInfo.dateOfBirthPlaceholder')}
          icon={<Calendar size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
        />

        <View className="gap-2">
          <Text className="ml-1 text-sm font-medium text-text-secondary">
            {t('editPersonalInfo.gender')}
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
    </View>
  );
}
