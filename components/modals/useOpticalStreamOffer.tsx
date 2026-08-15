import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OpticalCameraHintCard } from '@/components/optical/OpticalCameraHintCard';
import { Button } from '@/components/theme/Button';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';

import { OpticalReceiveModal } from './OpticalReceiveModal';

/**
 * The "you are pointing a food scanner at an optical transfer" offer.
 *
 * Returns two elements because they belong in two different places: `notice` goes in
 * `SmartCameraShell`'s `noticeSlot`, and `receiver` goes in its `children` — never as a sibling of
 * the camera modal, or iOS presents it from the wrong controller and it silently never appears
 * (see `FIXES.md`). `isReceiveVisible` is returned so the host can add it to
 * the list of child modals that put the camera to sleep.
 *
 * `accept="share"` rather than `"any"`, and not because a scanner can tell the two apart — it
 * cannot. `payloadKind` lives in the container, which does not exist until the whole stream has
 * been reassembled. The choice is that a full-backup restore WIPES this phone, and a wipe is not
 * something to offer from a camera the user opened to scan a cereal box. Refusing it here costs a
 * user who genuinely wants that nothing: the receive screen names the right place to go
 * ("Receive it from Settings → Optical Transfer instead").
 */
export function useOpticalStreamOffer(options: {
  /** The camera modal's own `visible`, so the offer resets with it. */
  hostVisible: boolean;
  /** From `useBarcodeScanner`: a stream has been confirmed and not yet dismissed. */
  detected: boolean;
  onDismiss: () => void;
  /** Closes the whole camera modal — the user has moved on to a different job. */
  onFinished: () => void;
}) {
  const { detected, hostVisible, onDismiss, onFinished } = options;
  const { t } = useTranslation();
  const [isReceiveVisible, setIsReceiveVisible] = useSubModalVisibility(hostVisible);

  const handleOpen = useCallback(() => setIsReceiveVisible(true), [setIsReceiveVisible]);

  const handleReceiveClose = useCallback(() => {
    setIsReceiveVisible(false);
    onFinished();
  }, [onFinished, setIsReceiveVisible]);

  const notice =
    detected && !isReceiveVisible ? (
      <OpticalCameraHintCard
        message={t('opticalTransfer.probe.message')}
        title={t('opticalTransfer.probe.title')}
      >
        <View className="flex-row gap-2">
          <Button
            label={t('opticalTransfer.probe.dismiss')}
            onPress={onDismiss}
            size="xs"
            variant="outline"
            width="flex-1"
          />
          <Button
            label={t('opticalTransfer.probe.open')}
            onPress={handleOpen}
            size="xs"
            variant="accent"
            width="flex-2"
          />
        </View>
      </OpticalCameraHintCard>
    ) : null;

  const receiver = isReceiveVisible ? (
    <OpticalReceiveModal accept="share" onClose={handleReceiveClose} visible={isReceiveVisible} />
  ) : null;

  return { isReceiveVisible, notice, receiver };
}
