import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct ActivityHeatmap: Widget {
  let name: String = "ActivityHeatmap"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Activity Heatmap")
    .description("Shows your last 30 days of workouts and food logging")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}