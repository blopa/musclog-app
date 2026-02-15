import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EditPersonalInfoBody, type PersonalInfo } from '../EditPersonalInfoBody';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

type EditPersonalInfoModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: PersonalInfo & { photoUri?: string }) => void;
  initialData?: PersonalInfo & { photoUri?: string };
};

export function EditPersonalInfoModal({
  visible,
  onClose,
  onSave,
  initialData,
}: EditPersonalInfoModalProps) {
  const { t } = useTranslation();
  const [currentFormData, setCurrentFormData] = useState<(PersonalInfo & { photoUri?: string }) | undefined>(undefined);

  const handleSave = ({
    fullName,
    email,
    dob,
    gender,
    photoUri,
    avatarIcon,
    avatarColor,
  }: PersonalInfo & { photoUri?: string }) => {
    onSave?.({
      fullName,
      email,
      dob,
      gender,
      photoUri,
      avatarIcon,
      avatarColor,
    });
    onClose();
  };

  const handleFloatingSave = () => {
    if (currentFormData) {
      handleSave(currentFormData);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('editPersonalInfo.title')}
      footer={
        <Button
          label={t('editPersonalInfo.saveChanges')}
          icon={Check}
          variant="gradientCta"
          size="md"
          width="full"
          onPress={handleFloatingSave}
        />
      }
    >
      <EditPersonalInfoBody
        initialData={initialData}
        onSave={handleSave}
        onFormChange={setCurrentFormData}
        hideSaveButton
      />
    </FullScreenModal>
  );
}
