import ExpoModulesCore
import UIKit

/// Must match `IOS_ICON_SET_PREFIX` in `plugins/withThemeAppIcons.js`.
private let iconSetPrefix = "AppIcon"

/// Switches between the alternate icon sets the config plugin compiles in.
/// iOS always shows its own "You have changed the icon" alert; there is no public way around it.
public class ThemeAppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ThemeAppIcon")

    AsyncFunction("getAppIcon") { () -> String? in
      guard let name = UIApplication.shared.alternateIconName, name.hasPrefix(iconSetPrefix) else {
        return nil
      }
      return String(name.dropFirst(iconSetPrefix.count))
    }.runOnQueue(.main)

    AsyncFunction("setAppIcon") { (name: String?, promise: Promise) in
      guard UIApplication.shared.supportsAlternateIcons else {
        promise.reject("ERR_ALTERNATE_ICONS_UNSUPPORTED", "This device does not support alternate app icons")
        return
      }
      let iconSetName = name.map { iconSetPrefix + $0 }
      UIApplication.shared.setAlternateIconName(iconSetName) { error in
        if let error = error {
          promise.reject("ERR_SET_APP_ICON", error.localizedDescription)
        } else {
          promise.resolve(name)
        }
      }
    }.runOnQueue(.main)
  }
}
