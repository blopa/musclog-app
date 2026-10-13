import fs from 'node:fs';
import path from 'node:path';

import { GITHUB_REPO_URL, SUPPORT_EMAIL } from '@/constants/misc';
import { formatAppVersion } from '@/utils/appVersionLabel';
import { buildIssueUrl, buildSupportMailto, type FeedbackEnvironment } from '@/utils/feedbackLinks';

const env: FeedbackEnvironment = {
  appVersion: '2.12.3',
  buildNumber: 270,
  platform: 'android',
  osVersion: '15',
  locale: 'pt-BR',
};

const templateDir = path.join(__dirname, '../../.github/ISSUE_TEMPLATE');
const readTemplate = (file: string) => fs.readFileSync(path.join(templateDir, file), 'utf8');

describe('buildIssueUrl', () => {
  it('points at the matching issue form of the project repository', () => {
    const bug = new URL(buildIssueUrl('bug', env));
    const feature = new URL(buildIssueUrl('feature', env));

    expect(`${bug.origin}${bug.pathname}`).toBe(`${GITHUB_REPO_URL}/issues/new`);
    expect(bug.searchParams.get('template')).toBe('bug_report.yml');
    expect(feature.searchParams.get('template')).toBe('feature_request.yml');
  });

  it('pre-fills version, platform and language, and nothing else about the user', () => {
    const url = new URL(buildIssueUrl('bug', env));

    expect(url.searchParams.get('version')).toBe('2.12.3 (Build 270)');
    expect(url.searchParams.get('platform')).toBe('android 15');
    expect(url.searchParams.get('locale')).toBe('pt-BR');
    expect([...url.searchParams.keys()].sort()).toEqual(
      ['locale', 'platform', 'template', 'title', 'version'].sort()
    );
  });

  it('URL-encodes values that need it and omits an absent build number', () => {
    const url = buildIssueUrl('bug', {
      ...env,
      buildNumber: null,
      platform: 'web',
      osVersion: '',
      locale: 'en US&x=1',
    });

    expect(url).toContain('locale=en+US%26x%3D1');
    expect(new URL(url).searchParams.get('version')).toBe('2.12.3');
    expect(new URL(url).searchParams.get('platform')).toBe('web');
  });

  // GitHub fills a form field from the query parameter named after the field's `id`.
  it.each([
    ['bug', 'bug_report.yml'],
    ['feature', 'feature_request.yml'],
  ] as const)('only pre-fills field ids that exist in the %s template', (kind, file) => {
    const ids = [...readTemplate(file).matchAll(/^\s+id: (\w+)$/gm)].map((m) => m[1]);
    const prefilled = ['version', 'platform', 'locale'];

    for (const key of prefilled) {
      expect(ids).toContain(key);
    }
    expect(new URL(buildIssueUrl(kind, env)).searchParams.has('version')).toBe(true);
  });
});

describe('buildSupportMailto', () => {
  const url = buildSupportMailto(env);
  const query = new URLSearchParams(url.slice(url.indexOf('?') + 1));

  it('addresses the support mailbox', () => {
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);
  });

  it('carries the version, platform and language in a readable body and nothing else', () => {
    expect(query.get('subject')).toBe('Musclog 2.12.3 (Build 270) support');
    expect(query.get('body')).toBe(
      '\n\n---\nApp version: 2.12.3 (Build 270)\nPlatform: android 15\nLanguage: pt-BR'
    );
  });
});

describe('issue template configuration', () => {
  it('keeps the email in config.yml equal to the SUPPORT_EMAIL constant', () => {
    expect(readTemplate('config.yml')).toContain(`mailto:${SUPPORT_EMAIL}`);
  });

  it('declares a required version and platform on the bug form', () => {
    expect(readTemplate('bug_report.yml')).toMatch(/id: version[\s\S]*?required: true/);
  });
});

describe('formatAppVersion', () => {
  it('appends the build only when there is one', () => {
    expect(formatAppVersion({ appVersion: '1.0.0', buildNumber: 7 })).toBe('1.0.0 (Build 7)');
    expect(formatAppVersion({ appVersion: '1.0.0', buildNumber: null })).toBe('1.0.0');
  });
});
