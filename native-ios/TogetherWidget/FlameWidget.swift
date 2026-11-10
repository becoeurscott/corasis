import WidgetKit
import SwiftUI

struct FlameEntry: TimelineEntry {
    let date: Date
    let current: Int
    let longest: Int
    let todayComplete: Bool
    let hoursLeft: Int
    let minutesLeft: Int
}

struct FlameProvider: TimelineProvider {
    func placeholder(in context: Context) -> FlameEntry {
        FlameEntry(date: .now, current: 7, longest: 14, todayComplete: false, hoursLeft: 8, minutesLeft: 30)
    }
    func getSnapshot(in context: Context, completion: @escaping (FlameEntry) -> Void) {
        completion(entry(from: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<FlameEntry>) -> Void) {
        let now = Date()
        let e = entry(from: now)
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: now)!
        completion(Timeline(entries: [e], policy: .after(next)))
    }
    private func entry(from date: Date) -> FlameEntry {
        let data = WidgetData.load()
        let mins = data?.minutesUntilMidnight ?? 0
        return FlameEntry(date: date, current: data?.streakCurrent ?? 0, longest: data?.streakLongest ?? 0, todayComplete: data?.todayComplete ?? false, hoursLeft: mins / 60, minutesLeft: mins % 60)
    }
}

struct FlameWidgetView: View {
    var entry: FlameEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("🔥").font(.title)
                Spacer()
                if entry.current > 0 && !entry.todayComplete {
                    Text("\(entry.hoursLeft)h \(entry.minutesLeft)m")
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text("\(entry.current)")
                .font(.system(size: family == .systemSmall ? 36 : 44, weight: .bold, design: .rounded))
            Text(entry.current == 1 ? "day streak" : "days streak")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            if entry.todayComplete {
                Text("✓ Complete")
                    .font(.caption2.bold())
                    .foregroundStyle(.pink)
            } else if entry.current > 0 {
                Text("Send a moment!")
                    .font(.caption2.bold())
                    .foregroundStyle(.orange)
            }
        }
        .padding()
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(.systemBackground), Color.pink.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

struct FlameWidget: Widget {
    let kind = "FlameWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FlameProvider()) { entry in
            FlameWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Flame")
        .description("Track your streak and see how much time is left today.")
        .supportedFamilies([.systemSmall])
    }
}
