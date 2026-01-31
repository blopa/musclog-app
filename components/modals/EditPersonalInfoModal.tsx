import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';
import { EditPersonalInfoBody } from '../EditPersonalInfoBody';

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
  const [currentFormData, setCurrentFormData] = useState<PersonalInfo | undefined>(undefined);

  const handleSave = ({ fullName, email, dob, gender, photoUri }: PersonalInfo) => {
    onSave?.({
      fullName,
      email,
      dob,
      gender,
      photoUri,
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
