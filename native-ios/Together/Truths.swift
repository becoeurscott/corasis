import SwiftUI

// Five Truths: five deep questions. Each partner answers in secret and guesses the other's
// answer, then both reveal together. Once a month. Mirrors src/app/games/truths.tsx.

extension Store {
    func truthsEntries(round: String) -> [TruthsEntry] {
        guard let c = couple else { return [] }
        return (db.truths ?? []).filter { $0.coupleID == c.id && $0.round == round }
    }
    func submitTruths(answers: [Int], guesses: [Int]) throws {
        let c = try requireCouple(); guard let me = db.currentUser else { return }
        let n = Product.shared.truths.items.count
        guard answers.count == n, guesses.count == n, (answers + guesses).allSatisfy({ (0...2).contains($0) }) else { throw AppError(message: "Answer every question first.") }
        let entry = TruthsEntry(coupleID: c.id, round: checkupRound, user: me, answers: answers, guesses: guesses)
        var all = db.truths ?? []; all.removeAll { $0.id == entry.id }; all.append(entry); db.truths = all
        if let partner, partner.simulated, !all.contains(where: { $0.coupleID == c.id && $0.round == entry.round && $0.user == partner.id }) {
            let round = entry.round
            later { store in
                // Demo partner: answers mostly like your guesses, guesses mostly like your answers.
                func near(_ v: Int) -> Int { Int.random(in: 0..<3) == 0 ? Int.random(in: 0...2) : v }
                var list = store.db.truths ?? []
                list.append(TruthsEntry(coupleID: c.id, round: round, user: partner.id, answers: guesses.map(near), guesses: answers.map(near)))
                store.db.truths = list
            }
        }
    }
}

struct TruthsGameView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    private let content = Product.shared.truths
    @State private var answers: [Int] = []
    @State private var guesses: [Int] = []
    @State private var index = 0
    @State private var guessing = false
    @State private var playing = false
    @State private var forward = true
    @State private var pop = false
    @State private var optionsIn = false
    @State private var advancing = false
    @State private var error: String?

    var me: String { store.db.currentUser ?? "" }
    var partnerName: String { store.partner?.name ?? tr("your partner") }
    var round: String { store.checkupRound }
    var mine: TruthsEntry? { store.truthsEntries(round: round).first { $0.user == me } }
    var theirs: TruthsEntry? { store.truthsEntries(round: round).first { $0.user != me } }

    var body: some View {
        Group {
            if let mine, let theirs { TruthsReveal(mine: mine, theirs: theirs, partnerName: partnerName) }
            else if mine != nil { waiting }
            else if playing { question }
            else { intro }
        }
        .navigationTitle("Five Truths").navigationBarTitleDisplayMode(.inline)
        .alert("Five Truths", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") {} } message: { Text(error ?? "") }
    }

    var intro: some View {
        Page {
            ZStack {
                LinearGradient(colors: [Color(hex: "#B9A4FF"), Color(hex: "#7C5CFF")], startPoint: .topLeading, endPoint: .bottomTrailing)
                VStack(spacing: 10) {
                    Text("🗝️").font(.system(size: 64)).scaleEffect(pop ? 1 : 0.5).rotationEffect(.degrees(pop ? 0 : -25))
                    Text("Five Truths").font(.title.bold())
                    Text("5 questions for life").font(.subheadline).opacity(0.85)
                }.foregroundStyle(.white).padding(28)
            }.clipShape(RoundedRectangle(cornerRadius: 28))
            .onAppear { withAnimation(.spring(response: 0.6, dampingFraction: 0.5).delay(0.15)) { pop = true } }
            Card { Text(content.intro).font(.body) }
            PrimaryButton(title: tr("Start")) {
                answers = Array(repeating: -1, count: content.items.count); guesses = answers; index = 0; guessing = false; forward = true
                withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { playing = true }
            }
        }
    }

    var question: some View {
        let item = content.items[index]
        let step = index * 2 + (guessing ? 1 : 0)
        let picked = guessing ? guesses[index] : answers[index]
        return VStack(spacing: 16) {
            ProgressView(value: Double(step + 1), total: Double(content.items.count * 2)).tint(p.primary)
            Text("Question \(index + 1) of \(content.items.count)").font(.caption.bold()).foregroundStyle(p.secondary)
            ZStack {
                VStack(spacing: 14) {
                    Text(item.emoji).font(.system(size: 60)).scaleEffect(pop ? 1 : 0.4).rotationEffect(.degrees(pop ? 0 : -18))
                    Text(item.text).font(.title3.bold()).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 8) {
                        if guessing, let partner = store.partner { Avatar(person: partner, size: 24) }
                        Text(guessing ? "What will \(partnerName) answer?" : "Your honest answer").font(.subheadline.bold()).foregroundStyle(guessing ? p.primary : p.secondary)
                    }
                }
                .padding(22).frame(maxWidth: .infinity)
                .background(guessing ? p.soft : p.surface, in: RoundedRectangle(cornerRadius: 26))
                .shadow(color: p.primary.opacity(0.12), radius: 16, y: 8)
                .id(step)
                .transition(.asymmetric(insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity), removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)))
            }
            .frame(maxHeight: .infinity)
            .onAppear { animateIn() }
            .onChange(of: step) { _, _ in animateIn() }
            VStack(spacing: 10) {
                ForEach(Array(item.options.enumerated()), id: \.offset) { i, option in
                    Button { choose(i) } label: {
                        HStack { Text(option).font(.headline).multilineTextAlignment(.leading); Spacer(); if picked == i { Image(systemName: "checkmark.circle.fill").foregroundStyle(p.primary) } }
                            .padding(.horizontal, 18).padding(.vertical, 15)
                            .background(picked == i ? p.soft : p.surface, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(picked == i ? p.primary : p.color("border"), lineWidth: picked == i ? 2 : 1))
                    }
                    .buttonStyle(.smooth)
                    .scaleEffect(picked == i ? 1.04 : 1).animation(.spring(response: 0.3, dampingFraction: 0.55), value: picked)
                    .opacity(optionsIn ? 1 : 0).offset(y: optionsIn ? 0 : 24)
                    .animation(.spring(response: 0.45, dampingFraction: 0.8).delay(Double(i) * 0.06), value: optionsIn)
                }
            }
            Button("Back") { back() }.foregroundStyle(p.secondary)
        }
        .padding(20).frame(maxWidth: 680).frame(maxWidth: .infinity).background(p.background).foregroundStyle(p.text)
    }

    func animateIn() {
        pop = false; optionsIn = false
        withAnimation(.spring(response: 0.5, dampingFraction: 0.5).delay(0.1)) { pop = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { optionsIn = true }
    }
    func choose(_ i: Int) {
        guard !advancing else { return }
        advancing = true
        if guessing { guesses[index] = i } else { answers[index] = i }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            forward = true
            if !guessing { withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { guessing = true } }
            else if index + 1 < content.items.count { withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { guessing = false; index += 1 } }
            else { submit() }
            advancing = false
        }
    }
    func back() {
        forward = false
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
            if guessing { guessing = false } else if index > 0 { index -= 1; guessing = true } else { playing = false }
        }
    }
    func submit() {
        if let gap = answers.firstIndex(of: -1) ?? guesses.firstIndex(of: -1) { withAnimation { index = gap; guessing = answers[gap] != -1 }; return }
        do { try store.submitTruths(answers: answers, guesses: guesses); UINotificationFeedbackGenerator().notificationOccurred(.success) }
        catch { self.error = (error as? AppError)?.message ?? error.localizedDescription }
    }

    var waiting: some View {
        Page {
            Text("🔐").font(.system(size: 64)).frame(maxWidth: .infinity).scaleEffect(pop ? 1 : 0.85)
                .onAppear { withAnimation(.easeInOut(duration: 1.2).repeatForever()) { pop = true } }
            Text("Your truths are locked in").font(.title.bold()).frame(maxWidth: .infinity)
            Text("Waiting for \(partnerName). The reveal opens as soon as you've both answered.").multilineTextAlignment(.center).foregroundStyle(p.secondary).frame(maxWidth: .infinity)
            HStack(spacing: -12) { Avatar(person: store.me, size: 56); if let partner = store.partner { Avatar(person: partner, size: 56).opacity(0.45) } }.frame(maxWidth: .infinity)
        }
    }
}

struct TruthsReveal: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    let mine: TruthsEntry; let theirs: TruthsEntry; let partnerName: String
    private let content = Product.shared.truths
    @State private var shown = 0

    var same: Int { zip(mine.answers, theirs.answers).filter { $0 == $1 }.count }
    var myRight: Int { zip(mine.guesses, theirs.answers).filter { $0 == $1 }.count }
    var theirRight: Int { zip(theirs.guesses, mine.answers).filter { $0 == $1 }.count }

    var body: some View {
        Page {
            ZStack {
                LinearGradient(colors: [Color(hex: "#B9A4FF"), Color(hex: "#7C5CFF")], startPoint: .topLeading, endPoint: .bottomTrailing)
                VStack(spacing: 10) {
                    HStack(spacing: -10) { Avatar(person: store.me, size: 52).overlay(Circle().stroke(.white, lineWidth: 2)); if let partner = store.partner { Avatar(person: partner, size: 52).overlay(Circle().stroke(.white, lineWidth: 2)) } }
                    Text(verbatim: "\(same)/\(content.items.count)").font(.system(size: 56, weight: .heavy, design: .rounded)).contentTransition(.numericText())
                    Text(same >= 4 ? "Same page" : same >= 2 ? "Worth a talk" : "Time for a real conversation").font(.title3.bold())
                    Text("answers you share").font(.subheadline).opacity(0.85)
                }.foregroundStyle(.white).padding(24).frame(maxWidth: .infinity)
            }.clipShape(RoundedRectangle(cornerRadius: 28))
            HStack(spacing: 12) {
                stat(verbatim: "\(myRight)/5", "you read \(partnerName)")
                stat(verbatim: "\(theirRight)/5", "\(partnerName) read you")
            }
            ForEach(Array(content.items.enumerated()), id: \.offset) { i, item in
                if i < shown { row(i, item).transition(.move(edge: .bottom).combined(with: .opacity)) }
            }
            InfoBanner(text: content.talk, icon: "bubble.left.and.bubble.right")
        }
        .onAppear {
            for i in 0..<content.items.count {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3 + Double(i) * 0.35) { withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { shown = i + 1 } }
            }
        }
    }

    func stat(verbatim value: String, _ label: LocalizedStringKey) -> some View {
        VStack(spacing: 4) { Text(verbatim: value).font(.title3.bold()).foregroundStyle(p.primary); Text(label).font(.caption).foregroundStyle(p.secondary).lineLimit(1).minimumScaleFactor(0.7) }
            .frame(maxWidth: .infinity).padding(.vertical, 14).background(p.surface, in: RoundedRectangle(cornerRadius: 18))
    }

    func row(_ i: Int, _ item: TruthItem) -> some View {
        let a = mine.answers[i], b = theirs.answers[i]
        return Card {
            HStack(alignment: .top, spacing: 10) {
                Text(item.emoji).font(.title2)
                Text(item.text).font(.subheadline.bold()).fixedSize(horizontal: false, vertical: true)
            }
            answerLine(store.me, "You", item.options[a], guessedRight: theirs.guesses[i] == a)
            answerLine(store.partner, partnerName, item.options[b], guessedRight: mine.guesses[i] == b)
            if a != b { Label("Talk about this one", systemImage: "bubble.left.and.bubble.right.fill").font(.caption.bold()).foregroundStyle(p.primary) }
        }
    }

    func answerLine(_ person: Person?, _ name: String, _ answer: String, guessedRight: Bool) -> some View {
        HStack(spacing: 10) {
            if let person { Avatar(person: person, size: 28) }
            VStack(alignment: .leading, spacing: 2) { Text(name).font(.caption).foregroundStyle(p.secondary); Text(answer).font(.subheadline.weight(.semibold)) }
            Spacer()
            if guessedRight { Text("🎯").font(.caption).accessibilityLabel("Guessed right") }
        }
    }
}
