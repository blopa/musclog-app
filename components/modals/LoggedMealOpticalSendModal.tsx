import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type NutritionLog from '@/database/models/NutritionLog';
import { buildLoggedMealSharePayload } from '@/database/share/buildLoggedMealShare';

import { ShareOpticalSendModal } from './ShareOpticalSendModal';

interface LoggedMealOpticalSendModalProps {
  visible: boolean;
  onClose: () => void;
  logs: NutritionLog[];
  /** What the receiver will see the meal called — the diary section's label. */
  name: string;
}

/**
 * Sends a meal the user logged (a diary section) as a meal the receiver can save. There is no photo
 * toggle: a logged meal has no photo of its own, and its ingredients' photos are not what the user
 * asked to send.
 */
export function LoggedMealOpticalSendModal({
  visible,
  onClose,
  logs,
  name,
}: LoggedMealOpticalSendModalProps) {
  const { t } = useTranslation();
  const buildPayload = useCallback(
    () => buildLoggedMealSharePayload(logs, { name }),
    [logs, name]
  );
  const copy = useMemo(
    () => ({
      instructions: t('opticalTransfer.share.sendMealInstructions'),
      readyTitle: t('opticalTransfer.share.sendMealReadyTitle'),
      title: t('opticalTransfer.share.sendMealTitle'),
    }),
    [t]
  );

  return (
    <ShareOpticalSendModal
      buildPayload={buildPayload}
      copy={copy}
      onClose={onClose}
      visible={visible}
    />
  );
}
