import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOW = '.github/workflows/premium-checks.yml';

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const raw = read(WORKFLOW);
// Comments explain the rules (and name what is forbidden), so rules apply to what runs.
const code = raw
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .map((line) => line.replace(/\s+#\s.*$/, ''))
  .join('\n');

// The script's own name says "deploy"; it is only ever run as a dry run (checked below).
const withoutScriptName = code.split('premium-deploy.sh').join('');

describe('premium-checks workflow (checks only, never an apply or a deploy)', () => {
  it.each([
    ['apply', /apply/i],
    ['deploy', /deploy/i],
    ['a secrets context', /secrets\./i],
    ['Cloudflare', /CLOUDFLARE/i],
    ['OpenRouter', /OPENROUTER/i],
    ['RevenueCat', /REVENUECAT/i],
    ['pull_request_target', /pull_request_target/],
  ])('never mentions %s', (_name, pattern) => {
    expect(withoutScriptName).not.toMatch(pattern);
  });

  it('runs scripts/premium-deploy.sh only as a dry run', () => {
    // shellcheck names the file too; only a line that passes an environment runs it.
    const invocations = code
      .split('\n')
      .filter((line) => /premium-deploy\.sh\s+\S+/.test(line) && /run:\s+scripts\//.test(line));

    expect(invocations.length).toBeGreaterThanOrEqual(2);
    expect(invocations.every((line) => line.includes('--dry-run'))).toBe(true);
    expect(invocations.some((line) => line.includes(' staging '))).toBe(true);
    expect(invocations.some((line) => line.includes(' production '))).toBe(true);
  });

  it('runs scripts/premium-upstream.sh only as a dry run, never with --yes', () => {
    const invocations = code
      .split('\n')
      .filter((line) => /premium-upstream\.sh\s+\S+/.test(line) && /run:\s+scripts\//.test(line));

    expect(invocations).toHaveLength(2);
    expect(invocations.some((line) => /\bstaging status --dry-run$/.test(line.trim()))).toBe(true);
    expect(invocations.some((line) => /\bproduction status --dry-run$/.test(line.trim()))).toBe(
      true
    );
    expect(invocations.some((line) => /--yes|--consent-ready/.test(line))).toBe(false);
  });

  it('shellchecks both scripts at warning severity', () => {
    expect(code).toContain(
      'shellcheck --severity=warning scripts/premium-deploy.sh scripts/premium-upstream.sh'
    );
  });

  it('pins every action by a full commit SHA', () => {
    const uses = [...code.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)].map((match) => match[1]);

    expect(uses.length).toBeGreaterThan(0);
    for (const ref of uses) {
      expect(ref).toMatch(/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/);
    }
  });

  it('is read-only and cancels superseded runs', () => {
    expect(code).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(code.match(/permissions:/g)).toHaveLength(1);
    expect(code).toMatch(/^concurrency:[\s\S]*?cancel-in-progress: true/m);
    expect(code).toContain('persist-credentials: false');
  });

  it('runs on the files the Premium Worker owns', () => {
    for (const trigger of ['pull_request:', 'push:']) {
      expect(code).toContain(trigger);
    }
    for (const filePath of [
      'services/premium-worker/**',
      'infra/premium/**',
      'scripts/premium-deploy.sh',
      'scripts/premium-upstream.sh',
      'docs/PREMIUM_WORKER.md',
      WORKFLOW,
    ]) {
      // Once under pull_request and once under push.
      expect(code.split(`'${filePath}'`)).toHaveLength(3);
    }
  });

  it('runs the worker checks and the OpenTofu checks without a backend', () => {
    for (const command of [
      'npm --prefix services/premium-worker ci',
      'npm --prefix services/premium-worker test',
      'npm --prefix services/premium-worker run typecheck',
      'tofu -chdir=infra/premium init -backend=false',
      'tofu -chdir=infra/premium fmt -check',
      'tofu -chdir=infra/premium validate',
    ]) {
      expect(code).toContain(command);
    }
  });

  it('uses the Node version eas.json pins', () => {
    const { build } = JSON.parse(read('eas.json')) as { build: Record<string, { node?: string }> };
    const easNode = build.base.node;
    const versions = [...code.matchAll(/node-version:\s*'?([\w.]+)'?/g)].map((match) => match[1]);

    expect(easNode).toMatch(/^\d+\.\d+\.\d+$/);
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(version).toBe(easNode);
    }
  });

  it('uses an OpenTofu version infra/premium accepts', () => {
    const required = read('infra/premium/versions.tf').match(
      /required_version\s*=\s*"~>\s*(\d+)\.(\d+)"/
    );
    const versions = [...code.matchAll(/tofu_version:\s*'?([\w.]+)'?/g)].map((match) => match[1]);

    expect(required).not.toBeNull();
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      // "~> 1.13" allows 1.13 and every later 1.x.
      const [major, minor] = version.split('.').map(Number);
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(major).toBe(Number(required![1]));
      expect(minor).toBeGreaterThanOrEqual(Number(required![2]));
    }
  });
});
