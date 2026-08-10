import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { OpticalSenderPayload } from '@/hooks/useOpticalSender';
import { MusclogShareError } from '@/utils/share/shareEnvelope';

import { OpticalSendModal } from './OpticalSendModal';

interface ShareOpticalSendModalProps {
  visible: boolean;
  onClose: () => void;
  buildPayload: (options: { includeImage: boolean }) => Promise<OpticalSenderPayload>;
  /** Offers the "include the photo" toggle. Only pass it when there is a photo to include. */
  hasImage?: boolean;
  copy: { title: string; readyTitle: string; instructions: string };
}

/**
 * The send screen for one shared record, whatever the record is.
 *
 * Every share sender differs in exactly three things — the builder, the three strings, and whether
 * there is a photo to offer — so the per-kind wrappers around this one supply those and nothing
 * else. What lives here is the part that must not diverge between them: translating the builder's
 * typed "nothing to send" failure. It is matched on the code, never on the message text, because
 * the send screen renders whatever the builder throws and a reworded English string used to drop
 * the user into a generic failure with no way to tell what was wrong.
 */
export function ShareOpticalSendModal({
  visible,
  onClose,
  buildPayload,
  hasImage = false,
  copy,
}: ShareOpticalSendModalProps) {
  const { t } = useTranslation();

  const build = useCallback(
    async (options: { includeImage: boolean }) => {
      try {
        return await buildPayload(options);
      } catch (error) {
        if (error instanceof MusclogShareError && error.code === 'no-ingredients') {
          throw new Error(t('opticalTransfer.share.noIngredients'));
        }
        throw error;
      }
    },
    [buildPayload, t]
  );

  const labels = useMemo(
    () => ({ ...copy, buildingStep: t('opticalTransfer.share.buildingStep') }),
    [copy, t]
  );

  return (
    <OpticalSendModal
      buildPayload={build}
      copy={labels}
      hasPhoto={hasImage}
      onClose={onClose}
      visible={visible}
    />
  );
}
