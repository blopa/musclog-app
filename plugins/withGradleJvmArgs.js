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
 *
 * It also caps Gradle's parallel workers. A release build compiles every native
 * module (Skia, Reanimated, Worklets, ...) for four ABIs at once; with the
 * default worker count the EAS worker ran out of RAM and the OS killed the
 * Gradle daemon ("Gradle build daemon disappeared unexpectedly", no Java stack).
 */

const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS = '-Xmx4g -XX:MaxMetaspaceSize=1g -Dkotlin.daemon.jvm.options="-Xmx2g"';

const MAX_WORKERS = '2';

module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (gradleConfig) => {
    const managed = { 'org.gradle.jvmargs': JVM_ARGS, 'org.gradle.workers.max': MAX_WORKERS };
    gradleConfig.modResults = gradleConfig.modResults.filter(
      (item) => !(item.type === 'property' && item.key in managed)
    );

    for (const [key, value] of Object.entries(managed)) {
      gradleConfig.modResults.push({ type: 'property', key, value });
    }

    return gradleConfig;
  });
};
