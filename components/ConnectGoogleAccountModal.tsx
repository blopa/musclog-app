import { FullScreenModal } from './FullScreenModal';
import { ConnectGoogleAccountBody } from './ConnectGoogleAccountBody';

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
      title="Connect Google Account"
      scrollable={true}>
      <ConnectGoogleAccountBody
        onClose={onClose}
        onConnect={handleConnect}
        onMaybeLater={handleMaybeLater}
      />
    </FullScreenModal>
  );
}
