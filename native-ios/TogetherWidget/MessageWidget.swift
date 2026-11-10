import WidgetKit
import SwiftUI

struct MessageEntry: TimelineEntry {
    let date: Date
    let message: String
    let senderName: String
}

struct MessageProvider: TimelineProvider {
    func placeholder(in context: Context) -> MessageEntry {
        MessageEntry(date: .now, message: "A little closer, every day 💕", senderName: "Partner")
    }
    func getSnapshot(in context: Context, completion: @escaping (MessageEntry) -> Void) {
        completion(entry(from: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<MessageEntry>) -> Void) {
        let e = entry(from: .now)
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: .now)!
        completion(Timeline(entries: [e], policy: .after(next)))
    }
    private func entry(from date: Date) -> MessageEntry {
        let data = WidgetData.load()
        return MessageEntry(date: date, message: data?.partnerMessage ?? "A little closer, every day 💕", senderName: data?.myName ?? "You")
    }
}

struct MessageWidgetView: View {
    var entry: MessageEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("💌").font(.title2)
                Spacer()
                Text(entry.senderName).font(.caption2.bold()).foregroundStyle(.secondary)
            }
            Spacer()
            Text(entry.message)
                .font(.system(.body, design: .rounded, weight: .medium))
                .lineLimit(3)
        }
        .padding()
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(.systemBackground), Color.purple.opacity(0.06)], startPoint: .top, endPoint: .bottom)
        }
    }
}

struct MessageWidget: Widget {
    let kind = "MessageWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MessageProvider()) { entry in
            MessageWidgetView(entry: entry)
        }
        .configurationDisplayName("Partner Message")
        .description("A note from your shared space on your Home Screen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
