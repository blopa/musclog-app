import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { AI_CONSENT_VERSION, type AiConsentProvider, withAiConsentRecord } from '@/utils/aiConsent';

/** Notes that the person agreed to the current wording for this provider, and when. */
export async function recordAiConsent(
  provider: AiConsentProvider,
  version: number = AI_CONSENT_VERSION
): Promise<void> {
  const records = await SettingsService.get(SETTINGS.aiConsentRecords);

  await SettingsService.set(
    SETTINGS.aiConsentRecords,
    withAiConsentRecord(records ?? {}, provider, version, Date.now())
  );
}
