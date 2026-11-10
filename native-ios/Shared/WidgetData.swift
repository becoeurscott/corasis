import Foundation

struct WidgetData: Codable {
    var streakCurrent: Int
    var streakLongest: Int
    var todayComplete: Bool
    var timezone: String
    var partnerMessage: String
    var myName: String
    var partnerName: String
    var nextEventTitle: String?
    var nextEventDay: String?
    var daysToEvent: Int?
    var updatedAt: Date

    static let appGroup = "group.com.ebenezer.corasis"
    static let key = "widget_data"

    static func load() -> WidgetData? {
        guard let defaults = UserDefaults(suiteName: Self.appGroup),
              let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: data)
    }

    func save() {
        guard let defaults = UserDefaults(suiteName: Self.appGroup),
              let data = try? JSONEncoder().encode(self) else { return }
        defaults.set(data, forKey: Self.key)
    }

    var minutesUntilMidnight: Int {
        let tz = TimeZone(identifier: timezone) ?? .current
        var cal = Calendar.current; cal.timeZone = tz
        let now = Date()
        guard let end = cal.date(bySettingHour: 0, minute: 0, second: 0, of: cal.date(byAdding: .day, value: 1, to: now)!) else { return 0 }
        return max(0, Int(end.timeIntervalSince(now) / 60))
    }
}
