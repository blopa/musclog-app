// The Anthropic SDK's ESM build has an import cycle that dev-mode React Refresh trips over
// ("can't access lexical declaration 'BETA_BROWSER_MEMBER_NAME_VALUES' before initialization"),
// which keeps app/_layout.tsx from loading on web. metro.config.js resolves the package root to its
// CommonJS entry instead. This pins that rule; see the comment in metro.config.js.
const path = require('node:path');

const metroConfig = require('../../metro.config.js') as {
  resolver: {
    resolveRequest: (
      context: { resolveRequest: (...args: unknown[]) => unknown },
      moduleName: string,
      platform: string | null
    ) => { filePath: string; type: string };
  };
};

const PASSTHROUGH = Symbol('passthrough');

function resolve(moduleName: string, platform: string | null) {
  const context = { resolveRequest: () => ({ filePath: PASSTHROUGH, type: 'sourceFile' }) };
  return metroConfig.resolver.resolveRequest(context as never, moduleName, platform).filePath;
}

describe('@anthropic-ai/sdk Metro resolution', () => {
  it('resolves the package root to the CommonJS build on every platform', () => {
    for (const platform of ['web', 'android', 'ios']) {
      const resolved = resolve('@anthropic-ai/sdk', platform) as string;
      expect(resolved).toBe(require.resolve('@anthropic-ai/sdk'));
      expect(path.basename(resolved)).toBe('index.js');
    }
  });

  it('leaves unrelated packages to Metro', () => {
    expect(resolve('react', 'web')).toBe(PASSTHROUGH);
  });
});
