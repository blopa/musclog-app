import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct Cycle: Widget {
  let name: String = "Cycle"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Cycle")
    .description("Shows your cycle day. Private by default.")
    .supportedFamilies([.systemSmall])
  }
}