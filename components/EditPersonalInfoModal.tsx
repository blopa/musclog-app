import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
import { Button } from './theme/Button';
import { EditPersonalInfoBody } from './EditPersonalInfoBody';

type EditPersonalInfoModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: PersonalInfo) => void;
  initialData?: PersonalInfo;
};

export type PersonalInfo = {
  fullName: string;
  email: string;
  dob: string;
  gender: string;
  photoUri?: string;
};

export function EditPersonalInfoModal({
  visible,
  onClose,
  onSave,
  initialData,
}: EditPersonalInfoModalProps) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(initialData?.fullName ?? 'Alex Johnson');
  const [email, setEmail] = useState(initialData?.email ?? 'alex.j@musclog.app');
  const [dob, setDob] = useState(initialData?.dob ?? '08/24/1995');
  const [gender, setGender] = useState(initialData?.gender ?? 'male');
  const [photoUri, setPhotoUri] = useState(
    initialData?.photoUri ??
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDMP4pkOSdWU2aOZkJVlexx1zrOe_qXxzMDD_g37zaU_CNASasle4MyPoEtd3oumlhv0RmAoGBqCmAbBRqV7372rMK-BssHEbi84ux5w7_jlHs02lymnpnknm6WQ9gYzrC0pm3U2TSxZTbiEf9MWyU0HP0iny2O5S03XlV2idMW3mwHkvGMX2C6DbOSwAIEQ-2MY4vl_sX9YshkjRYWqjrqAIHe77wRtmg6oqZZffnzXyIRyvrQFfTNkpa57ArMP6PpAyOd7VO4R2kC'
  );

  const handleSave = () => {
    onSave?.({
      fullName,
      email,
      dob,
      gender,
      photoUri,
    });
    onClose();
  };

  const saveButton = (
    <View className="bg-transparent px-4 pb-6 pt-3" style={{ backgroundColor: 'transparent' }}>
      <Button
        label={t('editPersonalInfo.saveChanges')}
        icon={Check}
        variant="accent"
        size="md"
        width="full"
        onPress={handleSave}
      />
    </View>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('editPersonalInfo.title')}
      footer={saveButton}>
      <EditPersonalInfoBody initialData={initialData} />
    </FullScreenModal>
  );
}
