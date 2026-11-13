import Foundation
import SwiftUI

struct Question: Codable, Identifiable { var id: String; var type: String; var category: String; var text: String; var options: [String]?; var aboutPartner: Bool? }
struct Deck: Codable, Identifiable { var id: String; var title: String; var category: String; var description: String; var type: String; var questionIds: [String]; var premium: Bool; var emoji: String }
struct Game: Codable, Identifiable { var id: String; var title: String; var tagline: String; var description: String; var tags: [String]; var players: String; var pace: String; var emoji: String; var colors: [String]; var status: String }
struct CheckupItem: Codable, Identifiable { var id: String; var emoji: String; var text: String }
struct CheckupBand: Codable { var min: Int; var title: String; var text: String }
struct CheckupContent: Codable {
    var scale: [String]; var items: [CheckupItem]; var bands: [CheckupBand]; var disclaimer: String
    func band(_ score: Int) -> CheckupBand { bands.first { score >= $0.min } ?? bands.last! }
}
/// One spouse's answers for one month's Marriage Check-up. Synced as kind "checkup", id "<round>_<user>".
struct CheckupEntry: Codable, Identifiable {
    var id: String { "\(round)_\(user)" }
    var coupleID: String; var round: String; var user: String; var ratings: [Int]; var guess: Int; var submitted = Date()
    /// 25 ratings from 1 to 5 → 0…100 %.
    var score: Int { max(0, min(100, ratings.reduce(0, +) - ratings.count)) }
}
struct TruthItem: Codable, Identifiable { var id: String; var emoji: String; var text: String; var options: [String] }
struct TruthsContent: Codable { var intro: String; var items: [TruthItem]; var talk: String }
/// One partner's Five Truths answers for a month. Synced as kind "truths", id "<round>_<user>".
/// answers/guesses hold option indexes (0 = warmest); guesses are what they think the partner chose.
struct TruthsEntry: Codable, Identifiable {
    var id: String { "\(round)_\(user)" }
    var coupleID: String; var round: String; var user: String; var answers: [Int]; var guesses: [Int]; var submitted = Date()
}
struct Category: Codable { var label: String; var emoji: String; var blurb: String }
struct Palette: Codable { var label: String; var tagline: String; var light: [String:String]; var dark: [String:String] }
struct OnboardingTransition: Codable { var title: String; var message: String; var durationMs: Int }
struct AccountCreationCopy: Codable { var title: String; var subtitle: String; var emailPlaceholder: String; var emailAction: String; var existingAccount: String; var privacyNote: String }
struct SignInCopy: Codable { var title: String; var subtitle: String; var emailPlaceholder: String; var action: String; var noAccount: String; var createAction: String; var restoreNote: String }
struct EmailCodeCopy: Codable { var title: String; var subtitle: String; var placeholder: String; var action: String; var resend: String; var resent: String; var change: String; var demo: String }
struct Product: Codable {
    var signIn: SignInCopy
    var emailCode: EmailCodeCopy
    var accountCreation: AccountCreationCopy
    var onboardingTransition: OnboardingTransition
    var motion: MotionTokens
    var connectionOnboarding: ConnectionFlow
    var schemaVersion: Int
    var palettes: [String:Palette]
    var categoryMeta: [String:Category]
    var questions: [Question]
    var decks: [Deck]
    var simulatedAnswers: [String:String]
    var games: [Game]
    var lifeGame: LifeContent
    var checkup: CheckupContent
    var truths: TruthsContent
    /// Content in the app's current language (product.fr.json, …), falling back to English.
    static var shared: Product {
        let lang = AppLanguage.current
        if let p = cache[lang] { return p }
        let p = load("product.\(lang)") ?? load("product") ?? { fatalError("The shared product.json resource is missing or invalid.") }()
        cache[lang] = p; return p
    }
    nonisolated(unsafe) private static var cache: [String: Product] = [:]
    private static func load(_ name: String) -> Product? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Product.self, from: data)
    }
    func question(_ id: String) -> Question? { questions.first { $0.id == id } }
    func daily(_ day: String) -> Question {
        let pool = decks.first { $0.id == "deck_daily" }!.questionIds
        let index = Int(Day.date(day, zone: "UTC").timeIntervalSince1970 / 86400)
        return question(pool[((index % pool.count) + pool.count) % pool.count])!
    }
}
struct Person: Codable, Identifiable {
    var id = UUID().uuidString; var name: String; var email = ""; var pronouns = ""; var timezone = TimeZone.current.identifier; var avatar: String?; var simulated = false
    /// InsForge copy of the photo; `avatarSource` is the local file it was uploaded from.
    var avatarURL: String?; var avatarKey: String?; var avatarSource: String?
}
struct Account: Codable, Identifiable { var id: String; var email: String; var passwordHash: String; var salt: String; var verified = false; var code: String; var resetCode: String?; var remote: Bool? }
struct Couple: Codable, Identifiable {
    var id = UUID().uuidString; var members: [String]; var start: String?; var stage = "dating"; var distance = "long_distance"; var goals: [String] = []; var timezone = TimeZone.current.identifier
}
struct Invite: Codable, Identifiable { var id = UUID().uuidString; var owner: String; var code: String; var expires: Date; var status = "pending" }
struct Media: Codable, Equatable { var path: String; var kind: String }
struct Moment: Codable, Identifiable { var id = UUID().uuidString; var coupleID: String; var author: String; var day: String; var media: Media; var caption: String; var created = Date() }
struct Answer: Codable { var userID: String; var text: String; var skipped = false; var comment = "" }
struct Activity: Codable, Identifiable {
    var id = UUID().uuidString; var coupleID: String; var deckID: String; var questionID: String; var day: String?; var answers: [Answer] = []; var drafts: [String:String] = [:]; var reactions: [String:String] = [:]; var abandoned = false; var created = Date()
    func revealed(members: [String]) -> Bool { !abandoned && members.count == 2 && members.allSatisfy { id in answers.contains { $0.userID == id } } }
    func visibleAnswers(viewer: String, members: [String]) -> [Answer] { revealed(members: members) ? answers : answers.filter { $0.userID == viewer } }
}
struct Note: Codable, Identifiable { var id = UUID().uuidString; var coupleID: String; var sender: String; var text: String; var kind = "text"; var media: Media?; var created = Date(); var reactions: [String:String] = [:] }
struct Memory: Codable, Identifiable { var id = UUID().uuidString; var coupleID: String; var owner: String; var title: String; var body: String; var day: String; var media: Media?; var favorites: [String] = []; var momentID: String? }
struct Event: Codable, Identifiable { var id = UUID().uuidString; var coupleID: String; var title: String; var day: String; var kind = "meeting"; var destination = ""; var notes = ""; var annual = false; var time = "12:00"; var allDay = true; var reminderDays = 1 }
struct Sharing: Codable { var location = false; var battery = false; var latitude: Double?; var longitude: Double?; var updated: Date?; var country: String?; var countryCode: String?; var batteryPercent: Int? }
struct Preferences: Codable {
    var theme = "pink"; var appearance = "system"; var language = "auto"; var unit = "km"; var notifications = true; var dailyReminder = true; var momentAlerts = true; var messageAlerts = true; var activityAlerts = true; var meetingAlerts = true; var sound = true; var haptics = true; var quietStart = "22:00"; var quietEnd = "08:00"; var reminderTime = "20:00"; var lock = false; var premium = false
}
struct Database: Codable {
    var connectionDraft: ConnectionPreferences?
    var connectionPreferences: [String: ConnectionPreferences]?
    var version = 1; var currentUser: String?; var demo = false; var onboarded = false; var partnerStepDone: Bool?; var prefs = Preferences(); var people: [Person] = []; var accounts: [Account] = []; var couples: [Couple] = []; var invites: [Invite] = []; var moments: [Moment] = []; var activities: [Activity] = []; var messages: [Note] = []; var memories: [Memory] = []; var events: [Event] = []; var favorites: [String:[String]] = [:]; var sharing: [String:Sharing] = [:]; var widgetMessages: [String:String] = [:]
    /// Our Little One games. Optional so state saved before the game existed still loads.
    var lifeGames: [LifeGame]?
    var checkups: [CheckupEntry]?
    var truths: [TruthsEntry]?
    var places: [Place]?
    var repairs: [RepairEntry]?
    var plays: [PlayEntry]?
}
enum Day {
    static func formatter(_ zone: String) -> DateFormatter { let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = Calendar(identifier: .gregorian); f.timeZone = TimeZone(identifier: zone) ?? .gmt; f.dateFormat = "yyyy-MM-dd"; return f }
    static func key(_ date: Date = Date(), zone: String) -> String { formatter(zone).string(from: date) }
    static func date(_ key: String, zone: String) -> Date { formatter(zone).date(from: key) ?? Date(timeIntervalSince1970: 0) }
    static func add(_ key: String, _ count: Int) -> String { Self.key(date(key, zone: "UTC").addingTimeInterval(Double(count) * 86400), zone: "UTC") }
    static func distance(_ a: String, _ b: String) -> Int { Int((date(b, zone: "UTC").timeIntervalSince(date(a, zone: "UTC")) / 86400).rounded()) }
    static func label(_ key: String) -> String { let f = DateFormatter(); f.dateStyle = .medium; f.timeZone = .gmt; return f.string(from: date(key, zone: "UTC")) }
    static func streak(_ moments: [Moment], members: [String], today: String) -> (current: Int, longest: Int, days: [String]) {
        let grouped = Dictionary(grouping: moments, by: \.day)
        let days = grouped.filter { _, items in !members.isEmpty && members.allSatisfy { id in items.contains { $0.author == id } } }.keys.sorted()
        var longest = 0, run = 0; var previous: String?
        for day in days { run = previous.map { add($0, 1) == day } == true ? run + 1 : 1; longest = max(longest, run); previous = day }
        let completed = Set(days); var anchor = completed.contains(today) ? today : add(today, -1); var current = 0
        while completed.contains(anchor) { current += 1; anchor = add(anchor, -1) }
        return (current, longest, days)
    }
}
extension Color {
    init(hex: String) { let value = UInt64(hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted), radix: 16) ?? 0; self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255) }
}

/// "auto" follows the phone's language (French if the phone is in French, otherwise English).
enum AppLanguage {
    static var device: String { Locale.preferredLanguages.first.map { Locale(identifier: $0).language.languageCode?.identifier ?? "en" } == "fr" ? "fr" : "en" }
    static func resolve(_ pref: String) -> String { pref == "auto" ? device : pref }
    /// The language the app is showing right now. Set by RootView from the user's preference.
    nonisolated(unsafe) static var current = device { didSet { bundle = Self.bundle(for: current) } }
    nonisolated(unsafe) static var bundle = bundle(for: device)
    static func bundle(for lang: String) -> Bundle {
        Bundle.main.path(forResource: lang, ofType: "lproj").flatMap(Bundle.init(path:)) ?? .main
    }
}
/// Translates text that isn't shown through a SwiftUI literal (errors, String parameters, interpolations).
func tr(_ value: String.LocalizationValue) -> String { String(localized: value, bundle: AppLanguage.bundle) }
/// Looks up an already-built English string (e.g. a `title: String` parameter).
func tr(key: String) -> String { AppLanguage.bundle.localizedString(forKey: key, value: key, table: nil) }

/// One partner's side of a "Mend the Heart" repair. Each person only ever edits their own entry.
struct RepairEntry: Codable, Identifiable {
    var id: String { "\(repair)_\(user)" }
    var coupleID: String; var repair: String; var user: String
    var starter = false; var topic = ""; var response = ""
    var emotions: [String] = []; var story = ""; var listened = false
    var reformulation = ""; var approved = ""; var clarify = ""
    var need = ""; var proposal = ""; var agreed = ""; var gesture = ""
    var paused = false; var followUp = ""; var followNote = ""
    var created = Date(); var updated = Date()
}
