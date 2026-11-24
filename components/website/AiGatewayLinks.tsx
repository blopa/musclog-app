import { useTranslation } from 'react-i18next';

import { BODY_TEXT_SOFT, BRAND_GREEN_BRIGHT } from '@/components/website/websiteColors';
import { AI_GATEWAY_LINKS } from '@/constants/aiGatewayLinks';

/**
 * The two AI gateways Musclog Iron can forward a request through, each with its own privacy
 * policy and terms. Plain anchors, like every website link.
 */
export function AiGatewayLinks() {
  const { t } = useTranslation();

  return (
    <div className="mb-4">
      <p className="mb-2 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
        {t('common.aiGateways.intro')}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {AI_GATEWAY_LINKS.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            {t(link.labelKey)}
          </a>
        ))}
      </div>
    </div>
  );
}
