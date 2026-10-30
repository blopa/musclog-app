/**
 * Native stub for "mermaid".
 *
 * Blog diagrams are drawn in the browser by `components/website/BlogMermaid.tsx`, which loads the
 * library with a dynamic `import()`. That route file is a `.web.tsx`, yet expo-router's native
 * `require.context` still matches it and Metro resolves the `import()` statically, so metro.config.js
 * resolves "mermaid" to this file off web and the (large) library stays out of the app bundle.
 * Nothing on native renders a blog post, so the stub only needs to resolve.
 */
const mermaid = {
  initialize() {},
  async run() {},
};

module.exports = { __esModule: true, default: mermaid };
