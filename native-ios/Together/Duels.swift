import SwiftUI

// Love Duels: turn-based board games, one move at a time. A match is a PlayEntry log:
// seq 0 = {type: start, variant}, then one entry per move. The creator moves first.

enum DuelVariant: String, CaseIterable { case four, dots
    var title: LocalizedStringKey { self == .four ? "Four in a Row" : "Dots & Boxes" }
    var emoji: String { self == .four ? "🔴" : "🔲" }
    var blurb: LocalizedStringKey { self == .four ? "Line up four of your hearts, across, down or diagonally." : "Draw lines between dots. Close a box to score it and play again." }
}

/// The replayed state of a match.
struct DuelState {
    var variant: DuelVariant
    var players: [String]          // [first, second]
    var turn: String               // whose move it is
    var winner: String?            // nil = still playing; "draw" when tied
    // Four in a row: columns bottom-up, 7 × 6.
    var columns: [[String]] = Array(repeating: [], count: 7)
    var winLine: [(Int, Int)] = []
    // Dots & boxes: 40 edges (20 horizontal, 20 vertical) and 16 boxes.
    var edges: [String?] = Array(repeating: nil, count: 40)
    var boxes: [String?] = Array(repeating: nil, count: 16)
    var moves = 0
    var lastMove: Int?

    static let rows = 6, cols = 7
    func score(_ id: String) -> Int { boxes.filter { $0 == id }.count }

    init?(_ log: [PlayEntry], members: [String]) {
        guard let start = log.first, start.data["type"] == "start", let v = DuelVariant(rawValue: start.data["variant"] ?? "") else { return nil }
        variant = v
        let other = members.first { $0 != start.user } ?? ""
        players = [start.user, other]; turn = start.user
        for e in log.dropFirst() where winner == nil && e.user == turn {
            guard let m = Int(e.data["move"] ?? "") else { continue }
            v == .four ? playFour(m) : playDots(m)
        }
    }
    func next(after id: String) -> String { id == players[0] ? players[1] : players[0] }

    mutating func playFour(_ col: Int) {
        guard (0..<Self.cols).contains(col), columns[col].count < Self.rows else { return }
        columns[col].append(turn); moves += 1; lastMove = col
        let row = columns[col].count - 1
        if let line = fourLine(col, row) { winner = turn; winLine = line }
        else if moves == Self.rows * Self.cols { winner = "draw" }
        else { turn = next(after: turn) }
    }
    func cell(_ c: Int, _ r: Int) -> String? { (0..<Self.cols).contains(c) && r >= 0 && r < columns[c].count ? columns[c][r] : nil }
    func fourLine(_ c: Int, _ r: Int) -> [(Int, Int)]? {
        let who = cell(c, r)
        for (dc, dr) in [(1, 0), (0, 1), (1, 1), (1, -1)] {
            var line = [(c, r)]
            var i = 1; while cell(c + dc * i, r + dr * i) == who { line.append((c + dc * i, r + dr * i)); i += 1 }
            i = 1; while cell(c - dc * i, r - dr * i) == who { line.append((c - dc * i, r - dr * i)); i += 1 }
            if line.count >= 4 { return line }
        }
        return nil
    }

    // Edge index: 0..<20 horizontal h(r 0...4, c 0...3) = r*4+c; 20..<40 vertical v(r 0...3, c 0...4) = 20+r*5+c.
    static func boxEdges(_ b: Int) -> [Int] { let r = b / 4, c = b % 4; return [r * 4 + c, (r + 1) * 4 + c, 20 + r * 5 + c, 20 + r * 5 + c + 1] }
    mutating func playDots(_ e: Int) {
        guard (0..<40).contains(e), edges[e] == nil else { return }
        edges[e] = turn; moves += 1; lastMove = e
        var closed = false
        for b in 0..<16 where boxes[b] == nil && Self.boxEdges(b).allSatisfy({ edges[$0] != nil }) { boxes[b] = turn; closed = true }
        if edges.allSatisfy({ $0 != nil }) {
            let a = score(players[0]), b = score(players[1]); winner = a == b ? "draw" : a > b ? players[0] : players[1]
        } else if !closed { turn = next(after: turn) }
    }
    var legalMoves: [Int] { variant == .four ? (0..<Self.cols).filter { columns[$0].count < Self.rows } : (0..<40).filter { edges[$0] == nil } }
}

extension Store {
    var duelMatches: [String] {
        plays(game: "duel").filter { $0.seq == 0 }.sorted { $0.created > $1.created }.map(\.match)
    }
    func duelState(_ match: String) -> DuelState? { DuelState(plays(match: match), members: couple?.members ?? []) }
    func startDuel(_ v: DuelVariant) throws -> String {
        let match = "duel-" + UUID().uuidString
        try addPlay(game: "duel", match: match, data: ["type": "start", "variant": v.rawValue])
        return match
    }
    func duelMove(_ match: String, _ move: Int) throws {
        guard let s = duelState(match), s.winner == nil, s.turn == db.currentUser, s.legalMoves.contains(move) else { return }
        var after = s; s.variant == .four ? after.playFour(move) : after.playDots(move)
        let passes = after.turn != s.turn || after.winner != nil
        try addPlay(game: "duel", match: match, data: ["move": String(move)], nudge: passes ? (s.variant == .four ? tr("Four in a Row") : tr("Dots & Boxes")) : nil)
        demoDuel(match)
    }
    /// Demo partner: takes its turn(s) a moment later.
    func demoDuel(_ match: String) {
        guard partnerIsDemo else { return }
        later { store in
            guard let s = store.duelState(match), s.winner == nil, let partner = store.partner, s.turn == partner.id else { return }
            var pick = s.legalMoves.randomElement()!
            if s.variant == .four {
                // Win if possible, otherwise block, otherwise random.
                for who in [partner.id, store.db.currentUser ?? ""] {
                    if let m = s.legalMoves.first(where: { c in var t = s; t.turn = who; t.playFour(c); return t.winner == who }) { pick = m; break }
                }
            } else if let m = s.legalMoves.first(where: { e in var t = s; t.playDots(e); return t.score(partner.id) > s.score(partner.id) }) { pick = m }
            store.addPartnerPlay(game: "duel", match: match, data: ["move": String(pick)])
            store.demoDuel(match)
        }
    }
}

struct DuelsView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var open: String?
    @State private var error: String?
    var body: some View {
        Page {
            GameHeader(emoji: "⚔️", title: "Love Duels", subtitle: "Play a move, your partner gets a nudge. A match can last all week.", colors: ["#8A7BFF", "#4A39D6"])
            SectionHeading(title: "New match")
            ForEach(DuelVariant.allCases, id: \.self) { v in
                Button { do { open = try store.startDuel(v) } catch { self.error = error.localizedDescription } } label: {
                    Card { HStack(spacing: 14) { Text(v.emoji).font(.largeTitle); VStack(alignment: .leading, spacing: 4) { Text(v.title).font(.headline); Text(v.blurb).font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "plus.circle.fill").font(.title2).foregroundStyle(p.primary) } }
                }.buttonStyle(.smooth)
            }
            let matches = store.duelMatches
            if !matches.isEmpty {
                SectionHeading(title: "Your matches")
                ForEach(matches, id: \.self) { m in
                    if let s = store.duelState(m) { NavigationLink { DuelBoardView(match: m) } label: { row(s) }.buttonStyle(.smooth) }
                }
            }
        }
        .navigationTitle("Love Duels").navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $open) { DuelBoardView(match: $0) }
        .alert(error ?? "", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") {} }
    }
    func row(_ s: DuelState) -> some View {
        let me = store.db.currentUser ?? ""
        let status: LocalizedStringKey = s.winner == "draw" ? "It's a draw" : s.winner == me ? "You won 🏆" : s.winner != nil ? "\(store.partner?.name ?? "") won" : s.turn == me ? "Your move" : "Waiting for \(store.partner?.name ?? "")"
        return Card { HStack { Text(s.variant.emoji).font(.title); VStack(alignment: .leading, spacing: 3) { Text(s.variant.title).font(.headline); Text(status).font(.caption).foregroundStyle(s.winner == nil && s.turn == me ? p.primary : .secondary) }; Spacer(); if s.variant == .dots { Text(verbatim: "\(s.score(me)) – \(s.score(s.next(after: me)))").font(.headline.monospacedDigit()) } } }
    }
}

struct DuelBoardView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    var match: String
    var me: String { store.db.currentUser ?? "" }
    var partnerName: String { store.partner?.name ?? tr("your partner") }
    let mine = Color(hex: "#E0306A"), theirs = Color(hex: "#7C5CFF")
    func color(_ id: String?) -> Color { id == nil ? .clear : id == me ? mine : theirs }

    var body: some View {
        Page {
            if let s = store.duelState(match) {
                status(s)
                if s.variant == .four { four(s) } else { dots(s) }
                legend(s)
                if s.winner != nil {
                    PrimaryButton(title: "Rematch") { if let m = try? store.startDuel(s.variant) { store.pendingDuel = m } }
                }
            }
        }
        .navigationTitle(store.duelState(match)?.variant.title ?? "Love Duels").navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $store.pendingDuel) { DuelBoardView(match: $0) }
    }

    func status(_ s: DuelState) -> some View {
        let text: LocalizedStringKey = s.winner == "draw" ? "It's a draw 🤝" : s.winner == me ? "You won! 🏆" : s.winner != nil ? "\(partnerName) won this one 💜" : s.turn == me ? "Your move" : "\(partnerName)'s move — we'll nudge them"
        return HStack { if s.winner == nil && s.turn != me { ProgressView() }; Text(text).font(.title3.bold()) }.frame(maxWidth: .infinity)
    }
    func legend(_ s: DuelState) -> some View {
        HStack(spacing: 18) {
            Label { Text(s.variant == .dots ? "You · \(s.score(me))" : "You") } icon: { Circle().fill(mine).frame(width: 14, height: 14) }
            Label { Text(s.variant == .dots ? "\(partnerName) · \(s.score(s.next(after: me)))" : "\(partnerName)") } icon: { Circle().fill(theirs).frame(width: 14, height: 14) }
        }.font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity)
    }

    func four(_ s: DuelState) -> some View {
        let canPlay = s.winner == nil && s.turn == me
        return HStack(spacing: 6) {
            ForEach(0..<DuelState.cols, id: \.self) { c in
                VStack(spacing: 6) {
                    ForEach((0..<DuelState.rows).reversed(), id: \.self) { r in
                        let who = s.cell(c, r); let win = s.winLine.contains { $0 == (c, r) }
                        Circle().fill(who == nil ? Color.white.opacity(0.9) : color(who))
                            .overlay(Circle().stroke(.white, lineWidth: win ? 3 : 0))
                            .scaleEffect(win ? 1.08 : 1).aspectRatio(1, contentMode: .fit)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture { if canPlay { store.perform { try store.duelMove(match, c) } } }
            }
        }
        .padding(10).background(Color(hex: "#4A39D6").opacity(0.12), in: RoundedRectangle(cornerRadius: 20))
        .animation(.spring(duration: 0.35), value: s.moves)
        .sensoryFeedback(.impact, trigger: s.moves)
    }

    func dots(_ s: DuelState) -> some View {
        let canPlay = s.winner == nil && s.turn == me
        return GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height), step = size / 4.6, o = step * 0.3
            ZStack(alignment: .topLeading) {
                ForEach(0..<16, id: \.self) { b in
                    if let who = s.boxes[b] {
                        RoundedRectangle(cornerRadius: 6).fill(color(who).opacity(0.3)).frame(width: step - 8, height: step - 8)
                            .overlay(Text(who == me ? "♥︎" : "♦︎").foregroundStyle(color(who)))
                            .offset(x: o + CGFloat(b % 4) * step + 4, y: o + CGFloat(b / 4) * step + 4)
                    }
                }
                ForEach(0..<40, id: \.self) { e in
                    let h = e < 20; let r = h ? e / 4 : (e - 20) / 5; let c = h ? e % 4 : (e - 20) % 5
                    let taken = s.edges[e]
                    Capsule().fill(taken == nil ? p.color("border").opacity(0.35) : color(taken))
                        .frame(width: h ? step - 12 : 7, height: h ? 7 : step - 12)
                        .padding(h ? 8 : 6)   // bigger tap target
                        .contentShape(Rectangle())
                        .onTapGesture { if canPlay && taken == nil { store.perform { try store.duelMove(match, e) } } }
                        .offset(x: o + CGFloat(c) * step + (h ? 6 : -3.5) - (h ? 8 : 6), y: o + CGFloat(r) * step + (h ? -3.5 : 6) - (h ? 8 : 6))
                }
                ForEach(0..<25, id: \.self) { d in
                    Circle().fill(p.text).frame(width: 10, height: 10).offset(x: o + CGFloat(d % 5) * step - 5, y: o + CGFloat(d / 5) * step - 5).allowsHitTesting(false)
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .animation(.easeOut(duration: 0.25), value: s.moves)
        .sensoryFeedback(.impact, trigger: s.moves)
    }
}
