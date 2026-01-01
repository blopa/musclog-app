const { withProjectBuildGradle } = require('@expo/config-plugins');
const generateCode = require('@expo/config-plugins/build/utils/generateCode');

// https://github.com/invertase/notifee/issues/350#issuecomment-2227780076
const notifeeAndroidWorkaroundCode = `
    maven { 
        url "$rootDir/../node_modules/@notifee/react-native/android/libs" 
    }
`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = (expoConfig) => {
    return withProjectBuildGradle(expoConfig, async (config) => {
        const { contents } = generateCode.mergeContents({
            anchor: /maven\s*\{\s*url\s*'https:\/\/www\.jitpack\.io'\s*\}/,
            comment: '//',
            newSrc: notifeeAndroidWorkaroundCode,
            offset: 1,
            src: config.modResults.contents,
            tag: 'notifieeAndroidWorkaround',
        });

        config.modResults.contents = contents;

        return config;
    });
};