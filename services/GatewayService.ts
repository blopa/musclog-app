import {
  MUSCLOG_GATEWAY_AUTH_TOKEN,
  MUSCLOG_GATEWAY_BASE_URL,
  MUSCLOG_GATEWAY_MODEL,
} from '@/constants/gateway';
import type { CoachAIConfig } from '@/utils/coachAI';

export class GatewayService {
  static async buildGatewayConfig(language?: string): Promise<CoachAIConfig> {
    return {
      provider: 'gateway',
      model: MUSCLOG_GATEWAY_MODEL,
      baseUrl: MUSCLOG_GATEWAY_BASE_URL,
      apiKey: MUSCLOG_GATEWAY_AUTH_TOKEN,
      language,
    };
  }
}
