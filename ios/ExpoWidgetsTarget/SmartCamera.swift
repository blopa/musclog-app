import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct SmartCamera: Widget {
  let name: String = "SmartCamera"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Smart Camera")
    .description("Open Smart Camera")
    .supportedFamilies([.systemSmall])
  }
}