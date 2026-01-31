import { useTranslation } from 'react-i18next';

import { ConnectGoogleAccountBody } from '../ConnectGoogleAccountBody';
import { FullScreenModal } from './FullScreenModal';

// Illustration Component
type ConnectGoogleAccountModalProps = {
  visible: boolean;
  onClose: () => void;
  onConnect?: () => void;
  onMaybeLater?: () => void;
};

export function ConnectGoogleAccountModal({
  visible,
  onClose,
  onConnect,
  onMaybeLater,
}: ConnectGoogleAccountModalProps) {
  const { t } = useTranslation();
  // Google logo URL from the HTML
  const handleConnect = () => {
    onConnect?.();
    onClose();
  };

  const handleMaybeLater = () => {
    onMaybeLater?.();
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('connectGoogleAccount.title')}
      scrollable={true}
    >
      <ConnectGoogleAccountBody
        onClose={onClose}
        onConnect={handleConnect}
        onMaybeLater={handleMaybeLater}
      />
    </FullScreenModal>
  );
}
