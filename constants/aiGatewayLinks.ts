// The two AI gateways Musclog Iron's service can forward a request through (the Worker's D1 row
// `meta.upstream`, docs/PREMIUM_WORKER.md → The upstream toggle). The Iron consent covers both, so
// every surface that names them links each one's own privacy policy and terms, from this one list:
// the Musclog Iron screen in the app and the website's privacy, terms and /premium pages.
// The free Musclog AI option goes through OpenRouter only and is not described by this list.

export type AiGatewayLink = {
  /** Stable id, also the React key. */
  id: 'openrouter-privacy' | 'openrouter-terms' | 'otari-privacy' | 'otari-terms';
  /** Whole translation key (common.json), so check-translations sees it. */
  labelKey:
    | 'common.aiGateways.openrouterPrivacy'
    | 'common.aiGateways.openrouterTerms'
    | 'common.aiGateways.otariPrivacy'
    | 'common.aiGateways.otariTerms';
  url: string;
};

export const AI_GATEWAY_LINKS: readonly AiGatewayLink[] = [
  {
    id: 'openrouter-privacy',
    labelKey: 'common.aiGateways.openrouterPrivacy',
    url: 'https://openrouter.ai/privacy',
  },
  {
    id: 'openrouter-terms',
    labelKey: 'common.aiGateways.openrouterTerms',
    url: 'https://openrouter.ai/terms',
  },
  {
    id: 'otari-privacy',
    labelKey: 'common.aiGateways.otariPrivacy',
    url: 'https://otari.ai/privacy',
  },
  {
    id: 'otari-terms',
    labelKey: 'common.aiGateways.otariTerms',
    url: 'https://otari.ai/terms',
  },
];
