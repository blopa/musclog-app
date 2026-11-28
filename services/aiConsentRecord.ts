import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { AI_CONSENT_VERSION, type AiConsentProvider, withAiConsentRecord } from '@/utils/aiConsent';
import { createSerialQueue } from '@/utils/serialQueue';

// Two consents given close together (say, two providers switched on in a row) each read the
// stored map, add their own entry and write it back. Queued, the second read sees the first write.
const consentQueue = createSerialQueue();

/** Notes that the person agreed to the current wording for this provider, and when. */
export function recordAiConsent(
  provider: AiConsentProvider,
  version: number = AI_CONSENT_VERSION
): Promise<void> {
  return consentQueue.run(async () => {
    const records = await SettingsService.get(SETTINGS.aiConsentRecords);

    await SettingsService.set(
      SETTINGS.aiConsentRecords,
      withAiConsentRecord(records ?? {}, provider, version, Date.now())
    );
  });
}
