import { CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  RECOVERY,
  RECOVERY_ACTION_LABEL_KEYS,
  type RecoveryAction,
} from '@/components/aiOnboarding/recoveryActions';
import { ErrorStateCard } from '@/components/theme/ErrorStateCard';
import { TextButton } from '@/components/theme/TextButton';
import type { AiOnboardingErrorKind } from '@/utils/aiOnboarding/chatState';

type AiErrorRecoveryProps = {
  kind: AiOnboardingErrorKind;
  onAction: (action: RecoveryAction) => void;
  /** The setup is updating a profile, where "continue guided" means editing by hand. */
  profileMode?: boolean;
};

/** What went wrong in plain words, with the next steps for that failure; the first is the main one. */
export function AiErrorRecovery({ kind, onAction, profileMode = false }: AiErrorRecoveryProps) {
  const { t } = useTranslation();
  const recovery = RECOVERY[kind];
  const [primary, ...others] = recovery.actions;

  return (
    <View className="gap-3 px-4 py-3">
      <ErrorStateCard
        icon={CloudOff}
        title={t(recovery.titleKey)}
        description={t(recovery.descriptionKey)}
        buttonLabel={t(RECOVERY_ACTION_LABEL_KEYS[primary])}
        onButtonPress={() => onAction(primary)}
      />
      {others.length > 0 ? (
        <View className="items-center">
          {others.map((action) => (
            <TextButton
              key={action}
              align="center"
              label={
                action === 'continueGuided' && profileMode
                  ? t('aiOnboarding.common.editManually')
                  : t(RECOVERY_ACTION_LABEL_KEYS[action])
              }
              onPress={() => onAction(action)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
