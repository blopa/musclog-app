// react-native-css-interop 0.2.6's `parseDeclaration` falls through from `case "box-shadow"`
// into `case "aspect-ratio"`, so any fully-parsed box-shadow is handed to `parseAspectRatio`,
// which reads `value.ratio[0]` off a box-shadow array and throws. This pins the missing
// `return` added by patches/react-native-css-interop+0.2.6.patch until it lands upstream.
//
// The crash only reaches a native build: it happens in Metro's CSS-to-RN transform, so
// `expo export:embed` dies while `expo export -p web` (PostCSS) is unaffected.
const { cssToReactNativeRuntime } = require('react-native-css-interop/dist/css-to-rn') as {
  cssToReactNativeRuntime: (css: Buffer, options?: Record<string, unknown>) => unknown;
};

const compile = (css: string) => cssToReactNativeRuntime(Buffer.from(css), {});

describe('react-native-css-interop box-shadow fallthrough patch', () => {
  it('compiles a literal box-shadow without falling through to aspect-ratio', () => {
    // The exact declaration from `.blog-prose pre` in global.css that broke the Android build.
    expect(() => compile('.a { box-shadow: 0 18px 50px rgb(0 0 0 / 22%); }')).not.toThrow();
  });

  it('compiles a literal box-shadow alongside other declarations', () => {
    expect(() =>
      compile('.a { padding: 1.25rem; box-shadow: 0 2px 4px #000; border-radius: 1rem; }')
    ).not.toThrow();
  });

  it('still compiles a box-shadow written with a var(), which lightningcss leaves unparsed', () => {
    // Tailwind's own shadow-* utilities take this path, which is why they never tripped the bug.
    expect(() => compile('.a { box-shadow: var(--tw-shadow), 0 1px 2px #000; }')).not.toThrow();
  });

  it('keeps parsing aspect-ratio itself', () => {
    for (const value of ['1 / 1', '160/144', '4/3', '537/1165', 'auto']) {
      expect(() => compile(`.a { aspect-ratio: ${value}; }`)).not.toThrow();
    }
  });

  it('compiles a rule carrying both a box-shadow and an aspect-ratio', () => {
    expect(() => compile('.a { box-shadow: 0 1px 2px #000; aspect-ratio: 4/3; }')).not.toThrow();
  });
});
