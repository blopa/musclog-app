import SHA256 from 'crypto-js/sha256';
import { Platform } from 'react-native';

import {
  MUSCLOG_GATEWAY_AUTH_TOKEN,
  MUSCLOG_GATEWAY_BASE_URL,
  MUSCLOG_GATEWAY_BYOK_ALIAS,
  MUSCLOG_GATEWAY_DEV_API_KEY,
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

    // On web+__DEV__ the CORS proxy strips cf-aig-* headers before they reach
    // Cloudflare, so BYOK never fires. Pass the key directly for local testing.
    const apiKey = Platform.OS === 'web' && __DEV__ ? MUSCLOG_GATEWAY_DEV_API_KEY : undefined;

    return {
      provider: 'gateway',
      apiKey,
      model: MUSCLOG_GATEWAY_MODEL,
      baseUrl: MUSCLOG_GATEWAY_BASE_URL,
      language,
      gatewayAuthHeader: MUSCLOG_GATEWAY_AUTH_TOKEN,
      gatewayByokAlias: MUSCLOG_GATEWAY_BYOK_ALIAS,
      gatewayUserId: anonymousId,
    };
  }
}
