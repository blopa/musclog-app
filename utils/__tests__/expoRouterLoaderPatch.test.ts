// Expo Router data loaders are alpha in SDK 57. This pins the regressions fixed by
// patches/expo-router+57.0.13.patch until the fixes are available upstream.
const { getLoaderModulePath } = require('expo-router/build/loaders/utils') as {
  getLoaderModulePath: (routePath: string) => string;
};

const { getContextKey, getRoutes } = require('expo-router/build/internal/routing') as {
  getContextKey: (filePath: string) => string;
  getRoutes: (contextModule: unknown, options: Record<string, unknown>) => RouteNode;
};

interface RouteNode {
  children?: RouteNode[];
  contextKey: string;
  route: string;
}

const WEBSITE_ROUTE_FILES = [
  './_layout.tsx',
  './(website)/_layout.tsx',
  './(website)/_layout.web.tsx',
  './(website)/blog/index.tsx',
  './(website)/blog/index.web.tsx',
  './(website)/blog/[...slug].tsx',
  './(website)/blog/[...slug].web.tsx',
  './(website)/blog/page/[page].tsx',
  './(website)/blog/page/[page].web.tsx',
];

function routeTreeFor(platform: string, files = WEBSITE_ROUTE_FILES): Record<string, string> {
  const contextModule = () => ({ default: () => null });
  contextModule.keys = () => files;
  contextModule.resolve = (key: string) => key;
  contextModule.id = 'expo-router-patch-test';

  const tree = getRoutes(contextModule, {
    ignoreEntryPoints: true,
    internal_stripLoadRoute: true,
    platform,
    preserveApiRoutes: false,
  });

  const routes: Record<string, string> = {};
  const walk = (node: RouteNode) => {
    routes[node.route] = node.contextKey;
    node.children?.forEach(walk);
  };
  walk(tree);

  return routes;
}

describe('Expo Router platform extension patch', () => {
  it('selects the web file for a deep dynamic route', () => {
    const routes = routeTreeFor('web');

    expect(routes['blog/[...slug]']).toBe('./(website)/blog/[...slug].web.tsx');
    expect(routes['blog/index']).toBe('./(website)/blog/index.web.tsx');
    expect(routes['blog/page/[page]']).toBe('./(website)/blog/page/[page].web.tsx');
    expect(routes['(website)']).toBe('./(website)/_layout.web.tsx');
  });

  it('selects the platform-free fallback for a deep dynamic route on native', () => {
    const routes = routeTreeFor('android');

    expect(routes['blog/[...slug]']).toBe('./(website)/blog/[...slug].tsx');
    expect(routes['blog/index']).toBe('./(website)/blog/index.tsx');
    expect(routes['blog/page/[page]']).toBe('./(website)/blog/page/[page].tsx');
    expect(routes['(website)']).toBe('./(website)/_layout.tsx');
  });

  it('does not register the platform variant as its own literal route', () => {
    // `[...slug]` contains dots, so the unpatched filename parser read the platform extension
    // as '' and published `blog/[...slug].web` as a real route on every platform.
    for (const platform of ['web', 'android', 'ios']) {
      const leakedRoutes = Object.keys(routeTreeFor(platform)).filter((route) =>
        /\.(android|ios|native|web)$/.test(route)
      );
      expect(leakedRoutes).toEqual([]);
    }
  });

  it('keeps the platform extension out of the loader context key', () => {
    expect(getContextKey('./(website)/blog/[...slug].web.tsx')).toBe('/(website)/blog/[...slug]');
    expect(getContextKey('./(website)/blog/index.web.tsx')).toBe('/(website)/blog/index');
    expect(getContextKey('./(website)/blog/page/[page].web.tsx')).toBe(
      '/(website)/blog/page/[page]'
    );
    expect(getContextKey('./(website)/_layout.web.tsx')).toBe('/(website)');
  });

  it('leaves a route whose name merely ends in a platform word alone', () => {
    expect(getContextKey('./(website)/web.tsx')).toBe('/(website)/web');
  });
});

describe('Expo Router loader path patch', () => {
  const nodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  it('maps a grouped web route context key to its public loader path', () => {
    process.env.NODE_ENV = 'development';
    expect(getLoaderModulePath('/(website)/blog/index')).toBe('/_expo/loaders/blog/index');
  });

  it('preserves search parameters while normalizing the route', () => {
    process.env.NODE_ENV = 'development';
    expect(getLoaderModulePath('/(website)/blog/index?draft=true')).toBe(
      '/_expo/loaders/blog/index?draft=true'
    );
  });

  it('maps a grouped dynamic fallback route to its public loader path', () => {
    process.env.NODE_ENV = 'development';
    expect(getLoaderModulePath('/(website)/blog/2026/08/example')).toBe(
      '/_expo/loaders/blog/2026/08/example'
    );
  });

  it('maps a paginated blog route to its public loader path', () => {
    process.env.NODE_ENV = 'development';
    expect(getLoaderModulePath('/(website)/blog/page/2')).toBe('/_expo/loaders/blog/page/2');
  });

  it('preserves the exported static loader path in production', () => {
    process.env.NODE_ENV = 'production';
    expect(getLoaderModulePath('/(website)/blog/index')).toBe(
      '/_expo/loaders/(website)/blog/index'
    );
  });

  it('leaves ordinary public loader paths unchanged', () => {
    expect(getLoaderModulePath('/posts/hello')).toBe('/_expo/loaders/posts/hello');
  });
});
