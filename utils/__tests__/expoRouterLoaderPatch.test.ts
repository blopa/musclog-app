// Expo Router data loaders are alpha in SDK 57. This pins the development-path regression fixed by
// patches/expo-router+57.0.11.patch until the normalization is available upstream.
const { getLoaderModulePath } = require('expo-router/build/loaders/utils') as {
  getLoaderModulePath: (routePath: string) => string;
};

describe('Expo Router loader path patch', () => {
  const nodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  it('maps a grouped web route context key to its public loader path', () => {
    process.env.NODE_ENV = 'development';
    expect(getLoaderModulePath('/(website)/blog.web')).toBe('/_expo/loaders/blog');
  });

  it('preserves search parameters while normalizing the route', () => {
    process.env.NODE_ENV = 'development';
    expect(getLoaderModulePath('/(website)/blog.web?draft=true')).toBe(
      '/_expo/loaders/blog?draft=true'
    );
  });

  it('preserves the exported static loader path in production', () => {
    process.env.NODE_ENV = 'production';
    expect(getLoaderModulePath('/(website)/blog.web')).toBe(
      '/_expo/loaders/(website)/blog.web'
    );
  });

  it('leaves ordinary public loader paths unchanged', () => {
    expect(getLoaderModulePath('/posts/hello')).toBe('/_expo/loaders/posts/hello');
  });
});
