import SwiftUI

// Marriage Check-up: once a month each spouse rates 25 parts of the marriage in secret,
// guesses the other's score, then both reveal together. Mirrors src/app/games/checkup.tsx.

extension Store {
    var checkupRound: String { String(today.prefix(7)) }
    var isMarried: Bool { couple?.stage == "married" }
    func checkupEntries(round: String? = nil) -> [CheckupEntry] {
        guard let c = couple else { return [] }
        return (db.checkups ?? []).filter { $0.coupleID == c.id && (round == nil || $0.round == round) }
    }
    func submitCheckup(ratings: [Int], guess: Int) throws {
        let c = try requireCouple(); guard let me = db.currentUser else { return }
        guard ratings.count == Product.shared.checkup.items.count, ratings.allSatisfy({ (1...5).contains($0) }) else { throw AppError(message: "Rate every item first.") }
        let entry = CheckupEntry(coupleID: c.id, round: checkupRound, user: me, ratings: ratings, guess: max(0, min(100, guess)))
        var all = db.checkups ?? []; all.removeAll { $0.id == entry.id }; all.append(entry); db.checkups = all
        if let partner, partner.simulated, !all.contains(where: { $0.coupleID == c.id && $0.round == entry.round && $0.user == partner.id }) {
            let round = entry.round
            later { store in
                // Demo spouse answers close to yours so the reveal has something to show.
                let theirs = ratings.map { max(1, min(5, $0 + [-1, 0, 0, 1].randomElement()!)) }
                var list = store.db.checkups ?? []
                list.append(CheckupEntry(coupleID: c.id, round: round, user: partner.id, ratings: theirs, guess: max(0, min(100, entry.score + Int.random(in: -12...12)))))
                store.db.checkups = list
            }
        }
    }
}

struct CheckupGameView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    private let content = Product.shared.checkup
    @State private var ratings: [Int] = []
    @State private var forward = true
    @State private var emojiPop = false
    @State private var buttonsIn = false
    @State private var index = 0
    @State private var guess = 60.0
    @State private var phase = Phase.intro
    @State private var error: String?
    @State private var advancing = false
    enum Phase { case intro, rating, guessing }

    var me: String { store.db.currentUser ?? "" }
    var partnerName: String { store.partner?.name ?? tr("your spouse") }
    var round: [CheckupEntry] { store.checkupEntries(round: store.checkupRound) }
    var mine: CheckupEntry? { round.first { $0.user == me } }
    var theirs: CheckupEntry? { round.first { $0.user != me } }

    var body: some View {
        Group {
            if !store.isMarried { locked }
            else if let mine, let theirs { CheckupReveal(mine: mine, theirs: theirs, partnerName: partnerName) }
            else if mine != nil { waiting }
            else {
                switch phase {
                case .intro: intro
                case .rating: rating
                case .guessing: guessing
                }
            }
        }
        .navigationTitle("Marriage Check-up").navigationBarTitleDisplayMode(.inline)
        .alert(error ?? "", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } }
    }

    var locked: some View {
        Page {
            Text("💍").font(.system(size: 72)).frame(maxWidth: .infinity)
            Text("For married couples").font(.title.bold())
            Text("The Marriage Check-up is made for spouses. If you're married, set your relationship stage to Married in Settings → Couple, and it opens for both of you.").foregroundStyle(p.secondary)
        }
    }

    var intro: some View {
        Page {
            ZStack {
                LinearGradient(colors: [Color(hex: "#F7A8C4"), Color(hex: "#C2477A")], startPoint: .topLeading, endPoint: .bottomTrailing)
                VStack(spacing: 8) { Text("💍").font(.system(size: 64)); Text("This month's check-up").font(.title2.bold()); Text(monthTitle).font(.subheadline).opacity(0.85) }.foregroundStyle(.white).padding(28)
            }.clipShape(RoundedRectangle(cornerRadius: 28))
            Card {
                rule("1", "Rate 25 parts of your marriage, from 1 to 5. \(partnerName) can't see your answers.")
                rule("2", "Guess the score \(partnerName) will give.")
                rule("3", "When you've both finished, reveal together: your scores, where you agree, and what to talk about.")
            }
            InfoBanner(text: content.disclaimer, icon: "heart.text.square")
            PrimaryButton(title: tr("Start")) { ratings = Array(repeating: 0, count: content.items.count); index = 0; withAnimation { phase = .rating } }
            history
        }
    }
    func rule(_ n: String, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: 12) { Text(n).font(.headline).frame(width: 30, height: 30).background(p.soft, in: Circle()).foregroundStyle(p.primary); Text(text).font(.subheadline) }
    }
    var monthTitle: String {
        let f = DateFormatter(); f.dateFormat = "LLLL yyyy"
        return f.string(from: Day.date(store.today, zone: "UTC"))
    }

    var rating: some View {
        let item = content.items[index]
        return VStack(spacing: 16) {
            ProgressView(value: Double(index + 1), total: Double(content.items.count)).tint(p.primary)
            Text("\(index + 1) of \(content.items.count)").font(.caption.bold()).foregroundStyle(p.secondary)
            ZStack {
                VStack(spacing: 14) {
                    Text(item.emoji).font(.system(size: 64)).scaleEffect(emojiPop ? 1 : 0.4).rotationEffect(.degrees(emojiPop ? 0 : -18))
                    Text(item.text).font(.title3.bold()).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true).minimumScaleFactor(0.8)
                    Text("How happy are you with this?").font(.subheadline).foregroundStyle(p.secondary)
                }
                .padding(22).frame(maxWidth: .infinity)
                .background(p.surface, in: RoundedRectangle(cornerRadius: 26))
                .shadow(color: p.primary.opacity(0.12), radius: 16, y: 8)
                .id(index)
                .transition(.asymmetric(insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity), removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)))
            }
            .frame(maxHeight: .infinity)
            .onAppear { popEmoji() }
            .onChange(of: index) { _, _ in popEmoji() }
            VStack(spacing: 10) {
                ForEach((1...5).reversed(), id: \.self) { value in
                    Button { pick(value) } label: {
                        HStack { Text(String(repeating: "♥", count: value)).foregroundStyle(p.primary).frame(width: 90, alignment: .leading); Text(content.scale[value - 1]).font(.headline); Spacer() }
                            .padding(.horizontal, 18).padding(.vertical, 11)
                            .background(ratings[index] == value ? p.soft : p.surface, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(ratings[index] == value ? p.primary : p.color("border"), lineWidth: ratings[index] == value ? 2 : 1))
                    }.buttonStyle(.smooth)
                    .scaleEffect(ratings[index] == value ? 1.04 : 1).animation(.spring(response: 0.3, dampingFraction: 0.55), value: ratings[index])
                    .opacity(buttonsIn ? 1 : 0).offset(y: buttonsIn ? 0 : 24)
                    .animation(.spring(response: 0.45, dampingFraction: 0.8).delay(Double(5 - value) * 0.05), value: buttonsIn)
                    .accessibilityLabel("\(value) of 5, \(content.scale[value - 1])")
                }
            }
            Button("Back") { forward = false; withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { if index == 0 { phase = .intro } else { index -= 1 } } }.foregroundStyle(p.secondary)
        }
        .padding(20).frame(maxWidth: 680).frame(maxWidth: .infinity).background(p.background).foregroundStyle(p.text)
    }
    func popEmoji() {
        emojiPop = false; buttonsIn = false
        withAnimation(.spring(response: 0.5, dampingFraction: 0.5).delay(0.1)) { emojiPop = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { buttonsIn = true }
    }
    func pick(_ value: Int) {
        guard !advancing else { return }
        advancing = true
        ratings[index] = value
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
            forward = true
            withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { if index + 1 < content.items.count { index += 1 } else { phase = .guessing } }
            advancing = false
        }
    }

    var guessing: some View {
        Page {
            Text("🔮").font(.system(size: 64)).frame(maxWidth: .infinity)
            Text("Guess \(partnerName)'s score").font(.title.bold()).frame(maxWidth: .infinity)
            Text("How happy do you think \(partnerName) is with your marriage this month, out of 100?").multilineTextAlignment(.center).foregroundStyle(p.secondary).frame(maxWidth: .infinity)
            Text(verbatim: "\(Int(guess))%").font(.system(size: 64, weight: .heavy, design: .rounded)).foregroundStyle(p.primary).frame(maxWidth: .infinity).contentTransition(.numericText())
            Slider(value: $guess, in: 0...100, step: 1).tint(p.primary)
            PrimaryButton(title: tr("Lock in my answers")) {
                if let gap = ratings.firstIndex(of: 0) { withAnimation { index = gap; phase = .rating }; return }
                do { try store.submitCheckup(ratings: ratings, guess: Int(guess)); UINotificationFeedbackGenerator().notificationOccurred(.success) } catch { self.error = (error as? AppError)?.message ?? error.localizedDescription }
            }
            Button("Back to the questions") { withAnimation { index = content.items.count - 1; phase = .rating } }.frame(maxWidth: .infinity).foregroundStyle(p.secondary)
        }
    }

    var waiting: some View {
        Page {
            Text("⏳").font(.system(size: 64)).frame(maxWidth: .infinity)
            Text("Your answers are locked in").font(.title.bold()).frame(maxWidth: .infinity)
            Text("Waiting for \(partnerName) to finish. The reveal opens as soon as you've both answered.").multilineTextAlignment(.center).foregroundStyle(p.secondary).frame(maxWidth: .infinity)
            HStack(spacing: -12) { Avatar(person: store.me, size: 56); if let partner = store.partner { Avatar(person: partner, size: 56).opacity(0.45) } }.frame(maxWidth: .infinity)
            history
        }
    }

    @ViewBuilder var history: some View {
        let past = Dictionary(grouping: store.checkupEntries().filter { $0.round != store.checkupRound }, by: \.round).filter { $0.value.count == 2 }.sorted { $0.key > $1.key }
        if !past.isEmpty {
            SectionHeading(title: tr("Past months"))
            Card {
                ForEach(past, id: \.key) { round, entries in
                    let avg = entries.map(\.score).reduce(0, +) / 2
                    HStack { Text(round).font(.subheadline.monospacedDigit()); Spacer(); Text(content.band(avg).title).font(.caption).foregroundStyle(p.secondary); Text(verbatim: "\(avg)%").font(.headline).foregroundStyle(p.primary) }
                }
            }
        }
    }
}

struct CheckupReveal: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    let mine: CheckupEntry; let theirs: CheckupEntry; let partnerName: String
    private let content = Product.shared.checkup
    @State private var shown = false
    @State private var showAll = false

    var average: Int { (mine.score + theirs.score) / 2 }
    var inTune: Int { zip(mine.ratings, theirs.ratings).filter { abs($0 - $1) <= 1 }.count }
    var rows: [(item: CheckupItem, me: Int, them: Int)] { content.items.enumerated().map { (i, item) in (item, mine.ratings[i], theirs.ratings[i]) } }
    var strengths: [(item: CheckupItem, me: Int, them: Int)] { Array(rows.filter { $0.me >= 4 && $0.them >= 4 }.sorted { $0.me + $0.them > $1.me + $1.them }.prefix(3)) }
    var talkAbout: [(item: CheckupItem, me: Int, them: Int)] { Array(rows.filter { abs($0.me - $0.them) >= 2 || $0.me + $0.them <= 5 }.sorted { (abs($0.me - $0.them), -($0.me + $0.them)) > (abs($1.me - $1.them), -($1.me + $1.them)) }.prefix(3)) }
    func guessPoints(_ guess: Int, _ actual: Int) -> Int { max(0, 100 - abs(guess - actual) * 4) }

    var body: some View {
        Page {
            ZStack {
                LinearGradient(colors: [Color(hex: "#F7A8C4"), Color(hex: "#C2477A")], startPoint: .topLeading, endPoint: .bottomTrailing)
                VStack(spacing: 14) {
                    HStack(spacing: 28) { scoreBubble(store.me, mine.score, "You"); scoreBubble(store.partner, theirs.score, "\(partnerName)") }
                    Text(verbatim: "\(shown ? average : 0)%").font(.system(size: 64, weight: .heavy, design: .rounded)).fixedSize().scaleEffect(shown ? 1 : 0.6).contentTransition(.numericText())
                    Text(content.band(average).title).font(.title3.bold())
                    Text(content.band(average).text).font(.subheadline).multilineTextAlignment(.center).opacity(0.9)
                }.foregroundStyle(.white).padding(24)
            }.clipShape(RoundedRectangle(cornerRadius: 28))
            HStack(spacing: 12) {
                stat("\(inTune)/25", "in tune")
                stat("\(guessPoints(mine.guess, theirs.score))", "your guess pts")
                stat("\(guessPoints(theirs.guess, mine.score))", "\(partnerName)'s pts")
            }
            Card {
                Text("🔮 Guesses").font(.headline)
                Text(verbatim: tr("You guessed \(mine.guess)%, \(partnerName) gave \(theirs.score)%.")).font(.subheadline)
                Text(verbatim: tr("\(partnerName) guessed \(theirs.guess)%, you gave \(mine.score)%.")).font(.subheadline)
            }
            if !strengths.isEmpty { list("💪 Going great", strengths) }
            if !talkAbout.isEmpty { list("💬 Worth talking about", talkAbout) }
            Button(showAll ? "Hide all answers" : "See all 25 answers") { withAnimation { showAll.toggle() } }.font(.headline).foregroundStyle(p.primary)
            if showAll { list("All answers", rows) }
            InfoBanner(text: content.disclaimer, icon: "heart.text.square")
        }
        .onAppear { withAnimation(.easeOut(duration: 1.2).delay(0.2)) { shown = true } }
    }
    func scoreBubble(_ person: Person?, _ score: Int, _ label: LocalizedStringKey) -> some View {
        VStack(spacing: 6) { if let person { Avatar(person: person, size: 52).overlay(Circle().stroke(.white, lineWidth: 2)) }; Text(verbatim: "\(shown ? score : 0)%").font(.headline).contentTransition(.numericText()); Text(label).font(.caption).opacity(0.85).lineLimit(1) }
    }
    func stat(_ value: String, _ label: LocalizedStringKey) -> some View {
        VStack(spacing: 4) { Text(value).font(.title3.bold()).foregroundStyle(p.primary); Text(label).font(.caption).foregroundStyle(p.secondary).lineLimit(1).minimumScaleFactor(0.8) }
            .frame(maxWidth: .infinity).padding(.vertical, 14).background(p.surface, in: RoundedRectangle(cornerRadius: 18))
    }
    func list(_ title: LocalizedStringKey, _ rows: [(item: CheckupItem, me: Int, them: Int)]) -> some View {
        Card {
            Text(title).font(.headline)
            ForEach(rows, id: \.item.id) { row in
                HStack(spacing: 10) {
                    Text(row.item.emoji)
                    Text(row.item.text).font(.subheadline).frame(maxWidth: .infinity, alignment: .leading)
                    VStack(alignment: .trailing, spacing: 2) { hearts(row.me, "You"); hearts(row.them, String(partnerName.prefix(8))) }
                }
            }
        }
    }
    func hearts(_ n: Int, _ who: String) -> some View {
        HStack(spacing: 4) { Text(who).font(.caption2).foregroundStyle(p.secondary); Text(String(repeating: "♥", count: n) + String(repeating: "♡", count: 5 - n)).font(.caption).foregroundStyle(p.primary) }
    }
}
