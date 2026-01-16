import { useTranslation } from 'react-i18next';
import { FullScreenModal } from './FullScreenModal';
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

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('editPersonalInfo.title')}>
      <EditPersonalInfoBody initialData={initialData} onSave={handleSave} />
    </FullScreenModal>
  );
}
