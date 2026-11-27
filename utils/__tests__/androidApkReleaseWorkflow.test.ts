import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const workflow = read('.github/workflows/release-android-apk.yml');

/** The text of one job, from its key to the next job. */
function job(name: string): string {
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n'));
  const match = jobs.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  \\w+:\\n|$)`));
  if (!match) {
    throw new Error(`No job named ${name}`);
  }

  return match[1];
}

/** The `run: |` script of the step with this name, dedented, so a test can execute it. */
function script(stepName: string): string {
  const step = workflow.split(`- name: ${stepName}\n`)[1]?.split('\n      - name: ')[0];
  const block = step?.split(/^\s+run: \|\n/m)[1];
  if (!block) {
    throw new Error(`No script in step ${stepName}`);
  }

  const lines = block.split('\n');
  const end = lines.findIndex((line) => line.trim() !== '' && !line.startsWith('          '));

  return lines
    .slice(0, end === -1 ? undefined : end)
    .map((line) => line.slice(10))
    .join('\n');
}

let sandbox: string;

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-release-'));
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

// GitHub runs a `run` step with `bash -e`.
function runScript(source: string, cwd: string, env: Record<string, string>) {
  return spawnSync('bash', ['-e', '-c', source], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('release-android-apk workflow', () => {
  it('only runs by hand, and only on main', () => {
    expect(workflow).toContain('\non:\n  workflow_dispatch:\n\npermissions:');
    expect(job('version')).toContain("if: github.ref != 'refs/heads/main'");
  });

  describe('looking for the tag', () => {
    let clone: string;

    const git = (cwd: string, ...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
        cwd,
        env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' },
        stdio: 'pipe',
      });

    beforeEach(() => {
      const remote = path.join(sandbox, 'remote');
      clone = path.join(sandbox, 'clone');
      fs.mkdirSync(remote);
      fs.mkdirSync(clone);
      git(remote, 'init', '-q');
      git(remote, 'commit', '-q', '--allow-empty', '-m', 'one');
      git(remote, 'tag', '2.18.10');
      git(clone, 'init', '-q');
      git(clone, 'remote', 'add', 'origin', remote);
    });

    const lookFor = (version: string) => {
      const output = path.join(sandbox, 'output');
      const result = runScript(script("Look for the version's tag"), clone, {
        VERSION: version,
        GITHUB_OUTPUT: output,
      });

      return {
        status: result.status,
        output: fs.existsSync(output) ? fs.readFileSync(output, 'utf8').trim() : '',
      };
    };

    it('stops at a version that is already tagged', () => {
      expect(lookFor('2.18.10')).toEqual({ status: 0, output: 'tag_exists=true' });
    });

    it('goes on for an untagged version, even one that is a prefix of a tag', () => {
      expect(lookFor('2.18.1')).toEqual({ status: 0, output: 'tag_exists=false' });
    });

    it('fails, rather than building, when the tags cannot be listed', () => {
      git(clone, 'remote', 'set-url', 'origin', path.join(sandbox, 'missing'));

      const { status, output } = lookFor('2.18.10');

      expect(status).not.toBe(0);
      expect(output).toBe('');
    });
  });

  it('builds the APK profile only for an untagged version', () => {
    expect(job('build')).toContain("if: needs.version.outputs.tag_exists == 'false'");
    expect(job('build')).toContain('--profile production-apk');
    expect(JSON.parse(read('eas.json')).build['production-apk'].android.buildType).toBe('apk');
  });

  describe('signature check', () => {
    const check = (signerLine: string) => {
      const tools = path.join(sandbox, 'sdk/build-tools/37.0.0');
      fs.mkdirSync(tools, { recursive: true });
      fs.writeFileSync(path.join(tools, 'apksigner'), `#!/bin/sh\necho '${signerLine}'\n`, {
        mode: 0o755,
      });
      fs.mkdirSync(path.join(sandbox, 'out'), { recursive: true });
      fs.writeFileSync(path.join(sandbox, 'out/app.apk'), '');

      return runScript(script('Check the APK is release-signed'), sandbox, {
        ANDROID_HOME: path.join(sandbox, 'sdk'),
        RUNNER_TEMP: sandbox,
        APK: 'app.apk',
      }).status;
    };

    it.each([
      'Signer #1 certificate DN: CN=Musclog, O=Jubinganga',
      'V2 Signer: certificate DN: CN=Musclog, O=Jubinganga',
    ])('accepts a release key (%s)', (line) => {
      expect(check(line)).toBe(0);
    });

    it.each([
      'Signer #1 certificate DN: C=US, O=Android, CN=Android Debug',
      'V2 Signer: certificate DN: CN=Android Debug, OU=Android, O=Unknown',
      'Verified using v2 scheme: false',
    ])('refuses a debug key or no signer (%s)', (line) => {
      expect(check(line)).not.toBe(0);
    });
  });

  it('writes to the repository only after the build, from the release job', () => {
    expect(workflow.match(/contents: write/g)).toHaveLength(1);
    expect(job('release')).toContain('contents: write');
    expect(job('release')).toContain('needs: [version, build]');
    expect(job('release')).toMatch(
      /gh release create "\$VERSION" "\$APK" \\\n\s+--target "\$GITHUB_SHA"/
    );
    expect(`${job('version')}${job('build')}`).not.toMatch(
      /git tag |git push|gh release create|git\/refs/
    );
  });
});
