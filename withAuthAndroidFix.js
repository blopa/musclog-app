const { withAppBuildGradle } = require('@expo/config-plugins');

const REDIRECT_SCHEME = 'musclog';

module.exports = function withAuthAndroidFix(config) {
    return withAppBuildGradle(config, async (config) => {
        // Check if the manifestPlaceholders already exist
        const existingPlaceholderRegex = /manifestPlaceholders\s*=\s*\[.*?\]/;
        const placeholderEntry = `manifestPlaceholders = [appAuthRedirectScheme: "${REDIRECT_SCHEME}"]`;

        if (existingPlaceholderRegex.test(config.modResults.contents)) {
            // If the manifestPlaceholders exist, append to it
            config.modResults.contents = config.modResults.contents.replace(
                existingPlaceholderRegex,
                (match) => {
                    // Append the new placeholder if it's not already there
                    if (!match.includes('appAuthRedirectScheme')) {
                        return match.replace(/\]$/, `, appAuthRedirectScheme: "${REDIRECT_SCHEME}"]`);
                    }
                    return match;
                }
            );
        } else {
            // If no manifestPlaceholders exist, add it to the defaultConfig block
            config.modResults.contents = config.modResults.contents.replace(
                /defaultConfig\s*\{[^}]*\n/,
                (match) => `${match}        ${placeholderEntry}\n`
            );
        }
        return config;
    });
};
