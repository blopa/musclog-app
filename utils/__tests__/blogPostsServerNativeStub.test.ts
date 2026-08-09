// `utils/blogPosts.server` reads Markdown with `node:fs/promises`, so it cannot resolve in a
// native bundle. It still reaches the native graph — expo-router's native require.context
// matches `app/(website)/blog/*.web.tsx`, and Metro resolves their `await import()` statically —
// so metro.config.js swaps it for blog-posts-server-stub.js off web. This pins that rule and
// keeps the stub's surface in step with the real module.
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

const STUB_PATH = path.resolve(__dirname, '../../blog-posts-server-stub.js');

const PASSTHROUGH = Symbol('passthrough');

function resolve(moduleName: string, platform: string | null) {
  const context = { resolveRequest: () => ({ filePath: PASSTHROUGH, type: 'sourceFile' }) };
  return metroConfig.resolver.resolveRequest(context as never, moduleName, platform).filePath;
}

describe('blogPosts.server native stub resolution', () => {
  it('stubs the blog loaders on every native platform', () => {
    for (const platform of ['android', 'ios']) {
      expect(resolve('@/utils/blogPosts.server', platform)).toBe(STUB_PATH);
    }
  });

  it('resolves a relative import of the same module too', () => {
    expect(resolve('../blogPosts.server', 'android')).toBe(STUB_PATH);
  });

  it('leaves the real module in place on web, where the loaders actually run', () => {
    expect(resolve('@/utils/blogPosts.server', 'web')).toBe(PASSTHROUGH);
  });

  it('does not swallow a different module with a similar name', () => {
    expect(resolve('@/utils/blogPosts', 'android')).toBe(PASSTHROUGH);
    expect(resolve('@/utils/blogPosts.server.extra', 'android')).toBe(PASSTHROUGH);
  });

  it('keeps stubbing the sharp Node-only dependency', () => {
    expect(resolve('sharp', 'android')).toBe(path.resolve(__dirname, '../../sharp-stub.js'));
  });
});

describe('blog-posts-server-stub surface', () => {
  const stub = require('../../blog-posts-server-stub.js') as Record<string, unknown>;
  const real = require('../blogPosts.server') as Record<string, unknown>;

  it('exports every function the real module does, so an import cannot silently be undefined', () => {
    const realFunctions = Object.keys(real)
      .filter((key) => typeof real[key] === 'function')
      .sort();

    expect(realFunctions.length).toBeGreaterThan(0);
    expect(Object.keys(stub).sort()).toEqual(realFunctions);
  });

  it('throws rather than returning empty posts if native ever calls one', () => {
    for (const key of Object.keys(stub)) {
      expect(() => (stub[key] as () => unknown)()).toThrow(/web-only/);
    }
  });
});
