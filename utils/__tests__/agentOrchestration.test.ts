import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';

const ROOT = path.resolve(__dirname, '../..');

// Strictest known limit of the tools that read AGENTS.md: Antigravity truncates a rule file
// at 24,000 bytes, Codex stops at `project_doc_max_bytes` (32 KiB by default). This repo's
// AGENTS.md is ~268 KB, so a policy placed later in the file is invisible to both.
const VISIBLE_BYTES = 24_000;

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

function frontmatter(file: string): Record<string, unknown> {
  return matter(read(file)).data;
}

function tomlString(file: string, key: string): string | undefined {
  // Agent files are flat, so a top-level `key = "value"` line is enough; no TOML parser needed.
  return new RegExp(`^${key}\\s*=\\s*"([^"\\n]*)"`, 'm').exec(read(file))?.[1];
}

function orchestrationSection(): { text: string; endsAtByte: number } {
  const agents = read('AGENTS.md');
  const start = agents.indexOf('## Orchestration');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = agents.indexOf('\n## ', start + 1);
  return { text: agents.slice(start, end), endsAtByte: Buffer.byteLength(agents.slice(0, end)) };
}

/** The "pins" table in AGENTS.md is the human-edited source of truth for each tool's models. */
function pins(): Record<string, { worker: string; lite: string }> {
  const rows: Record<string, { worker: string; lite: string }> = {};
  for (const line of orchestrationSection().text.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    const tool = ['Claude Code', 'Codex', 'Antigravity'].find((name) => cells[1] === name);
    if (tool) {
      const unquote = (cell: string) => cell.replace(/`/g, '');
      rows[tool] = { worker: unquote(cells[2]), lite: unquote(cells[3]) };
    }
  }
  return rows;
}

function isIgnoredByGit(file: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', file], { cwd: ROOT });
    return true; // exit 0: ignored
  } catch (error) {
    if ((error as { status?: number }).status === 1) {
      return false; // exit 1: not ignored
    }
    throw error;
  }
}

describe('multi-agent orchestration config', () => {
  it('keeps the policy where Codex and Antigravity can still read it', () => {
    const { text, endsAtByte } = orchestrationSection();
    expect(endsAtByte).toBeLessThan(VISIBLE_BYTES);
    // Codex only delegates when AGENTS.md explicitly asks for it.
    expect(text).toMatch(/explicit instruction to delegate/);
  });

  it('does not let a CLAUDE.md hide AGENTS.md from Claude Code', () => {
    // Claude Code reads AGENTS.md only when no CLAUDE.md exists in or above the working directory.
    const claudeMd = path.join(ROOT, 'CLAUDE.md');
    if (fs.existsSync(claudeMd)) {
      expect(fs.readFileSync(claudeMd, 'utf8')).toContain('@AGENTS.md');
    }
  });

  it('pins the models listed in the AGENTS.md table', () => {
    const table = pins();
    expect(Object.keys(table).sort()).toEqual(['Antigravity', 'Claude Code', 'Codex']);

    for (const name of ['worker', 'worker-lite']) {
      const lite = name === 'worker-lite';
      expect(frontmatter(`.claude/agents/${name}.md`)).toMatchObject({
        name,
        model: lite ? table['Claude Code'].lite : table['Claude Code'].worker,
      });
      expect(tomlString(`.codex/agents/${name}.toml`, 'name')).toBe(name);
      expect(tomlString(`.codex/agents/${name}.toml`, 'model')).toBe(
        lite ? table.Codex.lite : table.Codex.worker
      );
    }
    expect(frontmatter('.agents/agents/worker.md')).toMatchObject({
      name: 'worker',
      model: table.Antigravity.worker,
    });
  });

  it('puts the lite tier on a different model than the standard tier', () => {
    const table = pins();
    expect(table['Claude Code'].lite).not.toBe(table['Claude Code'].worker);
    expect(table.Codex.lite).not.toBe(table.Codex.worker);
    // Antigravity has one worker; `inherit` would silently run it on the orchestrator's model.
    expect(table.Antigravity.worker).not.toBe('inherit');
  });

  it('stops the lite workers from delegating where the tool allows it', () => {
    expect(String(frontmatter('.claude/agents/worker-lite.md').disallowedTools)).toMatch(
      /\bAgent\b/
    );

    const tools = frontmatter('.agents/agents/worker.md').tools as string[];
    expect(tools.length).toBeGreaterThan(0);
    expect(tools).not.toContain('invoke_subagent');
    expect(tools).not.toContain('define_subagent');
  });

  it('caps nesting depth and concurrency', () => {
    const { env } = JSON.parse(read('.claude/settings.json')) as { env: Record<string, string> };
    const depth = Number(env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH);
    const claudeThreads = Number(env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS);
    expect(depth).toBeGreaterThanOrEqual(1);
    expect(depth).toBeLessThanOrEqual(2);
    expect(claudeThreads).toBeGreaterThanOrEqual(1);
    expect(claudeThreads).toBeLessThanOrEqual(6);

    const codex = read('.codex/config.toml');
    expect(Number(/^max_depth\s*=\s*(\d+)/m.exec(codex)?.[1])).toBeLessThanOrEqual(2);
    expect(
      Number(/^max_concurrent_threads_per_session\s*=\s*(\d+)/m.exec(codex)?.[1])
    ).toBeLessThanOrEqual(6);
  });

  it('keeps every shared agent file out of .gitignore', () => {
    const files = [
      '.claude/settings.json',
      '.claude/agents/worker.md',
      '.claude/agents/worker-lite.md',
      '.codex/config.toml',
      '.codex/agents/worker.toml',
      '.codex/agents/worker-lite.toml',
      '.agents/agents/worker.md',
    ];
    for (const file of files) {
      expect({ file, ignored: isIgnoredByGit(file) }).toEqual({ file, ignored: false });
    }
  });
});
