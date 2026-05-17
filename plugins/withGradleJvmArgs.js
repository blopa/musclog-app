/**
 * WHY THIS PLUGIN EXISTS
 *
 * expo-build-properties does not support a `gradleProperties` option despite
 * what the app.json may suggest — the key is silently ignored. The only Expo-
 * idiomatic way to write to android/gradle.properties without hand-editing the
 * generated file (which prebuild wipes) is via the `withGradleProperties` mod.
 *
 * The KSP task that processes expo-updates annotations runs inside the Kotlin
 * daemon and is particularly hungry for Metaspace. 512m (the Expo default) is
 * not enough and causes `OutOfMemoryError: Metaspace` during release builds.
 */

const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS = '-Xmx4g -XX:MaxMetaspaceSize=1g -Dkotlin.daemon.jvm.options="-Xmx2g"';

module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (gradleConfig) => {
    gradleConfig.modResults = gradleConfig.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'org.gradle.jvmargs')
    );
    gradleConfig.modResults.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: JVM_ARGS,
    });
    return gradleConfig;
  });
};
