import SHA256 from 'crypto-js/sha256';

import {
  MUSCLOG_GATEWAY_AUTH_TOKEN,
  MUSCLOG_GATEWAY_BASE_URL,
  MUSCLOG_GATEWAY_MODEL,
} from '@/constants/gateway';
import { SettingsService } from '@/database/services/SettingsService';
import { UserService } from '@/database/services/UserService';
import type { CoachAIConfig } from '@/utils/coachAI';

export class GatewayService {
  static async getOrCreateAnonymousId(): Promise<string> {
    const stored = await SettingsService.getMusclogGatewayAnonymousId();
    if (stored) {
      return stored;
    }

    const user = await UserService.getCurrentUser();
    const seed = user?.syncId ?? String(Date.now());
    const hashed = SHA256(seed).toString();

    await SettingsService.setMusclogGatewayAnonymousId(hashed);
    return hashed;
  }

  static async buildGatewayConfig(language?: string): Promise<CoachAIConfig> {
    const anonymousId = await GatewayService.getOrCreateAnonymousId();

    return {
      provider: 'gateway',
      model: MUSCLOG_GATEWAY_MODEL,
      baseUrl: MUSCLOG_GATEWAY_BASE_URL,
      language,
      gatewayAuthHeader: MUSCLOG_GATEWAY_AUTH_TOKEN,
      gatewayUserId: anonymousId,
    };
  }
}
