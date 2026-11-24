const path = require('node:path');
const {
  API,
  ROOT,
  buildQuery,
  summaryPath,
  buildReport,
  formatText,
  parseArgs,
  expectedProvidersFromEnv,
} = require('../infra/otari');

const summary = {
  start_date: '2026-10-24T00:00:00Z',
  end_date: '2026-11-23T00:00:00Z',
  bucket: 'day',
  totals: {
    cost: 1.25,
    request_count: 200,
    error_count: 5,
    unpriced_requests: 0,
    avg_latency_ms: 812.4,
    prompt_tokens: 10000,
    completion_tokens: 2000,
    total_tokens: 12000,
  },
  by_model: [{ key: 'm1', label: 'openai/gpt-x', cost: 1.0, requests: 150, tokens: 9000 }],
  by_provider: [{ key: 'p1', label: 'openai', cost: 1.25, requests: 200, tokens: 12000 }],
  errors_by_status_code: [{ status_code: 429, error_class: 'rate', requests: 5 }],
};

const budget = { budgets_enforced: true, remaining_usd: 14.5, limits: [], end_users: null };

describe('buildQuery and summaryPath', () => {
  it('repeats dimensions and tag keys and drops empty values', () => {
    expect(buildQuery({ a: null, dimensions: ['model', 'provider'], tag: ['feature:chat'] })).toBe(
      '?dimensions=model&dimensions=provider&tag=feature%3Achat'
    );
    expect(buildQuery({ a: undefined })).toBe('');
  });

  it('builds a usage summary path with the env and feature tags', () => {
    const p = summaryPath({
      start: '2026-10-24T00:00:00.000Z',
      end: '2026-11-23T00:00:00.000Z',
      dimensions: ['model', 'provider', 'status_code'],
      tags: ['env:production'],
    });
    expect(p.startsWith('/key/usage/summary?start_date=')).toBe(true);
    expect(p).toContain('bucket=day');
    expect(p).toContain('dimensions=model&dimensions=provider&dimensions=status_code');
    expect(p).toContain('tag=env%3Aproduction');
    expect(API).toBe('https://eu.api.otari.ai/api/v1');
  });
});

describe('buildReport', () => {
  it('computes totals, error rate and grouped rows', () => {
    const r = buildReport({
      budget,
      summary,
      features: { chat: summary, structured: summary, vision: summary },
      days: 30,
    });
    expect(r.totals.cost_usd).toBe(1.25);
    expect(r.totals.error_rate).toBeCloseTo(0.025);
    expect(r.by_model[0]).toEqual({
      name: 'openai/gpt-x',
      cost_usd: 1.0,
      requests: 150,
      tokens: 9000,
    });
    expect(r.errors_by_status_code).toEqual([
      { status_code: 429, error_class: 'rate', requests: 5 },
    ]);
    expect(r.budget).toEqual({ budgets_enforced: true, remaining_usd: 14.5 });
    expect(r.by_feature).toHaveLength(3);
    expect(r.warnings).toEqual([]);
    expect(r.unavailable).toEqual([]);
  });

  it('warns on unpriced requests, unenforced budgets, low remaining budget and unknown providers', () => {
    const r = buildReport({
      budget: { budgets_enforced: false, remaining_usd: 1.5 },
      summary: {
        ...summary,
        totals: { ...summary.totals, unpriced_requests: 3 },
        by_provider: [{ label: 'openai' }, { label: 'mystery' }],
      },
      features: {},
      days: 7,
      expectedProviders: ['openai'],
    });
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('3 request(s)'),
        'budgets are not enforced on this key',
        expect.stringContaining('1.5 USD'),
        'unexpected provider in usage: mystery',
      ])
    );
    expect(r.warnings).toHaveLength(4);
  });

  it('degrades missing fields and unavailable answers to null instead of throwing', () => {
    const r = buildReport({
      budget: { _unavailable: 'GET /key/budget -> HTTP 403' },
      summary: { totals: { cost: 'free' } },
      features: { chat: { _unavailable: 'nope' } },
      days: 30,
    });
    expect(r.totals.cost_usd).toBeNull();
    expect(r.totals.error_rate).toBeNull();
    expect(r.by_model).toEqual([]);
    expect(r.budget).toBeNull();
    expect(r.by_feature[0]).toEqual({ feature: 'chat', cost_usd: null, requests: null });
    expect(r.unavailable).toEqual(expect.arrayContaining(['budget', 'feature:chat']));
  });

  it('formats a readable text report with its warnings', () => {
    const text = formatText(
      buildReport({
        budget: { budgets_enforced: false, remaining_usd: null },
        summary,
        features: {},
        days: 30,
        env: 'production',
      })
    );
    expect(text).toContain('env:production');
    expect(text).toContain('WARN budgets are not enforced on this key');
  });
});

describe('argument parsing', () => {
  it('defaults to 30 days and validates --env and --days', () => {
    expect(parseArgs(['--json'])).toEqual({ json: true, days: 30, env: null });
    expect(parseArgs(['--days', '7', '--env', 'staging'])).toEqual({
      json: false,
      days: 7,
      env: 'staging',
    });
    expect(() => parseArgs(['--env', 'dev'])).toThrow();
    expect(() => parseArgs(['--days', '0'])).toThrow();
  });

  it('reads the expected provider list from the environment', () => {
    const before = process.env.OTARI_EXPECTED_PROVIDERS;
    process.env.OTARI_EXPECTED_PROVIDERS = 'openai, anthropic ,';
    expect(expectedProvidersFromEnv()).toEqual(['openai', 'anthropic']);
    delete process.env.OTARI_EXPECTED_PROVIDERS;
    expect(expectedProvidersFromEnv()).toBeNull();
    if (before !== undefined) {
      process.env.OTARI_EXPECTED_PROVIDERS = before;
    }
  });

  it('handles --days=, --env=, missing values and non-integer formats', () => {
    expect(parseArgs(['--days=14', '--env=production', '--json'])).toEqual({
      json: true,
      days: 14,
      env: 'production',
    });
    expect(() => parseArgs(['--days'])).toThrow('--days takes a whole number from 1 to 366');
    expect(() => parseArgs(['--days='])).toThrow('--days takes a whole number from 1 to 366');
    expect(() => parseArgs(['--days', '7.0'])).toThrow('--days takes a whole number from 1 to 366');
    expect(() => parseArgs(['--days', '1e2'])).toThrow('--days takes a whole number from 1 to 366');
    expect(() => parseArgs(['--days', '367'])).toThrow('--days takes a whole number from 1 to 366');
    expect(() => parseArgs(['--env'])).toThrow('--env takes staging or production');
    expect(() => parseArgs(['--env=dev'])).toThrow('--env takes staging or production');
    expect(() => parseArgs(['--json=true'])).toThrow('unknown argument: --json=true');
  });
});

describe('ROOT and concurrent fetching', () => {
  it('derives ROOT from __dirname rather than process.argv[1]', () => {
    expect(ROOT).toBe(path.resolve(__dirname, '..', '..'));
  });

  it('fetches budget, summary and features concurrently in fetchAll and skips features in export', async () => {
    const fs = require('node:fs');
    const mockRequest = jest.fn(async (_api: string, _tok: string, _m: string, reqPath: string) => {
      if (reqPath === '/key/budget') {
        return budget;
      }

      return summary;
    });
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const prevKey = process.env.OTARI_USAGE_KEY;
    process.env.OTARI_USAGE_KEY = 'test-key';

    try {
      let isolatedOtari!: {
        fetchAll: (
          token: string,
          opts: { days: number; env: string | null }
        ) => Promise<{
          features: Record<string, unknown>;
        }>;
        cmdExport: (args: string[]) => Promise<void>;
      };
      jest.isolateModules(() => {
        jest.doMock('../infra/http', () => ({ request: mockRequest }));
        isolatedOtari = require('../infra/otari');
      });

      const reportData = await isolatedOtari.fetchAll('test-key', { days: 30, env: null });
      expect(Object.keys(reportData.features)).toEqual(['chat', 'structured', 'vision']);
      expect(mockRequest).toHaveBeenCalledTimes(5);

      mockRequest.mockClear();
      await isolatedOtari.cmdExport(['--json']);
      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(mockRequest.mock.calls.map((c) => c[3])).toEqual([
        '/key/budget',
        expect.stringContaining('dimensions=model'),
      ]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\{.*"exported_to"/));
    } finally {
      if (prevKey === undefined) {
        delete process.env.OTARI_USAGE_KEY;
      } else {
        process.env.OTARI_USAGE_KEY = prevKey;
      }
      jest.dontMock('../infra/http');
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
