import { GITHUB_REPO_URL, SUPPORT_EMAIL } from '@/constants/misc';

import { type AppBuildInfo, formatAppVersion } from './appVersionLabel';

export type FeedbackKind = 'bug' | 'feature';

export interface FeedbackEnvironment extends AppBuildInfo {
  /** The app language, e.g. "pt-BR". */
  locale: string;
}

const ISSUE_TEMPLATES: Record<FeedbackKind, { template: string; titlePrefix: string }> = {
  bug: { template: 'bug_report.yml', titlePrefix: '[Bug] ' },
  feature: { template: 'feature_request.yml', titlePrefix: '[Feature] ' },
};

function platformLabel(env: FeedbackEnvironment): string {
  return env.osVersion ? `${env.platform} ${env.osVersion}` : env.platform;
}

/**
 * A GitHub new-issue link for the matching issue form. GitHub fills a form field from the query
 * parameter that has the same name as the field's `id`, so `version`, `platform` and `locale` here
 * must stay equal to the ids in `.github/ISSUE_TEMPLATE/*.yml` (pinned by the test). The link only
 * opens a page in the user's browser: nothing is sent until they submit it themselves.
 */
export function buildIssueUrl(kind: FeedbackKind, env: FeedbackEnvironment): string {
  const { template, titlePrefix } = ISSUE_TEMPLATES[kind];
  const params = new URLSearchParams({
    template,
    title: titlePrefix,
    version: formatAppVersion(env),
    platform: platformLabel(env),
    locale: env.locale,
  });
  return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`;
}

/** A support email with the environment as a short block the user can read before sending. */
export function buildSupportMailto(env: FeedbackEnvironment): string {
  const subject = `Musclog ${formatAppVersion(env)} support`;
  const body = [
    '',
    '',
    '---',
    `App version: ${formatAppVersion(env)}`,
    `Platform: ${platformLabel(env)}`,
    `Language: ${env.locale}`,
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
