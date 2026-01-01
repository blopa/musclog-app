const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Config plugin to enable 16 KB page size support for Android builds
 * Required for Google Play compatibility starting November 1, 2025
 * See: https://developer.android.com/guide/practices/page-sizes
 *
 * This plugin ensures that:
 * 1. Native libraries are not uncompressed (required for proper 16 KB alignment)
 * 2. Build system is configured for 16 KB page size support
 *
 * Note: EAS Build automatically handles 16 KB zipalign when targeting Android 15+,
 * but this plugin ensures all necessary configuration is in place.
 */
module.exports = function with16KBPageSize(config) {
    // Add Gradle properties for 16 KB page size support
    config = withGradleProperties(config, (config) => {
        if (!config.modResults) {
            config.modResults = [];
        }

        // Ensure native libraries are compressed (required for 16 KB alignment)
        // When false, native libs are stored uncompressed, which is required for 16 KB alignment
        const existingPropIndex = config.modResults.findIndex(
            (item) => item.key === 'android.bundle.enableUncompressedNativeLibs'
        );

        if (existingPropIndex === -1) {
            config.modResults.push({
                key: 'android.bundle.enableUncompressedNativeLibs',
                type: 'property',
                value: 'false',
            });
        } else {
            config.modResults[existingPropIndex].value = 'false';
        }

        return config;
    });

    return config;
};
