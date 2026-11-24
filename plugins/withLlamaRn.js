/**
 * Runs llama.rn's own config plugin (iOS memory entitlements on production builds).
 *
 * llama.rn ships that plugin as an ES module, so it is required when the plugin runs, not when it
 * is named in `app.json`. Under Jest the plugin list is still run (`metro.config.js` reads the Expo
 * config), but ESM from `node_modules` does not load there and no native file is written, so the
 * plugin is skipped; a real prebuild or EAS build is not under Jest.
 */
module.exports = (config, props) => {
  if (process.env.JEST_WORKER_ID) {
    return config;
  }

  const loaded = require('llama.rn/app.plugin.js');
  const plugin = loaded.default ?? loaded;

  return plugin(config, props);
};
