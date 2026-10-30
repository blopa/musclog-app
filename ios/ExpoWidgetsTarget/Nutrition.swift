import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct Nutrition: Widget {
  let name: String = "Nutrition"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Nutrition Progress")
    .description("Shows daily nutrition progress")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}