import SwiftUI

// Shared layer for the turn-based games (Love Duels, Draw & Guess, Two Halves).
// A game is an append-only log of PlayEntry moves. Each entry is written once by one
// partner and never edited, so the two phones can't conflict: both replay the same log.

struct PlayEntry: Codable, Identifiable {
    var id: String { "\(match)_\(seq)" }
    var coupleID: String; var game: String; var match: String; var user: String; var seq: Int
    var data: [String: String] = [:]
    var created = Date()
}

extension Store {
    func plays(match: String) -> [PlayEntry] {
        guard let c = couple else { return [] }
        return (db.plays ?? []).filter { $0.coupleID == c.id && $0.match == match }.sorted { $0.seq < $1.seq }
    }
    func plays(game: String) -> [PlayEntry] {
        guard let c = couple else { return [] }
        return (db.plays ?? []).filter { $0.coupleID == c.id && $0.game == game }
    }
    /// Appends my move. `nudge` sends the partner a "your move" notification.
    @discardableResult func addPlay(game: String, match: String, data: [String: String], nudge: String? = nil) throws -> PlayEntry {
        let c = try requireCouple(); guard let me = db.currentUser else { throw AppError(message: "Sign in first.") }
        let seq = (plays(match: match).last?.seq ?? -1) + 1
        let e = PlayEntry(coupleID: c.id, game: game, match: match, user: me, seq: seq, data: data)
        var all = db.plays ?? []; all.removeAll { $0.id == e.id }; all.append(e); db.plays = all
        if let nudge, usesRemoteCouple { Task { await CoupleSync.shared.sync(self); sendPartnerAlert(kind: "turn", place: nudge) } }
        return e
    }
    /// The demo partner's move (only used with the simulated partner).
    func addPartnerPlay(game: String, match: String, data: [String: String]) {
        guard let c = couple, let partner, partner.simulated else { return }
        let seq = (plays(match: match).last?.seq ?? -1) + 1
        var all = db.plays ?? []; all.append(PlayEntry(coupleID: c.id, game: game, match: match, user: partner.id, seq: seq, data: data)); db.plays = all
    }
    var partnerIsDemo: Bool { partner?.simulated == true }
}

/// A small deterministic random generator so both phones build the same daily puzzle.
struct SeededRandom: RandomNumberGenerator {
    var state: UInt64
    init(_ text: String) { state = text.utf8.reduce(1469598103934665603) { ($0 ^ UInt64($1)) &* 1099511628211 } }
    mutating func next() -> UInt64 { state ^= state << 13; state ^= state >> 7; state ^= state << 17; return state }
}

/// Header used by every game screen.
struct GameHeader: View {
    var emoji: String; var title: LocalizedStringKey; var subtitle: LocalizedStringKey; var colors: [String]
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(emoji).font(.system(size: 44))
            Text(title).font(.title.bold())
            Text(subtitle).font(.subheadline).opacity(0.85)
        }
        .foregroundStyle(.white).frame(maxWidth: .infinity, alignment: .leading).padding(22)
        .background(LinearGradient(colors: colors.map { Color(hex: $0) }, startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 26))
    }
}
