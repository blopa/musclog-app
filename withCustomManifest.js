const { withAndroidManifest } = require('@expo/config-plugins');

const withCustomManifest = (config) => {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;

        // Locate the <application> tag
        const application = androidManifest.manifest.application[0];

        // Create new activity and activity-alias elements
        const permissionsRationaleActivity = {
            $: {
                'android:exported': 'true',
                'android:name': '.PermissionsRationaleActivity',
            },
            'intent-filter': [
                {
                    action: [
                        {
                            $: {
                                'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
                            },
                        },
                    ],
                },
            ],
        };

        const activityAlias = {
            $: {
                'android:exported': 'true',
                'android:name': 'ViewPermissionUsageActivity',
                'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
                'android:targetActivity': '.PermissionsRationaleActivity',
            },
            'intent-filter': [
                {
                    action: [
                        {
                            $: {
                                'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE',
                            },
                        },
                    ],
                    category: [
                        {
                            $: {
                                'android:name': 'android.intent.category.HEALTH_PERMISSIONS',
                            },
                        },
                    ],
                },
            ],
        };

        // Add the new elements to the <application> tag
        application.activity = application.activity || [];
        application['activity-alias'] = application['activity-alias'] || [];

        application.activity.push(permissionsRationaleActivity);
        application['activity-alias'].push(activityAlias);

        return config;
    });
};

module.exports = withCustomManifest;
