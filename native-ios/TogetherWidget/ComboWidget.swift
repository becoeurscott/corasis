import WidgetKit
import SwiftUI

struct ComboEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let todayComplete: Bool
    let hoursLeft: Int
    let minutesLeft: Int
    let message: String
    let myName: String
    let partnerName: String
    let eventTitle: String?
    let daysToEvent: Int?
}

struct ComboProvider: TimelineProvider {
    func placeholder(in context: Context) -> ComboEntry {
        ComboEntry(date: .now, streak: 7, todayComplete: false, hoursLeft: 8, minutesLeft: 30, message: "Miss you 💕", myName: "You", partnerName: "Partner", eventTitle: "Paris trip", daysToEvent: 12)
    }
    func getSnapshot(in context: Context, completion: @escaping (ComboEntry) -> Void) {
        completion(entry(from: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ComboEntry>) -> Void) {
        let e = entry(from: .now)
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
        completion(Timeline(entries: [e], policy: .after(next)))
    }
    private func entry(from date: Date) -> ComboEntry {
        let data = WidgetData.load()
        let mins = data?.minutesUntilMidnight ?? 0
        return ComboEntry(date: date, streak: data?.streakCurrent ?? 0, todayComplete: data?.todayComplete ?? false, hoursLeft: mins / 60, minutesLeft: mins % 60, message: data?.partnerMessage ?? "A little closer, every day 💕", myName: data?.myName ?? "You", partnerName: data?.partnerName ?? "Partner", eventTitle: data?.nextEventTitle, daysToEvent: data?.daysToEvent)
    }
}

struct ComboWidgetView: View {
    var entry: ComboEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("🔥 \(entry.streak) days")
                        .font(.system(.headline, design: .rounded, weight: .bold))
                    if entry.todayComplete {
                        Text("✓ Complete").font(.caption2.bold()).foregroundStyle(.pink)
                    } else if entry.streak > 0 {
                        Text("\(entry.hoursLeft)h \(entry.minutesLeft)m left").font(.caption2.bold()).foregroundStyle(.orange)
                    }
                }
                Spacer()
                if let title = entry.eventTitle, let days = entry.daysToEvent {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(days)d").font(.system(.headline, design: .rounded, weight: .bold))
                        Text(title).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            }

            Spacer()

            Text(entry.message)
                .font(.system(.subheadline, design: .rounded, weight: .medium))
                .lineLimit(2)
                .foregroundStyle(.primary)

            Spacer()

            HStack {
                Text("\(entry.myName) & \(entry.partnerName)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Image(systemName: "heart.fill").font(.caption2).foregroundStyle(.pink)
            }
        }
        .padding()
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(.systemBackground), Color.pink.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

struct ComboWidget: Widget {
    let kind = "ComboWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ComboProvider()) { entry in
            ComboWidgetView(entry: entry)
        }
        .configurationDisplayName("Together")
        .description("Your flame, your message, and your next meeting at a glance.")
        .supportedFamilies([.systemMedium])
    }
}
