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

/** The longest reply quoted in a report mail: mail clients refuse very long `mailto:` links. */
export const AI_REPLY_REPORT_MAX_CHARS = 1500;

/**
 * A support email that reports one AI reply. The reply text is quoted in the body for the person to
 * read, edit or delete before sending; nothing is sent by the app. `subject` and `intro` arrive
 * translated, the environment block stays in English like the support mail's.
 */
export function buildAiReplyReportMailto(
  env: FeedbackEnvironment,
  copy: { subject: string; intro: string; reply: string }
): string {
  const reply =
    copy.reply.length > AI_REPLY_REPORT_MAX_CHARS
      ? `${copy.reply.slice(0, AI_REPLY_REPORT_MAX_CHARS)}…`
      : copy.reply;
  const body = [
    copy.intro,
    '',
    '',
    '---',
    reply,
    '---',
    `App version: ${formatAppVersion(env)}`,
    `Platform: ${platformLabel(env)}`,
    `Language: ${env.locale}`,
  ].join('\n');

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(copy.subject)}&body=${encodeURIComponent(body)}`;
}
