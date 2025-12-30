const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withCustomGradleConfig(config) {
    return withGradleProperties(config, (config) => {
        if (!config.modResults) {
            config.modResults = [];
        }

        const existingJvmArgsIndex = config.modResults.findIndex(
            (item) => item.key === 'org.gradle.jvmargs'
        );

        if (existingJvmArgsIndex > -1 && config?.modResults?.[existingJvmArgsIndex]?.value) {
            config.modResults[existingJvmArgsIndex].value = config.modResults[existingJvmArgsIndex].value.replace('MaxMetaspaceSize=512m', 'MaxMetaspaceSize=2048m');
        }

        return config;
    });
};
