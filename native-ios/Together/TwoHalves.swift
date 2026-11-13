import SwiftUI

// Two Halves: a daily puzzle split in two. Nine cards, one is today's secret.
// Each partner sees a different half of the clues, so neither can solve it alone:
// you have to talk (Messages, a call…) and then each locks in a pick.
// Both phones build the same puzzle from the couple id + couple day.

struct HalvesCard: Identifiable { var id: Int; var emoji: String; var name: String; var color: String; var kind: String }

private let halvesPool: [(String, String, String, String)] = [
    ("🍎", "apple", "red", "fruit"), ("🍓", "strawberry", "red", "fruit"), ("🌹", "rose", "red", "flower"), ("🦊", "fox", "orange", "animal"),
    ("🍊", "orange", "orange", "fruit"), ("🏀", "basketball", "orange", "thing"), ("🍋", "lemon", "yellow", "fruit"), ("🌻", "sunflower", "yellow", "flower"),
    ("🐥", "chick", "yellow", "animal"), ("⭐️", "star", "yellow", "thing"), ("🍀", "clover", "green", "flower"), ("🐸", "frog", "green", "animal"),
    ("🥝", "kiwi", "green", "fruit"), ("🌵", "cactus", "green", "flower"), ("🐳", "whale", "blue", "animal"), ("🫐", "blueberries", "blue", "fruit"),
    ("💎", "diamond", "blue", "thing"), ("🦋", "butterfly", "blue", "animal"), ("🍇", "grapes", "purple", "fruit"), ("🔮", "crystal ball", "purple", "thing"),
    ("🪻", "hyacinth", "purple", "flower"), ("🐙", "octopus", "purple", "animal"), ("🎈", "balloon", "red", "thing"), ("🐞", "ladybug", "red", "animal"),
]

struct HalvesPuzzle {
    var cards: [HalvesCard]
    var answer: Int
    /// Clues for each half: indexes of cards that are NOT the answer, phrased as attribute or card clues.
    var clues: [[LocalizedStringKey]]
    var halfOf: [String: Int]

    init(couple: Couple, day: String) {
        var rng = SeededRandom("\(couple.id)|\(day)|halves")
        let picks = Array(halvesPool.indices.shuffled(using: &rng).prefix(9))
        cards = picks.enumerated().map { i, k in let t = halvesPool[k]; return HalvesCard(id: i, emoji: t.0, name: t.1, color: t.2, kind: t.3) }
        answer = Int.random(in: 0..<9, using: &rng)
        let ans = cards[answer]
        // Build a pool of true "it's not…" clues: whole colours/kinds that exclude several cards, then single cards.
        var pool: [(LocalizedStringKey, Set<Int>)] = []
        for color in Set(cards.map(\.color)).sorted() where color != ans.color { pool.append(("It isn't \(tr(String.LocalizationValue(color))).", Set(cards.filter { $0.color == color }.map(\.id)))) }
        let kindClue: [String: LocalizedStringKey] = ["fruit": "It isn't a fruit.", "flower": "It isn't a flower or plant.", "animal": "It isn't an animal.", "thing": "It isn't an object."]
        for kind in Set(cards.map(\.kind)).sorted() where kind != ans.kind { pool.append((kindClue[kind] ?? "", Set(cards.filter { $0.kind == kind }.map(\.id)))) }
        for c in cards where c.id != answer { pool.append(("It isn't the \(c.emoji).", [c.id])) }
        pool.shuffle(using: &rng)
        // Give each half clues until it alone still leaves at least 3 candidates, and together they leave 1.
        var halves: [[(LocalizedStringKey, Set<Int>)]] = [[], []]
        var covered: [Set<Int>] = [[], []]
        let others = Set(cards.map(\.id)).subtracting([answer])
        var turn = 0
        for clue in pool {
            if covered[0].union(covered[1]) == others { break }
            let side = covered[turn].union(clue.1).count <= 6 ? turn : 1 - turn
            if covered[side].union(clue.1).count > 6 || clue.1.isSubset(of: covered[0].union(covered[1])) || clue.1.isSubset(of: covered[side]) { continue }
            halves[side].append(clue); covered[side].formUnion(clue.1); turn = 1 - turn
        }
        // Anything still uncovered gets a single-card clue on the emptier side.
        for id in others.subtracting(covered[0].union(covered[1])).sorted() {
            let side = covered[0].count <= covered[1].count ? 0 : 1
            halves[side].append(("It isn't the \(cards[id].emoji).", [id])); covered[side].insert(id)
        }
        clues = halves.map { $0.map(\.0) }
        let members = couple.members.sorted()
        halfOf = Dictionary(uniqueKeysWithValues: members.enumerated().map { ($1, $0) })
    }
}

extension Store {
    func halvesPuzzle(day: String? = nil) -> HalvesPuzzle? { couple.map { HalvesPuzzle(couple: $0, day: day ?? today) } }
    /// Each partner's pick lives in its own match so two picks never collide.
    func halvesPick(_ user: String, day: String? = nil) -> Int? {
        plays(match: "halves-\(day ?? today)-\(user)").first.flatMap { Int($0.data["pick"] ?? "") }
    }
    func lockHalves(_ pick: Int) throws {
        guard let me = db.currentUser, halvesPick(me) == nil else { return }
        let day = today
        try addPlay(game: "halves", match: "halves-\(day)-\(me)", data: ["pick": String(pick), "day": day], nudge: tr("Two Halves"))
        if partnerIsDemo, let partner, let puzzle = halvesPuzzle() {
            later { store in
                guard store.halvesPick(partner.id, day: day) == nil, let c = store.couple else { return }
                var all = store.db.plays ?? []
                all.append(PlayEntry(coupleID: c.id, game: "halves", match: "halves-\(day)-\(partner.id)", user: partner.id, seq: 0, data: ["pick": String(puzzle.answer), "day": day]))
                store.db.plays = all
            }
        }
    }
    /// Days solved together (both picked the answer).
    var halvesSolved: Int {
        guard let c = couple, c.members.count == 2 else { return 0 }
        let days = Set(plays(game: "halves").compactMap { $0.data["day"] })
        return days.filter { d in let pz = HalvesPuzzle(couple: c, day: d); return c.members.allSatisfy { halvesPick($0, day: d) == pz.answer } }.count
    }
}

struct TwoHalvesView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var selected: Int?
    @State private var crossed: Set<Int> = []
    var me: String { store.db.currentUser ?? "" }
    var partnerID: String { store.partner?.id ?? "" }
    var partnerName: String { store.partner?.name ?? tr("your partner") }

    var body: some View {
        Page {
            GameHeader(emoji: "🧩", title: "Two Halves", subtitle: "You each hold half the clues. Talk it through, then both pick the same card.", colors: ["#FFC43D", "#F08A00"])
            if let pz = store.halvesPuzzle() {
                let myPick = store.halvesPick(me), theirPick = store.halvesPick(partnerID)
                if let myPick, let theirPick { result(pz, myPick, theirPick) }
                else {
                    Card {
                        Label("Your half of the clues", systemImage: "eye.fill").font(.headline)
                        ForEach(Array(pz.clues[pz.halfOf[me] ?? 0].enumerated()), id: \.offset) { _, clue in Label(clue, systemImage: "xmark.circle").font(.subheadline) }
                        Text("\(partnerName) has the other half. Message or call them to compare.").font(.caption).foregroundStyle(.secondary)
                        NavigationLink { MessagesView() } label: { Label("Talk in Messages", systemImage: "bubble.left.and.bubble.right.fill") }
                    }
                    grid(pz, locked: myPick)
                    if let myPick { waiting(pz.cards[myPick]) }
                    else {
                        Text("Tap a card to cross it out. Long-press to choose it.").font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                        PrimaryButton(title: selected.map { tr("Lock in \(pz.cards[$0].emoji)") } ?? tr("Choose a card")) { if let selected { store.perform { try store.lockHalves(selected) } } }
                            .disabled(selected == nil).opacity(selected == nil ? 0.5 : 1)
                    }
                }
                Text("Solved together: \(store.halvesSolved) 🧩").font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("Two Halves").navigationBarTitleDisplayMode(.inline)
    }

    func grid(_ pz: HalvesPuzzle, locked: Int?) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
            ForEach(pz.cards) { c in
                let out = crossed.contains(c.id), chosen = (locked ?? selected) == c.id
                VStack(spacing: 4) { Text(c.emoji).font(.system(size: 40)); Text(LocalizedStringKey(c.name)).font(.caption2).lineLimit(1) }
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(chosen ? p.soft : p.surface, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(chosen ? p.primary : p.color("border"), lineWidth: chosen ? 2.5 : 1))
                    .opacity(out ? 0.3 : 1).overlay { if out { Image(systemName: "xmark").font(.largeTitle).foregroundStyle(.secondary) } }
                    .onTapGesture { guard locked == nil else { return }; if out { crossed.remove(c.id) } else { crossed.insert(c.id); if selected == c.id { selected = nil } } }
                    .onLongPressGesture { guard locked == nil else { return }; crossed.remove(c.id); selected = c.id }
                    .simultaneousGesture(TapGesture(count: 2).onEnded { guard locked == nil else { return }; crossed.remove(c.id); selected = c.id })
            }
        }
        .sensoryFeedback(.selection, trigger: crossed)
    }
    func waiting(_ card: HalvesCard) -> some View {
        Card { HStack(spacing: 12) { ProgressView(); Text("You picked \(card.emoji). Waiting for \(partnerName) to choose.").foregroundStyle(.secondary) } }
    }
    func result(_ pz: HalvesPuzzle, _ mine: Int, _ theirs: Int) -> some View {
        let solved = mine == pz.answer && theirs == pz.answer
        return Card {
            Text(solved ? "Solved together! 🎉" : "Not quite this time").font(.title2.bold())
            Text("Today's card was \(pz.cards[pz.answer].emoji)").font(.headline)
            HStack { Text("You: \(pz.cards[mine].emoji)"); Spacer(); Text("\(partnerName): \(pz.cards[theirs].emoji)") }.font(.title3)
            Text("Both halves of the clues:").font(.caption.bold()).foregroundStyle(.secondary)
            ForEach(Array((pz.clues[0] + pz.clues[1]).enumerated()), id: \.offset) { _, c in Text(c).font(.caption) }
            Text("A new puzzle arrives tomorrow.").font(.caption).foregroundStyle(.secondary)
        }
    }
}
