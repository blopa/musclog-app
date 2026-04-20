const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SENTRY_PHASE_NAME = 'Upload Debug Symbols to Sentry';
const MARKER = 'alwaysOutOfDate = 1;';

/**
 * Silences the "Script has ambiguous dependencies" Xcode warning for the
 * Sentry debug symbols upload build phase by marking it as always out-of-date
 * (equivalent to unchecking "Based on dependency analysis" in Xcode).
 * Without input/output files declared, Xcode would run it every build anyway —
 * this just removes the warning.
 */
const withSentryBuildPhaseFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const pbxprojPath = path.join(
        config.modRequest.projectRoot,
        'ios',
        `${config.modRequest.projectName}.xcodeproj`,
        'project.pbxproj'
      );

      if (!fs.existsSync(pbxprojPath)) {
        console.log('[withSentryBuildPhaseFix] project.pbxproj not found, skipping');
        return config;
      }

      let content = fs.readFileSync(pbxprojPath, 'utf-8');

      if (content.includes(MARKER)) {
        console.log('[withSentryBuildPhaseFix] Already patched');
        return config;
      }

      // Find the Sentry build phase block and insert alwaysOutOfDate = 1
      const sentryBlockRegex = new RegExp(`(name = "${SENTRY_PHASE_NAME}";)`);

      if (!sentryBlockRegex.test(content)) {
        console.log(`[withSentryBuildPhaseFix] Could not find "${SENTRY_PHASE_NAME}" build phase`);
        return config;
      }

      content = content.replace(sentryBlockRegex, `${MARKER}\n\t\t\t$1`);
      fs.writeFileSync(pbxprojPath, content);
      console.log('[withSentryBuildPhaseFix] Patched Sentry build phase');

      return config;
    },
  ]);
};

module.exports = withSentryBuildPhaseFix;
