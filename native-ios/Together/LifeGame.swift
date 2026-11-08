import SwiftUI

// MARK: - "Our Little One" (mirrors src/lib/lifeGame.ts and the screens under src/app/games/life)
// Content comes from the shared product.json `lifeGame` block. Keep these rules in step with the TypeScript ones.

struct LifeNeedDef: Codable { var id: String; var label: String; var emoji: String; var decayPerHour: Double }
struct LifeSkillDef: Codable { var id: String; var label: String; var emoji: String }
struct LifeActionDef: Codable { var id: String; var label: String; var emoji: String; var verb: String; var effects: [String: Double]; var care: Int; var skills: [String: Int] }
struct LifeLook: Codable { var scale: Double; var hair: String; var accessory: String; var outfit: String }
struct LifeStageDef: Codable { var id: String; var label: String; var minDays: Double; var careToGrow: Int; var actions: [String]; var choice: String?; var look: LifeLook }
struct LifeOption: Codable { var id: String; var label: String; var emoji: String; var skills: [String: Int]?; var skill: String? }
struct LifeChoiceDef: Codable { var title: String; var prompt: String; var pick: Int?; var options: [LifeOption] }
struct LifeEndings: Codable { var complete: String; var early: String; var traits: [String: String] }
struct LifeContent: Codable {
    var maxDays: Double; var careThreshold: Double; var coinFlipRound: Int
    var needs: [LifeNeedDef]; var skills: [LifeSkillDef]; var actions: [LifeActionDef]; var stages: [LifeStageDef]
    var choices: [String: LifeChoiceDef]; var endings: LifeEndings
}

struct LifeVote: Codable, Identifiable, Equatable {
    var id = UUID().uuidString; var choice: String; var options: [String]; var round = 1
    var picks: [String: String] = [:]; var previousPicks: [String: String]?
    var decided = false; var result: String?; var coin = false; var opened = Date()
}
struct LifeLogEntry: Codable, Identifiable, Equatable { var id = UUID().uuidString; var userID: String; var action: String; var at: Date }
struct LifeMilestone: Codable, Identifiable, Equatable { var id = UUID().uuidString; var kind: String; var text: String; var at: Date }
struct LifeGame: Codable, Identifiable, Equatable {
    var id = UUID().uuidString; var coupleID: String; var status = "proposed"; var proposedBy: String; var acceptedBy: [String]
    var name: String?; var born: Date?; var stage = "newborn"; var stageStarted: Date?
    var needs: [String: Double]; var needsAt: Date; var care = 0; var skills: [String: Int]
    var decisions: [String: String] = [:]; var votes: [LifeVote] = []; var log: [LifeLogEntry] = []; var milestones: [LifeMilestone] = []
    var ended: Date?; var ending: String?; var clockOffset: TimeInterval = 0; var keepsakeSaved = false
}

enum Life {
    static var content: LifeContent { Product.shared.lifeGame }
    static let day: TimeInterval = 86400
    static func stage(_ id: String) -> LifeStageDef { content.stages.first { $0.id == id }! }
    static func action(_ id: String) -> LifeActionDef? { content.actions.first { $0.id == id } }
    static func choice(_ id: String) -> LifeChoiceDef { content.choices[id]! }
    static func label(_ choice: String, _ option: String?) -> String { Self.choice(choice).options.first { $0.id == option }?.label ?? option ?? "" }
    static func fill(_ name: String?, _ text: String, stage: String = "") -> String { text.replacingOccurrences(of: "{name}", with: name ?? "your little one").replacingOccurrences(of: "{stage}", with: stage.lowercased()) }
    static func now(_ g: LifeGame, real: Date = Date()) -> Date { real.addingTimeInterval(g.clockOffset) }
    static func fresh(_ value: Double = 80) -> [String: Double] { Dictionary(uniqueKeysWithValues: content.needs.map { ($0.id, value) }) }
    static func clamp(_ v: Double) -> Double { max(0, min(100, v)) }

    static func decayed(_ g: LifeGame, at now: Date) -> [String: Double] {
        guard g.status == "alive" else { return g.needs }
        let hours = max(0, now.timeIntervalSince(g.needsAt) / 3600)
        var out = g.needs
        for n in content.needs { out[n.id] = clamp((out[n.id] ?? 0) - n.decayPerHour * hours) }
        return out
    }
    static func average(_ needs: [String: Double]) -> Double { content.needs.reduce(0) { $0 + (needs[$1.id] ?? 0) } / Double(content.needs.count) }
    static func mood(_ needs: [String: Double]) -> String {
        if average(needs) < content.careThreshold { return "sad" }
        let lowest = content.needs.min { (needs[$0.id] ?? 0) < (needs[$1.id] ?? 0) }!
        if (needs[lowest.id] ?? 0) >= 35 { return "happy" }
        return ["hunger": "hungry", "energy": "sleepy", "hygiene": "dirty", "fun": "bored", "love": "lonely"][lowest.id] ?? "happy"
    }
    static func ageDays(_ g: LifeGame, at now: Date) -> Double { g.born.map { now.timeIntervalSince($0) / day } ?? 0 }
    static func daysInStage(_ g: LifeGame, at now: Date) -> Double { g.stageStarted.map { now.timeIntervalSince($0) / day } ?? 0 }
    static func pendingChoice(_ g: LifeGame) -> String? { guard let c = stage(g.stage).choice, g.decisions[c] == nil else { return nil }; return c }
    static func canGrow(_ g: LifeGame, at now: Date) -> Bool {
        guard g.status == "alive" else { return false }
        let st = stage(g.stage)
        return g.care >= st.careToGrow && daysInStage(g, at: now) >= st.minDays && pendingChoice(g) == nil
    }
    static func progress(_ g: LifeGame, at now: Date) -> Double {
        let st = stage(g.stage)
        return min(1, Double(g.care) / Double(st.careToGrow)) * 0.7 + min(1, daysInStage(g, at: now) / st.minDays) * 0.3
    }
    static func options(_ g: LifeGame, _ choice: String) -> [String] {
        let def = Self.choice(choice)
        guard choice == "job" else { return def.options.map(\.id) }
        let ranked = def.options.enumerated().sorted { a, b in
            let sa = a.element.skill.flatMap { g.skills[$0] } ?? 0, sb = b.element.skill.flatMap { g.skills[$0] } ?? 0
            return sa != sb ? sa > sb : a.offset < b.offset
        }
        return ranked.prefix(def.pick ?? 3).map(\.element.id)
    }
    static func cast(_ vote: LifeVote, user: String, option: String, members: [String], coin: () -> Bool = { Bool.random() }) throws -> LifeVote {
        guard !vote.decided else { throw AppError(message: "This choice is already decided.") }
        guard vote.options.contains(option) else { throw AppError(message: "That option is not available.") }
        guard members.contains(user) else { throw AppError(message: "Only the two parents can vote.") }
        var v = vote; v.picks[user] = option
        guard members.allSatisfy({ v.picks[$0] != nil }) else { return v }
        let a = v.picks[members[0]]!, b = v.picks[members[1]]!
        if a == b { v.decided = true; v.result = a; return v }
        if v.round >= content.coinFlipRound { v.decided = true; v.coin = true; v.result = coin() ? a : b; return v }
        v.round += 1; v.previousPicks = v.picks; v.picks = [:]; return v
    }
    static func endingText(_ g: LifeGame, complete: Bool) -> String {
        let base = fill(g.name, complete ? content.endings.complete : content.endings.early, stage: stage(g.stage).label)
        let top = content.skills.map(\.id).reduce(content.skills[0].id) { (g.skills[$1] ?? 0) > (g.skills[$0] ?? 0) ? $1 : $0 }
        return (g.skills[top] ?? 0) > 0 ? base + " " + (content.endings.traits[top] ?? "") : base
    }
    static func apply(_ g: LifeGame, action id: String, user: String, at now: Date) throws -> LifeGame {
        guard g.status == "alive" else { throw AppError(message: "Your little one isn’t here to look after right now.") }
        guard stage(g.stage).actions.contains(id), let a = action(id) else { throw AppError(message: "That isn’t something they need at this age.") }
        var next = g; var needs = decayed(g, at: now)
        for (k, v) in a.effects { needs[k] = clamp((needs[k] ?? 0) + v) }
        next.needs = needs; next.needsAt = now
        if average(needs) >= content.careThreshold { next.care += a.care }
        for (k, v) in a.skills { next.skills[k, default: 0] += v }
        next.log.insert(LifeLogEntry(userID: user, action: id, at: now), at: 0); next.log = Array(next.log.prefix(60))
        return next
    }
    static func decide(_ g: LifeGame, _ vote: LifeVote, at now: Date) -> LifeGame {
        guard vote.decided, let result = vote.result, let opt = choice(vote.choice).options.first(where: { $0.id == result }) else { return g }
        var next = g
        for (k, v) in opt.skills ?? [:] { next.skills[k, default: 0] += v }
        if let s = opt.skill { next.skills[s, default: 0] += 10 }
        next.decisions[vote.choice] = result
        let how = vote.coin ? " (a coin flip settled it)" : ""
        let short = opt.label.components(separatedBy: ",").first ?? opt.label
        switch vote.choice {
        case "name":
            next.name = opt.label; next.status = "alive"; next.born = now; next.stageStarted = now; next.needs = fresh(80); next.needsAt = now
            next.milestones.insert(LifeMilestone(kind: "born", text: "\(opt.label) was born\(how). Welcome to the world! 🍼", at: now), at: 0)
        case "school": next.milestones.insert(LifeMilestone(kind: "choice", text: "\(next.name ?? "") started at \(opt.label)\(how). 🎒", at: now), at: 0)
        case "hobby": next.milestones.insert(LifeMilestone(kind: "choice", text: "\(next.name ?? "") found a passion: \(opt.label.lowercased())\(how).", at: now), at: 0)
        case "job": next.milestones.insert(LifeMilestone(kind: "choice", text: "\(next.name ?? "") got their first job as a \(opt.label.lowercased())\(how). 💼", at: now), at: 0)
        default:
            next.milestones.insert(LifeMilestone(kind: "choice", text: "\(next.name ?? "") fell in love with \(short)\(how).", at: now), at: 0)
            next.milestones.insert(LifeMilestone(kind: "wedding", text: "Wedding day! \(next.name ?? "") and \(short) got married. 💍", at: now), at: 0)
        }
        return next
    }
    static func evaluate(_ game: LifeGame, at now: Date) -> LifeGame {
        guard game.status == "alive" else { return game }
        var g = game; g.needs = decayed(game, at: now); g.needsAt = now
        func end(_ complete: Bool) -> LifeGame {
            var e = g; e.status = "ended"; e.ended = now; e.ending = endingText(g, complete: complete); e.votes = g.votes.filter(\.decided)
            e.milestones.insert(LifeMilestone(kind: "ended", text: complete ? "\(g.name ?? "") lived a full life. 🕊️" : "A year has passed. \(g.name ?? "")'s story ends here.", at: now), at: 0)
            return e
        }
        if ageDays(g, at: now) >= content.maxDays { return end(g.stage == "elder") }
        while canGrow(g, at: now) {
            let i = content.stages.firstIndex { $0.id == g.stage }!
            if i == content.stages.count - 1 { return end(true) }
            let next = content.stages[i + 1]
            let article = "aeiou".contains(next.label.lowercased().first!) ? "an" : "a"
            g.stage = next.id; g.stageStarted = now; g.care = 0
            g.milestones.insert(LifeMilestone(kind: "grew", text: "\(g.name ?? "") is now \(next.id == "partnered" ? "a grown-up looking for love" : "\(article) \(next.label.lowercased())")! 🎉", at: now), at: 0)
        }
        if let c = pendingChoice(g), !g.votes.contains(where: { $0.choice == c }) { g.votes.append(LifeVote(choice: c, options: options(g, c), opened: now)) }
        return g
    }
    static func fastForward(_ game: LifeGame, days: Double, real: Date = Date()) -> LifeGame {
        guard game.status == "alive" else { return game }
        var g = game; g.clockOffset += days * day
        let now = real.addingTimeInterval(g.clockOffset)
        for s in content.skills { g.skills[s.id, default: 0] += Int((days * 0.5).rounded()) }
        g.care = min(g.care + Int(days * 130), stage(g.stage).careToGrow); g.needs = fresh(85); g.needsAt = now
        return evaluate(g, at: now)
    }
}

// MARK: - Store operations
extension Store {
    var lifeGame: LifeGame? { guard let c = couple else { return nil }; return db.lifeGames?.first { $0.coupleID == c.id } }
    private func saveLife(_ g: LifeGame) { var all = db.lifeGames ?? []; if let i = all.firstIndex(where: { $0.id == g.id }) { all[i] = g } else { all.insert(g, at: 0) }; db.lifeGames = all }
    func refreshLife() {
        guard let g = lifeGame else { return }
        let next = Life.evaluate(g, at: Life.now(g)); if next != g { saveLife(next) }
        simulateLifeCare()
    }
    func proposeBaby() throws {
        let c = try requireCouple(); guard let me = db.currentUser else { return }
        if let g = lifeGame, g.status != "ended" { return }
        saveLife(LifeGame(coupleID: c.id, proposedBy: me, acceptedBy: [me], needs: Life.fresh(80), needsAt: Date(), skills: Dictionary(uniqueKeysWithValues: Life.content.skills.map { ($0.id, 0) }), milestones: [LifeMilestone(kind: "proposed", text: "A baby was proposed. 💞", at: Date())]))
        if partner?.simulated == true { later { store in try? store.acceptBaby(as: "demo-partner") } }
    }
    func respondToBaby(_ accept: Bool) throws {
        guard let g = lifeGame, g.status == "proposed" else { throw AppError(message: "There is no baby proposal waiting.") }
        guard g.proposedBy != db.currentUser else { throw AppError(message: "Your partner has to answer this one.") }
        if accept { try acceptBaby(as: db.currentUser!) } else { db.lifeGames?.removeAll { $0.id == g.id } }
    }
    fileprivate func acceptBaby(as user: String) throws {
        guard var g = lifeGame, g.status == "proposed" else { return }
        g.status = "naming"; g.acceptedBy = Array(Set(g.acceptedBy + [user])); g.votes = [LifeVote(choice: "name", options: Life.options(g, "name"))]
        saveLife(g); simulateLifeVote()
    }
    func lifeAction(_ id: String) throws {
        guard let g = lifeGame, let me = db.currentUser else { throw AppError(message: "You don’t have a little one yet.") }
        let now = Life.now(g)
        saveLife(Life.evaluate(try Life.apply(Life.evaluate(g, at: now), action: id, user: me, at: now), at: now))
        simulateLifeCare()
    }
    func castLifeVote(_ voteID: String, option: String) throws {
        guard let me = db.currentUser else { return }
        try resolveLifeVote(voteID, user: me, option: option); simulateLifeVote()
    }
    fileprivate func resolveLifeVote(_ voteID: String, user: String, option: String) throws {
        guard var g = lifeGame, let i = g.votes.firstIndex(where: { $0.id == voteID }), let c = couple else { throw AppError(message: "This choice no longer exists.") }
        guard g.votes[i].picks[user] == nil else { throw AppError(message: "You already picked. Waiting for your partner.") }
        let vote = try Life.cast(g.votes[i], user: user, option: option, members: c.members); g.votes[i] = vote
        if vote.decided { let now = Life.now(g); g = Life.evaluate(Life.decide(g, vote, at: now), at: now) }
        saveLife(g)
    }
    func fastForwardLife(days: Double) throws {
        guard db.demo else { throw AppError(message: "Fast-forward is only available in the demo.") }
        guard let g = lifeGame, g.status == "alive" else { throw AppError(message: "There is no little one to fast-forward.") }
        saveLife(Life.fastForward(g, days: days)); simulateLifeVote(); simulateLifeCare()
    }
    func saveLifeKeepsake() throws {
        guard var g = lifeGame, g.status == "ended", let c = couple, let me = db.currentUser else { throw AppError(message: "The story isn’t finished yet.") }
        guard !g.keepsakeSaved else { throw AppError(message: "This story is already in your Memories.") }
        let story = g.milestones.reversed().map { "• \($0.text)" }.joined(separator: "\n")
        db.memories.append(Memory(coupleID: c.id, owner: me, title: "The life of \(g.name ?? "")", body: "\(g.ending ?? "")\n\n\(story)", day: today))
        g.keepsakeSaved = true; saveLife(g)
    }
    /// The simulated partner votes, leaning towards your pick (or your last-round pick).
    private func simulateLifeVote() {
        guard partner?.simulated == true, let me = db.currentUser else { return }
        later { store in
            guard let g = store.lifeGame, let v = g.votes.first(where: { !$0.decided }), v.picks["demo-partner"] == nil else { return }
            let mine = v.picks[me] ?? v.previousPicks?[me]
            let pick = mine.flatMap { Double.random(in: 0...1) < 0.75 ? $0 : nil } ?? v.options.randomElement()!
            try? store.resolveLifeVote(v.id, user: "demo-partner", option: pick)
            store.simulateLifeVote()
        }
    }
    /// The simulated partner looks after the child now and then so co-parenting shows in the log.
    private func simulateLifeCare() {
        guard partner?.simulated == true, let g = lifeGame, g.status == "alive" else { return }
        if let last = g.log.first(where: { $0.userID == "demo-partner" }), Life.now(g).timeIntervalSince(last.at) < 90 { return }
        later { store in
            guard let cur = store.lifeGame, cur.status == "alive" else { return }
            let now = Life.now(cur); let fresh = Life.evaluate(cur, at: now)
            let neediest = Life.content.needs.min { (fresh.needs[$0.id] ?? 0) < (fresh.needs[$1.id] ?? 0) }!.id
            let actions = Life.stage(fresh.stage).actions
            let pick = actions.first { (Life.action($0)?.effects[neediest] ?? 0) > 0 } ?? actions[0]
            if let next = try? Life.apply(fresh, action: pick, user: "demo-partner", at: now) { store.db.lifeGames = (store.db.lifeGames ?? []).map { $0.id == next.id ? Life.evaluate(next, at: now) : $0 } }
        }
    }
}

// MARK: - Character
struct BabyView: View {
    var look: LifeLook; var mood: String; var size: CGFloat = 240; var name: String?
    /// What the child is doing right now: "feed" chews, "bathe" adds shampoo foam, "sleep" closes the eyes.
    var pose: String? = nil
    /// An item is held over the child: they lean in and look eager (anticipation).
    var eager = false
    var onPoke: () -> Void = {}
    @State private var chew = false
    /// Squash & stretch: 0 = rest, -1 = squashed flat, 1 = stretched tall.
    @State private var squash: CGFloat = 0
    @State private var breathe = false
    @State private var blink = false
    @State private var jump = false
    static let skin = Color(hex: "#FFD9C2"), shade = Color(hex: "#F6C3A6"), ink = Color(hex: "#2B1E2F")
    var s: CGFloat { size * look.scale }
    var head: CGFloat { s * 0.62 }
    var hairColor: Color { look.hair == "grey" ? Color(hex: "#CFCFD6") : Color(hex: "#5B3A29") }
    var happy: Bool { mood == "happy" || eager }
    var sad: Bool { mood == "sad" || mood == "lonely" }
    let bubbles = ["hungry": "🍼", "sleepy": "💤", "dirty": "🫧", "bored": "🎈", "lonely": "💗", "sad": "💧"]
    func cheer() {
        // Squash on the event, stretch on the way up, squash on landing, spring back past rest.
        squash = -1
        withAnimation(.easeOut(duration: 0.14)) { squash = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) { withAnimation(.easeIn(duration: 0.16)) { squash = -0.6 } }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { withAnimation(.spring(response: 0.3, dampingFraction: 0.3)) { squash = 0 } }
        withAnimation(.spring(response: 0.25, dampingFraction: 0.4)) { jump = true }; DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) { withAnimation(.spring(response: 0.35, dampingFraction: 0.5)) { jump = false } } }
    var body: some View {
        Button { cheer(); onPoke() } label: {
            ZStack(alignment: .bottom) {
                Ellipse().fill(.black.opacity(0.12)).frame(width: s * 0.7, height: s * 0.09)
                VStack(spacing: -head * 0.08) { headView; bodyView }
                    .overlay(alignment: .top) { if pose == "bathe" { ZStack { ForEach(Array([(-0.35, 0.05, 0.34), (-0.1, -0.08, 0.42), (0.18, -0.05, 0.38), (0.38, 0.06, 0.28)].enumerated()), id: \.offset) { _, f in Circle().fill(.white).frame(width: head * f.2).offset(x: head * f.0, y: head * f.1) } }.offset(y: -head * 0.05) } }
                    .overlay(alignment: .topTrailing) { if pose == nil, let b = bubbles[mood] { Text(b).font(.system(size: s * 0.11)).padding(6).background(.white, in: Capsule()).shadow(radius: 3).offset(x: s * 0.18, y: -s * 0.05) } }
                    .scaleEffect(breathe ? 1.035 : 1, anchor: .bottom)
                    .scaleEffect(x: squash < 0 ? 1 - squash * 0.22 : 1 - squash * 0.14, y: squash < 0 ? 1 + squash * 0.2 : 1 + squash * 0.16, anchor: .bottom)
                    .scaleEffect(eager ? 1.07 : 1, anchor: .bottom)
                    .offset(y: eager ? -s * 0.03 : 0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.5), value: eager)
                    .offset(y: (jump ? -s * 0.18 : 0) - s * 0.04)
                    .rotationEffect(.degrees(jump ? 5 : 0))
            }.frame(width: s * 1.1, height: s * 1.25, alignment: .bottom)
        }
        .buttonStyle(.smooth)
        .sensoryFeedback(.impact(weight: .light), trigger: jump)
        .accessibilityLabel("\(name ?? "Your little one"), feeling \(mood). Tap to play.")
        .onAppear { withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { breathe = true } }
        .task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(Double.random(in: 2.5...5))); withAnimation(.easeInOut(duration: 0.08)) { blink = true }; try? await Task.sleep(for: .milliseconds(140)); withAnimation(.easeInOut(duration: 0.1)) { blink = false } } }
    }
    var headView: some View {
        ZStack {
            if look.hair == "long" { RoundedRectangle(cornerRadius: head * 0.4).fill(hairColor).frame(width: head * 1.08, height: head * 0.95).offset(y: head * 0.18) }
            HStack { Capsule().fill(Self.shade).frame(width: head * 0.16, height: head * 0.2); Spacer(); Capsule().fill(Self.shade).frame(width: head * 0.16, height: head * 0.2) }.frame(width: head * 1.12).offset(y: head * 0.05)
            Ellipse().fill(Self.skin).frame(width: head, height: head * 0.94)
            if look.hair == "tuft" { Capsule().fill(hairColor).frame(width: head * 0.14, height: head * 0.22).rotationEffect(.degrees(-20)).offset(y: -head * 0.5) }
            if ["short", "grey", "long"].contains(look.hair) { UnevenRoundedRectangle(topLeadingRadius: head * 0.5, bottomLeadingRadius: head * 0.12, bottomTrailingRadius: head * 0.28, topTrailingRadius: head * 0.5).fill(hairColor).frame(width: head * 1.02, height: head * 0.42).offset(y: -head * 0.27) }
            if look.accessory == "headphones" { Circle().trim(from: 0.5, to: 1).stroke(Color(hex: "#3A3550"), lineWidth: head * 0.05).frame(width: head * 1.08).offset(y: -head * 0.05); HStack { RoundedRectangle(cornerRadius: head * 0.08).fill(Color(hex: "#3A3550")).frame(width: head * 0.18, height: head * 0.26); Spacer(); RoundedRectangle(cornerRadius: head * 0.08).fill(Color(hex: "#3A3550")).frame(width: head * 0.18, height: head * 0.26) }.frame(width: head * 1.2).offset(y: head * 0.05) }
            if sad { HStack(spacing: head * 0.2) { Capsule().fill(Self.ink).frame(width: head * 0.17, height: head * 0.035).rotationEffect(.degrees(-18)); Capsule().fill(Self.ink).frame(width: head * 0.17, height: head * 0.035).rotationEffect(.degrees(18)) }.offset(y: -head * 0.07) }
            HStack(spacing: head * 0.24) {
                ForEach(0..<2, id: \.self) { _ in
                    if (mood == "sleepy" || pose == "sleep") && !eager { Capsule().fill(Self.ink).frame(width: head * 0.15, height: head * 0.035) }
                    else { Ellipse().fill(Self.ink).frame(width: head * 0.11, height: head * 0.14).overlay(alignment: .topLeading) { Circle().fill(.white).frame(width: head * 0.04).offset(x: head * 0.02, y: head * 0.02) }.scaleEffect(x: 1, y: blink ? 0.1 : 1) }
                }
            }.offset(y: head * 0.04)
            if look.accessory == "glasses" { HStack(spacing: 0) { RoundedRectangle(cornerRadius: head * 0.1).stroke(Color(hex: "#6B5A4E"), lineWidth: head * 0.025).frame(width: head * 0.26, height: head * 0.22); Rectangle().fill(Color(hex: "#6B5A4E")).frame(width: head * 0.06, height: head * 0.025); RoundedRectangle(cornerRadius: head * 0.1).stroke(Color(hex: "#6B5A4E"), lineWidth: head * 0.025).frame(width: head * 0.26, height: head * 0.22) }.offset(y: head * 0.04) }
            HStack(spacing: head * 0.46) { Ellipse().fill(Color(hex: "#FF9DB0").opacity(0.75)).frame(width: head * 0.13, height: head * 0.08); Ellipse().fill(Color(hex: "#FF9DB0").opacity(0.75)).frame(width: head * 0.13, height: head * 0.08) }.offset(y: head * 0.18)
            mouth.offset(y: head * 0.24)
            if mood == "dirty" && pose != "bathe" { Ellipse().fill(Color(hex: "#9C7B5B").opacity(0.7)).frame(width: head * 0.1, height: head * 0.07).offset(x: -head * 0.25, y: -head * 0.2) }
        }
    }
    @ViewBuilder var mouth: some View {
        if pose == "feed" { Ellipse().fill(Color(hex: "#B5445C")).frame(width: head * 0.16, height: head * 0.14).scaleEffect(x: 1, y: chew ? 0.25 : 1).onAppear { withAnimation(.easeInOut(duration: 0.16).repeatForever(autoreverses: true)) { chew = true } }.onDisappear { chew = false } }
        else if pose == "sleep" { Circle().fill(Color(hex: "#B5445C")).frame(width: head * 0.08).offset(y: head * 0.03) }
        else if look.accessory == "pacifier" && mood != "hungry" { Circle().fill(Color(hex: "#8FD3FF")).frame(width: head * 0.2).overlay(Circle().stroke(.white, lineWidth: head * 0.025)).overlay(Circle().fill(.white).frame(width: head * 0.07)) }
        else if mood == "hungry" { Ellipse().fill(Color(hex: "#B5445C")).frame(width: head * 0.12, height: head * 0.14) }
        else if sad { Circle().trim(from: 0.55, to: 0.95).stroke(Self.ink, style: StrokeStyle(lineWidth: head * 0.022, lineCap: .round)).frame(width: head * 0.2).offset(y: head * 0.06) }
        else if happy { UnevenRoundedRectangle(bottomLeadingRadius: head * 0.12, bottomTrailingRadius: head * 0.12).fill(Color(hex: "#B5445C")).frame(width: head * 0.22, height: head * 0.12) }
        else { Circle().trim(from: 0.05, to: 0.45).stroke(Self.ink, style: StrokeStyle(lineWidth: head * 0.022, lineCap: .round)).frame(width: head * 0.16).offset(y: -head * 0.05) }
    }
    var bodyView: some View {
        let outfit = Color(hex: look.outfit)
        return ZStack(alignment: .top) {
            HStack { Capsule().fill(outfit).frame(width: s * 0.13, height: s * 0.24).rotationEffect(.degrees(happy ? 35 : -12)); Spacer(); Capsule().fill(outfit).frame(width: s * 0.13, height: s * 0.24).rotationEffect(.degrees(happy ? -35 : 12)) }.frame(width: s * 0.62).offset(y: s * 0.08)
            UnevenRoundedRectangle(topLeadingRadius: s * 0.22, bottomLeadingRadius: s * 0.14, bottomTrailingRadius: s * 0.14, topTrailingRadius: s * 0.22).fill(outfit).frame(width: s * 0.5, height: s * 0.42)
            if look.accessory == "tie" { Path { p in p.move(to: .zero); p.addLine(to: CGPoint(x: s * 0.08, y: 0)); p.addLine(to: CGPoint(x: s * 0.04, y: s * 0.17)); p.closeSubpath() }.fill(Color(hex: "#C0395B")).frame(width: s * 0.08, height: s * 0.17).offset(y: s * 0.03) }
            if look.accessory == "backpack" { HStack(spacing: s * 0.18) { Capsule().fill(Color(hex: "#E2574C")).frame(width: s * 0.04, height: s * 0.3); Capsule().fill(Color(hex: "#E2574C")).frame(width: s * 0.04, height: s * 0.3) } }
            if look.accessory == "ring" { Text("💍").font(.system(size: s * 0.08)).offset(x: -s * 0.28, y: s * 0.28) }
            HStack(spacing: s * 0.1) { Capsule().fill(Color(hex: "#5A4B6B")).frame(width: s * 0.14, height: s * 0.07); Capsule().fill(Color(hex: "#5A4B6B")).frame(width: s * 0.14, height: s * 0.07) }.offset(y: s * 0.4)
        }.frame(height: s * 0.46, alignment: .top)
    }
}

// MARK: - Room scene

/// Wall, floor and props for each age. Props wiggle when tapped.
struct LifeRoomTheme { var wall: String; var floor: String; var rug: String; var art: String; var props: [(String, CGFloat, CGFloat, CGFloat)] }
let lifeRooms: [String: LifeRoomTheme] = [
    "newborn": .init(wall: "#DCEEFF", floor: "#C9DDF2", rug: "#FFFFFF", art: "⭐", props: [("🧸", 0.06, 26, 40), ("🛏️", 0.76, 22, 52)]),
    "toddler": .init(wall: "#FFF1C9", floor: "#F1D39A", rug: "#FFB37A", art: "🌈", props: [("🧱", 0.05, 24, 34), ("🪀", 0.17, 50, 26), ("🦆", 0.8, 24, 38)]),
    "child": .init(wall: "#D7F5E6", floor: "#B7DCC4", rug: "#6CC79A", art: "🗺️", props: [("🎒", 0.06, 24, 38), ("📚", 0.78, 24, 40)]),
    "teen": .init(wall: "#E6DEFF", floor: "#C7BCEB", rug: "#8E7CF0", art: "🎸", props: [("🛹", 0.05, 22, 38), ("🎮", 0.8, 26, 34)]),
    "adult": .init(wall: "#DDF3FA", floor: "#B9D9E5", rug: "#5FB3D4", art: "🖼️", props: [("🪴", 0.05, 22, 44), ("💻", 0.8, 26, 36)]),
    "partnered": .init(wall: "#FFE2E8", floor: "#F0C3CD", rug: "#FF8FAB", art: "💞", props: [("🕯️", 0.07, 26, 32), ("🪴", 0.8, 22, 44)]),
    "elder": .init(wall: "#F3EBDD", floor: "#DCC9A8", rug: "#B98A5E", art: "🕰️", props: [("🧶", 0.06, 24, 34), ("🪑", 0.78, 22, 46)]),
]

struct LifeParticle: Identifiable, Equatable {
    enum Kind { case rise, eaten, bounce, pop, number }
    let id = UUID(); var emoji: String; var x: CGFloat; var y: CGFloat; var kind: Kind = .rise
    var size: CGFloat = 26; var dx: CGFloat = 0; var rise: CGFloat = 120; var delay: Double = 0; var duration: Double = 1.3
    static func burst(_ emojis: [String], x: CGFloat, y: CGFloat, count: Int, rise: CGFloat? = nil, delay: Double = 0, duration: Double = 1.3) -> [LifeParticle] {
        (0..<count).map { i in LifeParticle(emoji: emojis[i % emojis.count], x: x + .random(in: -40...40), y: y + .random(in: -15...15), size: .random(in: 18...32), dx: .random(in: -35...35), rise: rise ?? .random(in: 90...180), delay: delay + Double(i) * 0.09, duration: duration) }
    }
}

/// One floating emoji that plays its motion once.
struct LifeParticleView: View {
    let p: LifeParticle
    @State private var t: CGFloat = 0
    var body: some View {
        Group { if p.kind == .number { Text(p.emoji).font(.system(size: p.size, weight: .black, design: .rounded)).foregroundStyle(.white).shadow(color: lifeInkShadow, radius: 4, y: 2).fixedSize() } else { Text(p.emoji).font(.system(size: p.size)) } }
            .modifier(LifeParticleMotion(p: p, t: t))
            .position(x: p.x, y: p.y)
            .allowsHitTesting(false)
            .onAppear { withAnimation(p.kind == .bounce ? .linear(duration: 1.8).delay(p.delay) : .easeOut(duration: p.duration).delay(p.delay)) { t = 1 } }
    }
}

/// Animatable so the bounce and the bite-by-bite eating follow keyframe-like curves.
struct LifeParticleMotion: ViewModifier, Animatable {
    var p: LifeParticle; var t: CGFloat
    var animatableData: CGFloat { get { t } set { t = newValue } }
    func body(content: Content) -> some View {
        switch p.kind {
        case .rise: content.scaleEffect(t < 0.2 ? 0.3 + t * 4 : 1.1 - (t - 0.2) * 0.25).offset(x: p.dx * t, y: -p.rise * t).opacity(t < 0.7 ? 1 : (1 - t) / 0.3)
        case .eaten:
            let fly = min(1, t / 0.35); let bite = max(0, (t - 0.35) / 0.65)
            content.scaleEffect(t < 0.35 ? 1 : max(0, 1 - (bite < 0.5 ? (bite < 0.25 ? bite : 0.25) : bite) * 1.0)).rotationEffect(.degrees(-30 + 30 * fly)).offset(x: p.dx * (1 - fly), y: -p.rise * (1 - fly))
        case .bounce:
            let h = abs(sin(t * .pi * 3)) * 120 * (1 - t * 0.7)
            content.rotationEffect(.degrees(720 * t)).offset(x: p.dx * t, y: -h).opacity(t > 0.9 ? (1 - t) * 10 : 1)
        case .number: content.scaleEffect(t < 0.15 ? 0.2 + t / 0.15 * 1.15 : t < 0.3 ? 1.35 - (t - 0.15) / 0.15 * 0.35 : 1).offset(y: -p.rise * t).opacity(t < 0.75 ? 1 : (1 - t) / 0.25)
        case .pop: content.scaleEffect(t < 0.3 ? t / 0.3 * 1.3 : 1.3 + (t - 0.3) * 0.4).opacity(t < 0.6 ? 1 : (1 - t) / 0.4)
        }
    }
}

private let lifeInkShadow = Color(hex: "#2B1E2F").opacity(0.55)

/// Feedback tiers from the game-feel skill: small = toy or poke, medium = care lands, large = grows up.
enum LifeFeel { case small, medium, large
    var trauma: Double { switch self { case .small: 0; case .medium: 0.25; case .large: 0.8 } }
}

/// Decaying "trauma" shake: shake = trauma², layered sines (not random jitter), always returns to rest.
struct LifeShake: ViewModifier {
    var trauma: Double; var since: Date
    func body(content: Content) -> some View {
        TimelineView(.animation(paused: trauma <= 0)) { tl in
            let t = tl.date.timeIntervalSince(since)
            let k = pow(max(0, trauma - 1.3 * t), 2)
            content.offset(x: 12 * k * (0.6 * sin(t * 37) + 0.4 * sin(t * 71)), y: 8 * k * (0.6 * sin(t * 43 + 1) + 0.4 * sin(t * 67 + 2))).rotationEffect(.degrees(4 * k * sin(t * 29)))
        }
    }
}

/// Pops a HUD element with overshoot when its value goes up.
struct PopOnIncrease: ViewModifier {
    var value: Double
    @State private var scale: CGFloat = 1
    func body(content: Content) -> some View {
        content.scaleEffect(scale).onChange(of: value) { old, new in
            guard new > old + 0.5 else { return }
            scale = 1.35; withAnimation(.spring(response: 0.3, dampingFraction: 0.35)) { scale = 1 }
        }
    }
}

struct LifeProp: View {
    var emoji: String; var size: CGFloat
    @State private var wiggle = 0.0
    var body: some View {
        Button { LifeSound.shared.play("pop", vary: 3); withAnimation(.spring(response: 0.2, dampingFraction: 0.25)) { wiggle = 14 }; DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { withAnimation(.spring(response: 0.35, dampingFraction: 0.35)) { wiggle = 0 } } } label: { Text(emoji).font(.system(size: size)).rotationEffect(.degrees(wiggle)).offset(y: -abs(wiggle) * 0.6) }
            .buttonStyle(.plain).sensoryFeedback(.impact(weight: .light), trigger: wiggle > 0).accessibilityLabel("Toy")
    }
}

/// Sun and drifting clouds by day, moon and twinkling stars at night.
struct LifeSky: View {
    var night: Bool
    var body: some View {
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            ZStack(alignment: .topLeading) {
                Rectangle().fill(Color(hex: night ? "#1F2A52" : "#8FD3FF"))
                if night {
                    Text("🌙").font(.system(size: 26)).position(x: 100, y: 24)
                    ForEach(0..<4, id: \.self) { i in Text("✦").font(.system(size: 10)).foregroundStyle(.white).opacity(0.3 + 0.7 * abs(sin(t * 1.7 + Double(i)))).position(x: [18, 60, 34, 90][i], y: [14, 34, 56, 18][i]) }
                } else {
                    Text("☀️").font(.system(size: 26)).position(x: 102, y: 22)
                    Text("☁️").font(.system(size: 24)).position(x: CGFloat((t * 14).truncatingRemainder(dividingBy: 190)) - 30, y: 38)
                    Text("☁️").font(.system(size: 18)).position(x: CGFloat((t * 10 + 90).truncatingRemainder(dividingBy: 190)) - 30, y: 58)
                }
                Rectangle().fill(.white).frame(width: 4).position(x: 60, y: 38)
                Rectangle().fill(.white).frame(height: 4).position(x: 60, y: 38)
            }
        }
        .frame(width: 120, height: 76).clipShape(RoundedRectangle(cornerRadius: 10)).overlay(RoundedRectangle(cornerRadius: 12).stroke(.white, lineWidth: 5))
    }
}

// MARK: - Screens
private let lifeInk = Color(hex: "#2B1E2F")
private let lifeScenes: [String: [String]] = ["newborn": ["#DCEEFF", "#A9CFFF"], "toddler": ["#FFF1C9", "#FFC98A"], "child": ["#D7F5E6", "#8FD9B6"], "teen": ["#E6DEFF", "#A99BFF"], "adult": ["#DDF3FA", "#86C9E3"], "partnered": ["#FFE2E8", "#FF9FB5"], "elder": ["#F3EBDD", "#D2BFA0"]]
private let lifeMoodLine = ["happy": "is happy and content", "hungry": "is hungry", "sleepy": "is getting sleepy", "dirty": "needs a bath", "bored": "wants to play", "lonely": "misses you", "sad": "feels neglected and has stopped growing"]

/// Entry point: start/naming flow until the baby is born, then the room.
struct LifeGameView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        Group { if let g = store.lifeGame, g.status == "alive" || g.status == "ended" { LifeRoomView() } else { LifeStartView() } }
            .onAppear { store.refreshLife() }
    }
}

struct LifeStartView: View {
    @EnvironmentObject var store: Store
    var partnerName: String { store.partner?.name ?? "your partner" }
    var body: some View {
        let g = store.lifeGame
        let fresh = g == nil || g?.status == "ended"
        Page {
            ZStack { LinearGradient(colors: [Color(hex: "#BFE0FF"), Color(hex: "#7FB8FF")], startPoint: .top, endPoint: .bottom); BabyView(look: Life.content.stages[0].look, mood: g?.status == "proposed" || g?.status == "naming" ? "happy" : "sleepy", size: 210).padding(.top, 16) }.clipShape(RoundedRectangle(cornerRadius: 28))
            if let g, g.status == "naming", let vote = g.votes.first(where: { !$0.decided }) { LifeVotePanel(game: g, vote: vote) }
            else {
                Text(fresh ? "Raise a little one together" : g?.proposedBy == store.db.currentUser ? "Waiting for \(partnerName)" : "\(partnerName) wants a baby with you 💞").font(.title.bold())
                Text(fresh ? "Feed, bathe, play and put them to bed. Vote together on their name, school, path, job and who they marry. They grow up as you care for them, and their whole life fits in one year." : g?.proposedBy == store.db.currentUser ? "You proposed having a baby. Once \(partnerName) says yes, you’ll both pick a name." : "Say yes and you’ll both pick a name in secret. Needs drop over real time, so check in every day.").foregroundStyle(.secondary)
                if store.partner == nil { InfoBanner(text: "Connect with your partner first. A baby needs two parents.") }
                if store.partner?.simulated == true && fresh { InfoBanner(text: "\(partnerName) is a simulated partner in this demo and will answer for themselves.", icon: "testtube.2") }
                if fresh { PrimaryButton(title: "Propose having a baby") { store.perform { try store.proposeBaby() } }.disabled(store.partner == nil) }
                if g?.status == "proposed" && g?.proposedBy != store.db.currentUser { PrimaryButton(title: "Yes, let’s do it") { store.perform { try store.respondToBaby(true) } }; Button("Not now") { store.perform { try store.respondToBaby(false) } }.frame(maxWidth: .infinity) }
            }
        }.navigationTitle("Our Little One").navigationBarTitleDisplayMode(.inline)
    }
}

struct LifeVotePanel: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    var game: LifeGame; var vote: LifeVote
    @State private var choice: String?
    var body: some View {
        let def = Life.choice(vote.choice); let me = store.db.currentUser ?? ""; let partner = store.partner
        VStack(alignment: .leading, spacing: 14) {
            Text(def.title).font(.title.bold())
            Text(Life.fill(game.name, def.prompt)).foregroundStyle(.secondary)
            if vote.decided { InfoBanner(text: "Decided: \(Life.label(vote.choice, vote.result))\(vote.coin ? " (by coin flip)" : " — you both agreed!")", icon: "checkmark.seal") }
            else {
                if let prev = vote.previousPicks, let partner { InfoBanner(text: "You didn’t agree: you picked \(Life.label(vote.choice, prev[me])), \(partner.name) picked \(Life.label(vote.choice, prev[partner.id])). Pick again\(vote.round >= Life.content.coinFlipRound ? ". If you still disagree, a coin flip decides." : ".")", icon: "exclamationmark.triangle") }
                if let mine = vote.picks[me] {
                    Card { Text("Your pick: \(Life.label(vote.choice, mine))").font(.headline); Text("Waiting for \(partner?.name ?? "your partner"). Their pick stays hidden until you’ve both chosen.").foregroundStyle(.secondary) }
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(vote.options, id: \.self) { id in
                            let opt = def.options.first { $0.id == id }!
                            Button { choice = id } label: { VStack(spacing: 4) { Text(opt.emoji).font(.system(size: 28)); Text(opt.label).font(.subheadline.weight(.semibold)).multilineTextAlignment(.center); if let skill = opt.skill { Text("Fits a \(skill) child").font(.caption).foregroundStyle(.secondary) } }.frame(maxWidth: .infinity, minHeight: 100).padding(10).background(choice == id ? p.soft : p.surface, in: RoundedRectangle(cornerRadius: 22)).overlay(RoundedRectangle(cornerRadius: 22).stroke(choice == id ? p.primary : p.color("border"), lineWidth: 2)) }.buttonStyle(.smooth).accessibilityAddTraits(choice == id ? .isSelected : [])
                        }
                    }
                    Text("\(partner.flatMap { vote.picks[$0.id] != nil ? "\($0.name) has picked. " : nil } ?? "")Your pick stays secret until you’ve both chosen.").font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                    PrimaryButton(title: "Lock in my pick") { if let choice { store.perform { try store.castLifeVote(vote.id, option: choice) } } }.disabled(choice == nil).opacity(choice == nil ? 0.5 : 1)
                }
            }
        }
    }
}

struct LifeVoteView: View {
    @EnvironmentObject var store: Store
    var voteID: String
    var body: some View { Page { if let g = store.lifeGame, let v = g.votes.first(where: { $0.id == voteID }) { LifeVotePanel(game: g, vote: v) } else { ContentUnavailableView("Choice not found", systemImage: "checkmark.circle", description: Text("This choice may already be settled.")) } }.navigationTitle("Decide together").navigationBarTitleDisplayMode(.inline) }
}

struct LifeRoomView: View {
    @EnvironmentObject var store: Store
    @State private var notice: String?
    @State private var tick = 0
    @State private var pose: String?
    @State private var busy = false
    @State private var lampOn = true
    @State private var particles: [LifeParticle] = []
    @State private var dragID: String?
    @State private var drag: CGSize = .zero
    @State private var roomWidth: CGFloat = 340
    @State private var lastBubble = Date.distantPast
    @State private var eager = false
    @State private var trauma = 0.0
    @State private var shakeAt = Date()
    @State private var flash = 0.0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("lifeSoundMuted") private var soundMuted = false
    /// One call per event; the tier keeps feedback proportional.
    func feel(_ tier: LifeFeel) {
        guard !reduceMotion else { return }
        let now = Date(); let left = max(0, trauma - 1.3 * now.timeIntervalSince(shakeAt))
        trauma = min(1, left + tier.trauma); shakeAt = now
        if tier == .large { flash = 0.7; withAnimation(.easeOut(duration: 0.26)) { flash = 0 } }
    }
    static let roomH: CGFloat = 400, babyBottom: CGFloat = 34
    var night: Bool { let h = Calendar.current.component(.hour, from: Date()); return h < 7 || h >= 20 }
    func food(_ stage: String) -> String { ["newborn": "🍼", "toddler": "🥣", "child": "🍎", "elder": "🍵"][stage] ?? "🍝" }
    /// Mouth and body positions in the room, from the same proportions BabyView uses.
    func anchors(_ look: LifeLook) -> (s: CGFloat, head: CGFloat, mouth: CGFloat, body: CGFloat) {
        let s = 240 * look.scale, head = s * 0.62
        let bodyTop = Self.roomH - Self.babyBottom - s * 0.04 - s * 0.42
        return (s, head, bodyTop + head * 0.08 - head * 0.94 + head * 0.74, bodyTop + s * 0.15)
    }
    func overBaby(_ pt: CGPoint, _ look: LifeLook) -> Bool { let a = anchors(look); return abs(pt.x - roomWidth / 2) < a.s * 0.45 && pt.y > a.mouth - a.head * 0.8 && pt.y < Self.roomH - Self.babyBottom + 10 }

    @ViewBuilder func scene(_ g: LifeGame, _ stage: LifeStageDef, _ mood: String) -> some View {
        let theme = lifeRooms[g.stage] ?? lifeRooms["newborn"]!
        let dark = pose == "sleep" || !lampOn
        let a = anchors(stage.look)
        ZStack(alignment: .topLeading) {
            Rectangle().fill(Color(hex: theme.wall))
            LifeSky(night: night).position(x: 80, y: 60)
            Text(theme.art).font(.system(size: 34)).position(x: roomWidth * 0.66, y: 44)
            Button { lampOn.toggle(); LifeSound.shared.play("click", bus: .ui, db: 4) } label: { VStack(spacing: 0) { Rectangle().fill(lifeInk.opacity(0.35)).frame(width: 2, height: 30); UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22).fill(Color(hex: lampOn ? "#FFD66B" : "#B9B2C4")).frame(width: 44, height: 24) } }
                .buttonStyle(.plain).position(x: roomWidth - 48, y: 27).accessibilityLabel("Light").accessibilityValue(lampOn ? "On" : "Off").sensoryFeedback(.selection, trigger: lampOn)
            Rectangle().fill(Color(hex: theme.floor)).frame(height: Self.roomH * 0.32).frame(maxHeight: .infinity, alignment: .bottom)
            Capsule().fill(Color(hex: theme.rug).opacity(0.55)).frame(width: roomWidth * 0.64, height: 36).position(x: roomWidth / 2, y: Self.roomH - 32)
            ForEach(Array(theme.props.enumerated()), id: \.offset) { _, prop in LifeProp(emoji: prop.0, size: prop.3).position(x: roomWidth * prop.1 + prop.3 / 2, y: Self.roomH - prop.2 - prop.3 / 2) }
            if pose == "bathe" { Text("🛁").font(.system(size: a.s * 0.55)).position(x: roomWidth / 2, y: Self.roomH - a.s * 0.28) }
            BabyView(look: stage.look, mood: mood, name: g.name, pose: pose, eager: eager) {
                guard g.status == "alive" else { return }
                LifeSound.shared.play(mood == "happy" ? ["giggle1", "giggle2"] : ["pop"])
                particles += LifeParticle.burst(mood == "happy" ? ["😄", "✨"] : ["❔"], x: roomWidth / 2, y: a.mouth, count: mood == "happy" ? 4 : 1)
                notice = mood == "happy" ? "\(g.name ?? "") giggles! 😄" : "\(g.name ?? "") \(lifeMoodLine[mood] ?? "")."
            }
            .frame(width: roomWidth, height: Self.roomH - Self.babyBottom, alignment: .bottom)
            ForEach(particles) { LifeParticleView(p: $0) }
            Rectangle().fill(Color(hex: "#0E1030").opacity(dark ? 0.55 : 0)).allowsHitTesting(false).animation(.easeInOut(duration: 0.7), value: dark)
            Rectangle().fill(.white.opacity(flash)).allowsHitTesting(false)
        }
        .modifier(LifeShake(trauma: trauma, since: shakeAt))
        .frame(height: Self.roomH).frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 28))
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { roomWidth = $0 }
    }

    /// Plays the animation for a care action, then saves it.
    func perform(_ a: LifeActionDef, _ g: LifeGame) {
        guard !busy, g.status == "alive" else { return }
        busy = true
        let look = Life.stage(g.stage).look; let an = anchors(look); let x = roomWidth / 2
        let p: String? = ["feed", "bathe", "sleep"].contains(a.id) ? a.id : nil
        pose = p
        switch a.id {
        case "feed":
            for ms in [450, 800, 1150, 1500] { DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(ms)) { LifeSound.shared.play(["chew1", "chew2"]) } }
            particles.append(LifeParticle(emoji: food(g.stage), x: x, y: an.mouth, kind: .eaten, size: 40, dx: 120, rise: 120, duration: 1.9)); particles += LifeParticle.burst(["✨", "😋"], x: x, y: an.mouth, count: 3, delay: 1.5)
        case "bathe": LifeSound.shared.play("splash", vary: 0.5); particles += LifeParticle.burst(["🫧", "🫧", "🧼"], x: x, y: an.body, count: 14, rise: 160, duration: 1.8); particles.append(LifeParticle(emoji: "🚿", x: x + an.s * 0.32, y: an.mouth - an.head * 0.9, kind: .pop, size: 34, duration: 2.2))
        case "sleep": particles += LifeParticle.burst(["💤"], x: x + an.s * 0.25, y: an.mouth - an.head * 0.4, count: 3, rise: 110, delay: 0.5, duration: 2.2)
        case "play": LifeSound.shared.play("boing", vary: 0.5); particles.append(LifeParticle(emoji: "⚽", x: 30, y: Self.roomH - 40, kind: .bounce, size: 34, dx: roomWidth - 60)); particles += LifeParticle.burst(["✨", "😄"], x: x, y: an.mouth, count: 4, delay: 0.6)
        default:
            LifeSound.shared.play("sparkle", db: -2)
            let fx = ["cuddle": ["❤️", "💕", "💗"], "talk": ["💬", "🔤", "✨"], "homework": ["✏️", "⭐", "📝"], "hobby": ["🎵", "🎶", "✨"], "chat": ["💬", "😂", "💭"], "work": ["💼", "💰", "⭐"], "date": ["💕", "🌹", "✨"], "stories": ["📖", "✨", "🌟"]]
            particles += LifeParticle.burst(fx[a.id] ?? [a.emoji, "✨"], x: x, y: an.mouth, count: 8)
        }
        feel(.small); if !reduceMotion { trauma = 0.12; shakeAt = Date() }
        DispatchQueue.main.asyncAfter(deadline: .now() + (p == "sleep" ? 2.6 : 1.8)) {
            let before = store.lifeGame ?? g
            store.perform {
                try store.lifeAction(a.id)
                guard let after = store.lifeGame else { return }
                let gained = after.care - before.care
                if after.stage != before.stage { feel(.large); LifeSound.shared.duck(); LifeSound.shared.play("fanfare", vary: 0); particles += LifeParticle.burst(["🎉", "🎊", "⭐"], x: x, y: an.mouth, count: 18); particles.append(LifeParticle(emoji: "Grew up!", x: x, y: an.mouth - an.head, kind: .number, size: 30, rise: 90, duration: 1.6)) }
                else if gained > 0 { feel(.medium); LifeSound.shared.play("ding", db: -3, vary: 0.6); particles.append(LifeParticle(emoji: "+\(gained) ❤", x: x, y: an.mouth - an.head * 0.9, kind: .number, size: 26, rise: 70, duration: 1.2)) }
                notice = after.stage != before.stage ? "\(g.name ?? "") grew up! 🎉" : after.care == before.care ? "You \(a.verb) \(g.name ?? ""). They need more care before it counts." : "You \(a.verb) \(g.name ?? "") · +\(a.care) care"
            }
            pose = nil; busy = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { particles.removeAll { _ in true } }
        }
    }

    /// Care items: drag one onto the child (or tap it). Scrubbing with the soap leaves bubbles.
    @ViewBuilder func tray(_ g: LifeGame, _ stage: LifeStageDef) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 12) {
            ForEach(stage.actions, id: \.self) { id in
                if let a = Life.action(id) {
                    let emoji = id == "feed" ? food(g.stage) : id == "bathe" ? "🧼" : a.emoji
                    VStack(spacing: 4) {
                        Text(emoji).font(.system(size: 28)).frame(width: 62, height: 62).background(.white, in: Circle()).shadow(color: .black.opacity(0.12), radius: 6, y: 3)
                            .scaleEffect(dragID == id ? 1.25 : 1).offset(dragID == id ? drag : .zero).zIndex(dragID == id ? 10 : 0).opacity(busy ? 0.5 : 1)
                            .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("lifeRoom"))
                                .onChanged { v in
                                    guard !busy else { return }
                                    if dragID != id { LifeSound.shared.play("pickup", bus: .ui) }
                                    dragID = id; drag = v.translation
                                    let over = overBaby(v.location, stage.look); if over != eager { eager = over; if over { LifeSound.shared.play("hover", bus: .ui) } }
                                    if id == "bathe", overBaby(v.location, stage.look), Date().timeIntervalSince(lastBubble) > 0.07 { lastBubble = Date(); LifeSound.shared.play("bubble", db: -6, vary: 2); particles.append(LifeParticle(emoji: "🫧", x: v.location.x, y: v.location.y, size: .random(in: 16...28), dx: .random(in: -20...20), rise: .random(in: 60...120))) }
                                }
                                .onEnded { v in
                                    eager = false
                                    let tapped = abs(v.translation.width) + abs(v.translation.height) < 8
                                    if tapped || overBaby(v.location, stage.look) { if !tapped { LifeSound.shared.play("land", db: -2) }; dragID = nil; drag = .zero; perform(a, g) }
                                    else { withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) { drag = .zero }; DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { dragID = nil } }
                                })
                        Text(a.label).font(.caption.bold())
                    }
                    .zIndex(dragID == id ? 10 : 0)
                    .accessibilityElement(children: .ignore).accessibilityLabel("\(a.label). Drag onto your child or tap.").accessibilityAddTraits(.isButton).accessibilityAction { perform(a, g) }
                }
            }
        }
    }
    let timer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()
    var body: some View {
        if let g = store.lifeGame {
            let now = Life.now(g); let needs = Life.decayed(g, at: now); let mood = g.status == "ended" ? "happy" : Life.mood(needs); let stage = Life.stage(g.stage)
            let idx = Life.content.stages.firstIndex { $0.id == g.stage }!; let next = idx + 1 < Life.content.stages.count ? Life.content.stages[idx + 1] : nil
            let vote = g.votes.first { !$0.decided }; let me = store.db.currentUser ?? ""; let partnerName = store.partner?.name ?? "Partner"
            ScrollView {
                VStack(spacing: 14) {
                    VStack(spacing: 2) { Text(g.status == "ended" ? "Their story is complete" : "\(stage.label) · Day \(min(Int(Life.content.maxDays), Int(Life.ageDays(g, at: now)) + 1)) of \(Int(Life.content.maxDays))").font(.caption).opacity(0.7) }
                    if g.status == "alive" {
                        HStack { ForEach(Life.content.needs, id: \.id) { n in let v = needs[n.id] ?? 0; VStack(spacing: 6) { Text(n.emoji).font(.title3).frame(width: 44, height: 44).background(.white, in: Circle()).overlay(Circle().stroke(v < 35 ? Color.red : lifeInk.opacity(0.12), lineWidth: 2)).modifier(PopOnIncrease(value: v)); ProgressView(value: v, total: 100).tint(v < 35 ? .red : v < 60 ? .orange : .green).frame(width: 40) }.frame(maxWidth: .infinity).accessibilityElement(children: .ignore).accessibilityLabel("\(n.label) \(Int(v)) percent") } }.padding(12).background(.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 28))
                    }
                    if let vote { NavigationLink { LifeVoteView(voteID: vote.id) } label: { HStack(spacing: 12) { Text("🗳️").font(.title2); VStack(alignment: .leading) { Text(Life.choice(vote.choice).title).font(.body.weight(.semibold)); Text(vote.picks[me] == nil ? "Your vote is needed\(store.partner.flatMap { vote.picks[$0.id] != nil ? ". \($0.name) has picked." : nil } ?? ".")" : "Waiting for \(partnerName)…").font(.caption).opacity(0.75) }; Spacer(); Image(systemName: "chevron.right") }.foregroundStyle(vote.picks[me] == nil ? .white : lifeInk).padding(12).background(vote.picks[me] == nil ? lifeInk : .white.opacity(0.8), in: RoundedRectangle(cornerRadius: 22)) }.buttonStyle(.smooth) }
                    VStack(spacing: 14) {
                        scene(g, stage, mood)
                        if g.status == "alive" {
                            Text(busy ? "\(g.name ?? "") is busy…" : "Drag an item onto \(g.name ?? "your child"), or tap it. Scrub with the soap to make bubbles.").font(.caption).opacity(0.7).multilineTextAlignment(.center)
                            tray(g, stage)
                        }
                    }.coordinateSpace(.named("lifeRoom")).zIndex(5)
                    if g.status == "ended" {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("The life of \(g.name ?? "")").font(.title.bold()); Text(g.ending ?? "")
                            NavigationLink { LifeStoryView() } label: { Text("Read their story").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 14).background(.white, in: Capsule()) }.buttonStyle(.smooth)
                            PrimaryButton(title: g.keepsakeSaved ? "Saved to Memories ✓" : "Save the story to Memories") { store.perform { try store.saveLifeKeepsake() } }.disabled(g.keepsakeSaved)
                            NavigationLink("Start a new life") { LifeStartView() }.frame(maxWidth: .infinity)
                        }.foregroundStyle(lifeInk).padding(24).background(.white.opacity(0.85), in: RoundedRectangle(cornerRadius: 28))
                    } else {
                        VStack(spacing: 6) {
                            Text("\(g.name ?? "") \(lifeMoodLine[mood] ?? "")").font(.body.weight(.semibold))
                            if let next { ProgressView(value: Life.progress(g, at: now)).tint(lifeInk); Text(Life.pendingChoice(g).map { "Decide \"\(Life.choice($0).title.lowercased())\" together so \(g.name ?? "") can grow up" } ?? "Growing into: \(next.label) · \(g.care)/\(stage.careToGrow) care").font(.caption).opacity(0.7) }
                            else { Text("Golden years · \(g.care)/\(stage.careToGrow) care").font(.caption).opacity(0.7) }
                            if let p = store.partner, let last = g.log.first(where: { $0.userID == p.id }) { Text("\(p.name)\(p.simulated ? " (simulated)" : "") \(Life.action(last.action)?.verb ?? "") \(g.name ?? "") \(last.at.formatted(.relative(presentation: .named, unitsStyle: .wide)))").font(.caption).opacity(0.7) }
                        }.multilineTextAlignment(.center).padding(12).frame(maxWidth: .infinity).background(.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 28))
                        if store.db.demo { HStack { Text("🧪 Demo: skip time as if you both cared well").font(.caption).opacity(0.7); Spacer(); Button("+1 day") { let was = store.lifeGame?.stage; store.perform { try store.fastForwardLife(days: 1); if store.lifeGame?.stage != was { feel(.large); LifeSound.shared.duck(); LifeSound.shared.play("fanfare", vary: 0); particles += LifeParticle.burst(["🎉", "🎊", "⭐"], x: roomWidth / 2, y: 200, count: 18) } } }.buttonStyle(.bordered); Button("+1 week") { let was = store.lifeGame?.stage; store.perform { try store.fastForwardLife(days: 7); if store.lifeGame?.stage != was { feel(.large); LifeSound.shared.duck(); LifeSound.shared.play("fanfare", vary: 0); particles += LifeParticle.burst(["🎉", "🎊", "⭐"], x: roomWidth / 2, y: 200, count: 18) } } }.buttonStyle(.bordered) }.padding(8).background(.white.opacity(0.5), in: RoundedRectangle(cornerRadius: 22)) }
                        Text("Needs drop in real time. Care only counts while \(g.name ?? "your little one") is doing okay overall.").font(.caption).opacity(0.6).multilineTextAlignment(.center)
                    }
                }.foregroundStyle(lifeInk).padding(20).frame(maxWidth: 680).frame(maxWidth: .infinity).id(tick)
            }
            .background(LinearGradient(colors: (lifeScenes[g.stage] ?? ["#DCEEFF", "#A9CFFF"]).map { Color(hex: $0) }, startPoint: .top, endPoint: .bottom).ignoresSafeArea())
            // Adaptive music: day theme while awake, lullaby crossfade when the lights go off.
            .onAppear { LifeSound.shared.muted = soundMuted; LifeSound.shared.setMusic(g.status == "alive" ? ((pose == "sleep" || !lampOn) ? "night" : "day") : nil) }
            .onChange(of: pose == "sleep" || !lampOn) { _, dark in if g.status == "alive" { LifeSound.shared.setMusic(dark ? "night" : "day") } }
            .onChange(of: g.status) { _, st in if st != "alive" { LifeSound.shared.setMusic(nil) } }
            .onDisappear { LifeSound.shared.setMusic(nil, fade: 0.4) }
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { soundMuted.toggle(); LifeSound.shared.muted = soundMuted; if !soundMuted { LifeSound.shared.play("click", bus: .ui) } } label: { Image(systemName: soundMuted ? "speaker.slash" : "speaker.wave.2") }.accessibilityLabel("Sound").accessibilityValue(soundMuted ? "Off" : "On") } }
            .toolbar { ToolbarItem(placement: .topBarTrailing) { NavigationLink { LifeStoryView() } label: { Image(systemName: "book") }.accessibilityLabel("Their story") } }
            .navigationTitle(g.name ?? "").navigationBarTitleDisplayMode(.inline)
            .overlay(alignment: .top) { if let notice { Text(notice).font(.subheadline.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 10).background(.white, in: Capsule()).shadow(radius: 4).padding(.top, 8).transition(.move(edge: .top).combined(with: .opacity)).task { try? await Task.sleep(for: .seconds(2.5)); withAnimation { self.notice = nil } } } }
            .animation(.spring, value: notice)
            .scrollDisabled(dragID != nil)
            .onReceive(timer) { _ in store.refreshLife(); tick += 1 }
        }
    }
}

struct LifeStoryView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        Page {
            if let g = store.lifeGame {
                if let ending = g.ending { Card { Text(ending).font(.headline) } }
                SectionHeading(title: "Who they became")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())]) { ForEach(Life.content.skills, id: \.id) { s in Card { Text(s.emoji).font(.title2); Text(s.label).font(.headline); Text("\(g.skills[s.id] ?? 0) pts").font(.caption).foregroundStyle(.secondary) } } }
                SectionHeading(title: "Milestones")
                ForEach(g.milestones) { m in HStack(alignment: .top, spacing: 12) { Circle().fill(.tint).frame(width: 12, height: 12).padding(.top, 5); VStack(alignment: .leading) { Text(m.text).font(.body.weight(.semibold)); Text(m.at.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(.secondary) } } }
                SectionHeading(title: "Care together")
                let counts = Dictionary(grouping: g.log, by: \.userID).mapValues(\.count)
                Text(counts.isEmpty ? "No care yet." : counts.map { "\(who($0.key)): \($0.value)" }.sorted().joined(separator: " · ")).foregroundStyle(.secondary)
                ForEach(g.log.prefix(20)) { e in Text("\(Life.action(e.action)?.emoji ?? "") \(who(e.userID)) \(Life.action(e.action)?.verb ?? "") \(g.name ?? "") · \(e.at.formatted(.relative(presentation: .named)))").font(.caption).foregroundStyle(.secondary) }
            } else { ContentUnavailableView("No story yet", systemImage: "book", description: Text("Have a little one together to start writing it.")) }
        }.navigationTitle(store.lifeGame?.name.map { "\($0)'s story" } ?? "Their story").navigationBarTitleDisplayMode(.inline)
    }
    func who(_ id: String) -> String { id == store.db.currentUser ? "You" : store.partner.map { $0.name + ($0.simulated ? " (simulated)" : "") } ?? "Partner" }
}
