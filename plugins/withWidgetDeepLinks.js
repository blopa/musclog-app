const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// SDK 58's Glance buttons broadcast interactions; JS listeners only run while the app is alive.
// Route the launcher shortcuts natively so they also work after the app has been terminated.
const ACTIONS = {
  Nutrition: 'open-nutrition',
  SmartCamera: 'open-camera',
  Cycle: 'open-cycle',
  ActivityHeatmap: 'open-home',
};

function widgetProviderSource(androidPackage, name, action) {
  return `package ${androidPackage}

import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider

class ${name}Provider : ExpoWidgetsAppWidgetProvider("${name}") {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "expo.modules.widgets.ACTION_WIDGET_INTERACTION" &&
        intent.getStringExtra("expo.modules.widgets.extra.SOURCE") == "${name}" &&
        intent.getStringExtra("expo.modules.widgets.extra.TARGET") == "__expo_widgets_target_0") {
      context.startActivity(Intent(Intent.ACTION_VIEW,
        Uri.parse("com.werules.logger://?action=${action}"))
        .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      return
    }
    super.onReceive(context, intent)
  }
}
`;
}

module.exports = function withWidgetDeepLinks(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const androidPackage = mod.android.package;
      const directory = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/java',
        ...androidPackage.split('.')
      );
      for (const [name, action] of Object.entries(ACTIONS)) {
        const provider = path.join(directory, `${name}Provider.kt`);
        if (!fs.existsSync(provider)) {
          throw new Error(
            `expo-widgets must generate ${name}Provider.kt before withWidgetDeepLinks`
          );
        }

        fs.writeFileSync(provider, widgetProviderSource(androidPackage, name, action));
      }

      return mod;
    },
  ]);
};

module.exports.widgetProviderSource = widgetProviderSource;
