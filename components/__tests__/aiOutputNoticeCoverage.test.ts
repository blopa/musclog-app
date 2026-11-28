import { readFileSync } from 'fs';
import { join } from 'path';

import { AI_OUTPUT_NOTICE_KEYS } from '@/components/ai/aiOutputNoticeCopy';
import enAi from '@/lang/locales/en-us/ai.json';

// AI output is labelled wherever it reaches the person, and every consent that turns on an AI
// option Musclog runs ends with the accuracy acknowledgement the Terms refer to. Source-level, so a
// refactor that drops a notice or the consent paragraph fails here. A new AI surface joins a list.

const ROOT = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\s+/g, ' ');

/** Where AI output (or the switch that turns an AI option on) is shown, and the notice it uses. */
const NOTICE_SURFACES: readonly [file: string, kind: string][] = [
  ['components/modals/CoachModal.tsx', 'kind="chat"'],
  ['components/modals/LogMealModal.tsx', 'kind="estimate"'],
  ['components/modals/AINutritionTrackingContextModal.tsx', 'kind="estimate"'],
  ['components/modals/ExternalFoodLogModal.tsx', 'kind="estimate"'],
  ['components/modals/GenerateWorkoutWithAiModal.tsx', 'kind="plan"'],
  ['components/modals/ExternalWorkoutPlanModal.tsx', 'kind="plan"'],
  ['components/modals/ImportWorkoutsModal.tsx', 'kind="import"'],
  ['components/aiOnboarding/ReviewScaffold.tsx', 'kind="import"'],
  ['components/modals/AIBehaviorSettingsModal.tsx', 'kind="insight"'],
  ['components/modals/AISettingsModal.tsx', 'kind="settings"'],
  ['components/modals/AINotConfiguredModal.tsx', 'kind="settings"'],
  ['app/app/onboarding/musclog-api.tsx', 'kind="settings"'],
  ['app/app/onboarding/ai-provider.tsx', 'kind="settings"'],
  ['app/app/onboarding/on-device-ai.tsx', 'kind="settings"'],
];

/** Consents for an AI option Musclog runs: each message ends with the accuracy paragraph. */
const CONSENTS: readonly [file: string, bodyKey: string][] = [
  ['components/modals/PremiumModal.tsx', 'premium.consent.body'],
  [
    'components/modals/AiProviderConsentModal.tsx',
    'settings.aiSettings.musclogFreeTier.consentBody',
  ],
];

/** Screens that turn an AI option on through the shared consent question. */
const CONSENT_SCREENS = [
  'components/modals/AISettingsModal.tsx',
  'app/app/onboarding/ai-provider.tsx',
];

describe('AI output notice coverage', () => {
  it('every notice kind has English copy', () => {
    const notices = enAi.ai.outputNotice as Record<string, string>;

    for (const key of Object.values(AI_OUTPUT_NOTICE_KEYS)) {
      const leaf = key.replace('ai.outputNotice.', '');

      expect(notices[leaf]?.trim()).toBeTruthy();
    }
  });

  it.each(NOTICE_SURFACES)('%s shows the AI notice (%s)', (file, kind) => {
    const source = read(file);

    expect(source).toContain('<AiOutputNotice');
    expect(source).toContain(kind);
  });

  it('the AI label scan passes its notice to the food details sheet', () => {
    expect(read('components/modals/SmartCameraModal.tsx')).toContain(
      "aiOutputKind={productFromAiLabel ? 'import' : undefined}"
    );
    expect(read('components/modals/FoodMealTrackingDetailsModal.tsx')).toContain(
      '<AiOutputNotice kind={aiOutputKind} />'
    );
  });

  it('the chat-message editor says an edit changes what the history shows', () => {
    expect(read('components/modals/DataLogModal.tsx')).toContain(
      "hint={variant === 'chatMessage' ? t('ai.disclaimer.editHint') : undefined}"
    );
  });

  it.each(CONSENTS)('%s ends its consent with the accuracy paragraph', (file, bodyKey) => {
    // Line breaks differ between call sites, so compare with every space removed.
    const compact = read(file).replace(/\s/g, '');

    expect(compact).toContain(`withAiAccuracyConsent(t('${bodyKey}'),t(AI_ACCURACY_CONSENT_KEY))`);
  });

  it.each(CONSENT_SCREENS)('%s asks through the shared consent question', (file) => {
    expect(read(file)).toContain('<AiProviderConsentModal');
  });

  it('own-provider consents end with the accuracy paragraph too', () => {
    expect(read('components/modals/AiProviderConsentModal.tsx').replace(/\s/g, '')).toContain(
      'withAiAccuracyConsent(ownBody,t(AI_ACCURACY_CONSENT_KEY))'
    );
  });

  it('the onboarding free-tier notice carries the accuracy paragraph', () => {
    expect(read('app/app/onboarding/musclog-api.tsx')).toContain('t(AI_ACCURACY_CONSENT_KEY)');
  });

  it('the coach no longer has its own one-line disclaimer', () => {
    expect(read('components/modals/CoachModal.tsx')).not.toContain("t('coach.disclaimer')");
  });
});
