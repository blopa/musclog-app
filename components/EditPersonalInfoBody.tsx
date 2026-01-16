import React, { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { User, Mail, Calendar, Camera, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { TextInput } from './theme/TextInput';
import { SegmentedControl } from './theme/SegmentedControl';
import { Button } from './theme/Button';

type EditPersonalInfoBodyProps = {
  initialData?: PersonalInfo;
  onSave?: (data: PersonalInfo) => void;
};

export type PersonalInfo = {
  fullName: string;
  email: string;
  dob: string;
  gender: string;
  photoUri?: string;
};

export function EditPersonalInfoBody({ onSave, initialData }: EditPersonalInfoBodyProps) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(initialData?.fullName ?? 'Alex Johnson');
  const [email, setEmail] = useState(initialData?.email ?? 'alex.j@musclog.app');
  const [dob, setDob] = useState(initialData?.dob ?? '08/24/1995');
  const [gender, setGender] = useState(initialData?.gender ?? 'male');
  const [photoUri, setPhotoUri] = useState(
    initialData?.photoUri ??
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDMP4pkOSdWU2aOZkJVlexx1zrOe_qXxzMDD_g37zaU_CNASasle4MyPoEtd3oumlhv0RmAoGBqCmAbBRqV7372rMK-BssHEbi84ux5w7_jlHs02lymnpnknm6WQ9gYzrC0pm3U2TSxZTbiEf9MWyU0HP0iny2O5S03XlV2idMW3mwHkvGMX2C6DbOSwAIEQ-2MY4vl_sX9YshkjRYWqjrqAIHe77wRtmg6oqZZffnzXyIRyvrQFfTNkpa57ArMP6PpAyOd7VO4R2kC'
  );

  const genderOptions = [
    { label: t('editPersonalInfo.male'), value: 'male' },
    { label: t('editPersonalInfo.female'), value: 'female' },
    { label: t('editPersonalInfo.other'), value: 'other' },
  ];

  return (
    <View className="flex-1 px-4 pt-2">
      {/* Avatar Section */}
      <View className="items-center py-6">
        <View className="relative">
          <View className="h-32 w-32 overflow-hidden rounded-full border-4 border-white/10 shadow-xl">
            <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="cover" />
          </View>
          <Pressable
            className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-4 border-bg-primary bg-accent-primary active:scale-110"
            onPress={() => console.log('Change photo')}>
            <Camera size={theme.iconSize.lg} color="black" />
          </Pressable>
        </View>
        <Pressable className="mt-4" onPress={() => console.log('Change photo')}>
          <Text className="text-sm font-semibold uppercase tracking-wide text-accent-primary">
            {t('editPersonalInfo.changePhoto')}
          </Text>
        </Pressable>
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

      <View className="bg-transparent px-4 pb-6 pt-3" style={{ backgroundColor: 'transparent' }}>
        <Button
          label={t('editPersonalInfo.saveChanges')}
          icon={Check}
          variant="accent"
          size="md"
          width="full"
          onPress={() =>
            onSave?.({
              fullName,
              email,
              dob,
              gender,
              photoUri,
            })
          }
        />
      </View>
    </View>
  );
}
