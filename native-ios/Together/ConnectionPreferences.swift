import SwiftUI

struct ConnectionOption: Codable, Identifiable { var id: String; var label: String; var response: String; var deckId: String? }
struct ConnectionQuestion: Codable, Identifiable { var id: String; var title: String; var subtitle: String; var options: [ConnectionOption] }
struct ConnectionFlow: Codable { var version: Int; var title: String; var intro: String; var storageNotice: String; var privacy: String; var summaryTitle: String; var summaryBody: String; var questions: [ConnectionQuestion] }
struct ConnectionPreferences: Codable, Equatable {
    var version = 1
    var answers: [String:String] = [:]
    var completed = false
    var updatedAt = ISO8601DateFormatter().string(from: Date())
    static func validate(_ answers: [String:String]) throws {
        for (key, value) in answers {
            guard let question = Product.shared.connectionOnboarding.questions.first(where: { $0.id == key }), question.options.contains(where: { $0.id == value }) else { throw AppError(message: "Choose one of the available answers.") }
        }
    }
    var suggestion: ConnectionSuggestion? {
        guard !answers.isEmpty else { return nil }
        let flow = Product.shared.connectionOnboarding
        let source = ["pace", "focus", "affection", "challenge"].compactMap { key in flow.questions.first { $0.id == key }?.options.first { $0.id == answers[key] } }.first { $0.deckId != nil }
        guard let deck = Product.shared.decks.first(where: { $0.id == (source?.deckId ?? "deck_ev") }) else { return nil }
        let time = answers["daily_time"]
        let minutes = time == "two_minutes" ? "2" : time == "ten_minutes" ? "10" : "5"
        return ConnectionSuggestion(deck: deck, body: source?.response ?? tr("Start with one small moment, at your own pace."), duration: time == nil || time == "flexible" ? tr("At your own pace") : tr("About \(minutes) minutes · one prompt is enough"))
    }
}
struct ConnectionSuggestion { var deck: Deck; var body: String; var duration: String }
struct ConnectionQuestionsView: View {
    @Environment(\.appPalette) var p
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    var initial: [String:String]
    var finishTitle: String
    var fitScreen = false
    var onDraft: (([String:String]) -> Void)?
    var onStepChange: (() -> Void)?
    var onPrevious: (() -> Void)?
    var onFinish: ([String:String]) async throws -> Void
    @State private var answers: [String:String] = [:]
    @State private var index = 0
    @State private var busy = false
    @State private var error = ""
    private var flow: ConnectionFlow { Product.shared.connectionOnboarding }
    private var question: ConnectionQuestion? { index < flow.questions.count ? flow.questions[index] : nil }
    var body: some View {
        Group {
            if fitScreen { GeometryReader { geometry in content(compact: geometry.size.height < 650).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading) } }
            else { content(compact: false) }
        }.onAppear { answers = initial }.onChange(of: index) { _, _ in onStepChange?() }
    }
    @ViewBuilder func content(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(question == nil ? "Your space, your pace" : "\(index + 1) of \(flow.questions.count) · Make it yours").font(.caption).foregroundStyle(.secondary)
                ProgressView(value: Double(index + 1), total: Double(flow.questions.count + 1))
            }
            if let q = question {
                VStack(alignment: .leading, spacing: 4) {
                    Text(q.title).contentTransition(.opacity).font(.system(size: compact ? 24 : 28, weight: .bold, design: .rounded)).fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
                    if !compact { Text(q.subtitle).contentTransition(.opacity).font(.subheadline).foregroundStyle(.secondary) }
                }
                ZStack(alignment: .topLeading) {
                VStack(spacing: compact ? 6 : 10) {
                    ForEach(q.options) { option in
                        Button { answers[q.id] = option.id; onDraft?(answers) } label: {
                            HStack(spacing: 12) { Text(option.label).font(.body.weight(.semibold)).multilineTextAlignment(.leading); Spacer(); Image(systemName: answers[q.id] == option.id ? "checkmark.circle.fill" : "circle").foregroundStyle(p.primary) }
                                .padding(.horizontal, 16).padding(.vertical, compact ? 8 : 14).frame(maxWidth: .infinity, minHeight: compact ? 44 : 52, alignment: .leading).foregroundStyle(p.text).background(answers[q.id] == option.id ? p.soft : p.surface, in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(answers[q.id] == option.id ? p.primary : p.color("border")))
                        }.buttonStyle(.smooth).accessibilityAddTraits(answers[q.id] == option.id ? [.isSelected] : [])
                    }
                }.id(q.id).transition(.opacity)
                }
                Text(q.options.first(where: { $0.id == answers[q.id] })?.response ?? tr("Choose one, or skip.")).font(.caption).foregroundStyle(p.primary).frame(minHeight: compact ? 20 : 32, alignment: .leading)
            } else {
                Text(flow.summaryTitle).font(.title.bold())
                Text(flow.summaryBody).foregroundStyle(.secondary)
                if let suggestion = ConnectionPreferences(answers: answers).suggestion {
                    Card { Text("\(suggestion.deck.emoji) \(suggestion.deck.title)").font(.headline); Text(suggestion.body).font(.subheadline); Text(suggestion.duration).font(.caption).foregroundStyle(.secondary) }
                } else { Card { Text("Explore at your own pace.") } }
            }
            if fitScreen { Spacer(minLength: 0) }
            if !error.isEmpty { Text(error).font(.caption).foregroundStyle(.red) }
            VStack(spacing: 2) {
                Button { if question != nil { index += 1 } else { save() } } label: {
                    Text(busy ? tr("Saving…") : question != nil ? "Continue" : finishTitle).font(.headline).frame(maxWidth: .infinity, minHeight: compact ? 44 : 50).foregroundStyle(p.color("onPrimary")).background(p.primary, in: Capsule())
                }.buttonStyle(.smooth).disabled(busy || (question != nil && answers[question!.id] == nil)).opacity(question != nil && answers[question!.id] == nil ? 0.45 : 1)
                HStack {
                    if index > 0 || onPrevious != nil { Button("Back") { if index > 0 { index -= 1 } else { onPrevious?() } }.frame(maxWidth: .infinity, minHeight: 44).disabled(busy) }
                    if let q = question { Button("Skip") { answers[q.id] = nil; onDraft?(answers); index += 1 }.frame(maxWidth: .infinity, minHeight: 44) }
                }
                Text(flow.privacy).font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            }
        }.animation(AppMotion.transition(reduced: reducedMotion), value: index)
            .animation(AppMotion.transition(reduced: reducedMotion), value: answers)
    }
    func save() { busy = true; error = ""; Task { do { try await onFinish(answers) } catch { self.error = error.localizedDescription }; busy = false } }
}
struct ConnectionSettingsView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var revision = 0
    @State private var busy = false
    @State private var error = ""
    var body: some View {
        ScrollViewReader { proxy in
        Page {
            Color.clear.frame(height: 0).id("connection-settings-top")
            if store.db.demo { InfoBanner(text: tr("Demo preferences stay on this device. Account preferences are saved privately to your account.")) }
            ConnectionQuestionsView(initial: store.connectionPreferences?.answers ?? [:], finishTitle: tr("Save my preferences"), onStepChange: { withAnimation { proxy.scrollTo("connection-settings-top", anchor: .top) } }) { answers in try await store.saveConnectionPreferences(answers); dismiss() }.id(revision)
            Button(busy ? "Clearing…" : "Clear my answers") { busy = true; Task { do { try await store.saveConnectionPreferences([:]); revision += 1 } catch { self.error = error.localizedDescription }; busy = false } }.disabled(busy)
            if !error.isEmpty { InfoBanner(text: error, icon: "exclamationmark.circle") }
        }.navigationTitle("Your connection preferences").navigationBarTitleDisplayMode(.inline)
        }
    }
}
