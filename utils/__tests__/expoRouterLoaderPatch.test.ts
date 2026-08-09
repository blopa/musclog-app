// Expo Router data loaders are alpha in SDK 57. This pins the development-path regression fixed by
// patches/expo-router+57.0.11.patch until the normalization is available upstream.
const { getLoaderModulePath } = require('expo-router/build/loaders/utils') as {
  getLoaderModulePath: (routePath: string) => string;
};

describe('Expo Router loader path patch', () => {
  it('maps a grouped web route context key to its public loader path', () => {
    expect(getLoaderModulePath('/(website)/blog.web')).toBe('/_expo/loaders/blog');
  });

  it('preserves search parameters while normalizing the route', () => {
    expect(getLoaderModulePath('/(website)/blog.web?draft=true')).toBe(
      '/_expo/loaders/blog?draft=true'
    );
  });

  it('leaves ordinary public loader paths unchanged', () => {
    expect(getLoaderModulePath('/posts/hello')).toBe('/_expo/loaders/posts/hello');
  });
});
