import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SessionFeedbackModal } from '@/components/modals/SessionFeedbackModal';
import { Button } from '@/components/theme/Button';
import { useWorkoutFeedback } from '@/hooks/useWorkoutFeedback';

/** Optional session ratings on the summary; saving never gates finishing a workout. */
export function WorkoutSessionFeedback({
  logId,
  initiallyOpen = false,
}: {
  logId: string;
  initiallyOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(initiallyOpen);
  const feedback = useWorkoutFeedback();
  return (
    <>
      <Button
        label={t('sessionFeedback.title')}
        variant="outline"
        width="full"
        onPress={() => setOpen(true)}
      />
      {open ? (
        <SessionFeedbackModal
          visible
          onClose={() => setOpen(false)}
          error={feedback.error ? t('errors.somethingWentWrong') : undefined}
          onSubmit={async (data) => {
            try {
              await feedback.submitFeedback(logId, data);
              setOpen(false);
            } catch {
              // The hook exposes the error; preserve the form for retry.
            }
          }}
        />
      ) : null}
    </>
  );
}
