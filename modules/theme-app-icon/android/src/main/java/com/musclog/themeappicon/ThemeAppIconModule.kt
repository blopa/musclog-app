package com.musclog.themeappicon

import android.content.ComponentName
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Must match `LAUNCHER_ALIAS_PREFIX` in `plugins/withThemeAppIcons.js`. */
private const val ALIAS_PREFIX = "LauncherIcon"
private const val DEFAULT_ICON_SUFFIX = "Default"

class UnknownAppIconException(name: String) :
  CodedException("No launcher alias exists for app icon \"$name\"")

/**
 * Switches the launcher icon by toggling the `.LauncherIcon*` activity aliases the
 * config plugin declares. MainActivity is never touched: it owns the deep-link and
 * Health Connect intent filters, and disabling it would break both.
 */
class ThemeAppIconModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ThemeAppIcon")

    AsyncFunction("getAppIcon") {
      val context = context()
      val enabled = launcherAliases(context).firstOrNull { isEnabled(context, it) }
      enabled?.let { iconNameOf(it) }
    }

    AsyncFunction("setAppIcon") { name: String? ->
      val context = context()
      val aliases = launcherAliases(context)
      val targetSimpleName = ALIAS_PREFIX + (name ?: DEFAULT_ICON_SUFFIX)
      val target = aliases.firstOrNull { simpleName(it) == targetSimpleName }
        ?: throw UnknownAppIconException(name ?: DEFAULT_ICON_SUFFIX)
      val packageManager = context.packageManager

      // Enable the new entry point before disabling the old one, so there is never
      // a moment with no launcher entry at all.
      if (!isEnabled(context, target)) {
        packageManager.setComponentEnabledSetting(
          ComponentName(context.packageName, target.name),
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          PackageManager.DONT_KILL_APP
        )
      }
      for (alias in aliases) {
        if (alias.name != target.name && isEnabled(context, alias)) {
          packageManager.setComponentEnabledSetting(
            ComponentName(context.packageName, alias.name),
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
          )
        }
      }
      name
    }
  }

  private fun context(): Context =
    appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** Every `.LauncherIcon*` alias in the manifest, including the disabled ones. */
  private fun launcherAliases(context: Context): List<ActivityInfo> {
    val flags = PackageManager.GET_ACTIVITIES or PackageManager.MATCH_DISABLED_COMPONENTS
    val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.packageManager.getPackageInfo(
        context.packageName,
        PackageManager.PackageInfoFlags.of(flags.toLong())
      )
    } else {
      @Suppress("DEPRECATION")
      context.packageManager.getPackageInfo(context.packageName, flags)
    }
    return packageInfo.activities.orEmpty().filter { simpleName(it).startsWith(ALIAS_PREFIX) }
  }

  /** The runtime override if one was set, otherwise what the manifest declares. */
  private fun isEnabled(context: Context, alias: ActivityInfo): Boolean =
    when (
      context.packageManager.getComponentEnabledSetting(
        ComponentName(context.packageName, alias.name)
      )
    ) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
      PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> alias.enabled
      else -> false
    }

  private fun simpleName(alias: ActivityInfo): String = alias.name.substringAfterLast('.')

  private fun iconNameOf(alias: ActivityInfo): String? =
    simpleName(alias).removePrefix(ALIAS_PREFIX).takeUnless { it == DEFAULT_ICON_SUFFIX }
}
