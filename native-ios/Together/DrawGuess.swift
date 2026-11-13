import SwiftUI

// Draw & Guess: one partner draws a secret word with their finger, the other guesses
// (3 tries) whenever they're free, then you swap. One running log per couple:
// {type: draw, word, strokes} then {type: guess, text, ok} entries.

let drawWords = ["sun", "heart", "house", "cat", "tree", "car", "flower", "fish", "moon", "star", "pizza", "boat", "rainbow", "cloud", "apple", "bird",
                 "plane", "umbrella", "guitar", "cake", "ring", "kiss", "bed", "coffee", "beach", "mountain", "dog", "snowman", "balloon", "key",
                 "train", "glasses", "rose", "phone", "book", "gift", "candle", "bicycle", "hat", "airplane ticket"]

struct DrawRound: Identifiable {
    var id: Int { seq }
    var seq: Int; var drawer: String; var word: String; var strokes: [[CGPoint]]
    var guesses: [(text: String, ok: Bool)] = []
    var solved: Bool { guesses.contains { $0.ok } }
    var finished: Bool { solved || guesses.count >= 3 }
}

enum Strokes {
    /// "x,y x,y|x,y …" with coordinates 0…1, three decimals.
    static func encode(_ s: [[CGPoint]]) -> String { s.map { $0.map { String(format: "%.3f,%.3f", $0.x, $0.y) }.joined(separator: " ") }.joined(separator: "|") }
    static func decode(_ t: String) -> [[CGPoint]] {
        t.split(separator: "|").map { $0.split(separator: " ").compactMap { p in let v = p.split(separator: ",").compactMap { Double($0) }; return v.count == 2 ? CGPoint(x: v[0], y: v[1]) : nil } }
    }
}

extension Store {
    var drawMatch: String { "draw-\(couple?.id ?? "")" }
    var drawRounds: [DrawRound] {
        var rounds: [DrawRound] = []
        for e in plays(match: drawMatch) {
            if e.data["type"] == "draw" {
                if let last = rounds.last, !last.finished || e.user == last.drawer { continue }   // ignore drawings out of turn
                rounds.append(DrawRound(seq: e.seq, drawer: e.user, word: e.data["word"] ?? "", strokes: Strokes.decode(e.data["strokes"] ?? "")))
            } else if e.data["type"] == "guess", var last = rounds.last, !last.finished, e.user != last.drawer {
                last.guesses.append((e.data["text"] ?? "", e.data["ok"] == "1")); rounds[rounds.count - 1] = last
            }
        }
        return rounds
    }
    /// Who draws next: the guesser of the last round, or anyone to start.
    var nextDrawer: String? { guard let last = drawRounds.last, last.finished else { return nil }; return couple?.members.first { $0 != last.drawer } }
    static func normalize(_ s: String) -> String { s.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil).trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
    func isRight(_ guess: String, word: String) -> Bool {
        let g = Self.normalize(guess)
        return [word, tr(String.LocalizationValue(word))].map(Self.normalize).contains { $0 == g || ($0.count > 3 && g.contains($0)) }
    }
    func submitDrawing(word: String, strokes: [[CGPoint]]) throws {
        guard !strokes.isEmpty else { throw AppError(message: "Draw something first.") }
        guard drawRounds.last.map({ $0.finished }) ?? true, nextDrawer == nil || nextDrawer == db.currentUser else { throw AppError(message: "It's your partner's turn to draw.") }
        try addPlay(game: "draw", match: drawMatch, data: ["type": "draw", "word": word, "strokes": Strokes.encode(strokes)], nudge: tr("Draw & Guess"))
        if partnerIsDemo { later { store in   // demo partner: a wrong guess, then the right one
            store.addPartnerPlay(game: "draw", match: store.drawMatch, data: ["type": "guess", "text": tr("a balloon?"), "ok": "0"])
            store.later { store in
                store.addPartnerPlay(game: "draw", match: store.drawMatch, data: ["type": "guess", "text": tr(String.LocalizationValue(word)), "ok": "1"])
                store.later { store in store.demoDrawSun() }
            }
        } }
    }
    func submitGuess(_ text: String) throws {
        guard let round = drawRounds.last, !round.finished, round.drawer != db.currentUser else { return }
        let ok = isRight(text, word: round.word)
        let done = ok || round.guesses.count + 1 >= 3
        try addPlay(game: "draw", match: drawMatch, data: ["type": "guess", "text": text, "ok": ok ? "1" : "0"], nudge: done ? tr("Draw & Guess") : nil)
        if done, partnerIsDemo { later { store in store.demoDrawSun() } }
    }
    /// Demo partner draws a simple sun.
    func demoDrawSun() {
        guard partnerIsDemo, nextDrawer == partner?.id else { return }
        let circle = (0...24).map { i -> CGPoint in let a = Double(i) / 24 * 2 * .pi; return CGPoint(x: 0.5 + 0.18 * cos(a), y: 0.5 + 0.18 * sin(a)) }
        let rays = (0..<8).map { i -> [CGPoint] in let a = Double(i) / 8 * 2 * .pi; return [CGPoint(x: 0.5 + 0.26 * cos(a), y: 0.5 + 0.26 * sin(a)), CGPoint(x: 0.5 + 0.38 * cos(a), y: 0.5 + 0.38 * sin(a))] }
        addPartnerPlay(game: "draw", match: drawMatch, data: ["type": "draw", "word": "sun", "strokes": Strokes.encode([circle] + rays)])
    }
}

struct DrawGuessView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var strokes: [[CGPoint]] = []
    @State private var current: [CGPoint] = []
    @State private var choices: [String] = []
    @State private var word: String?
    @State private var guess = ""
    var me: String { store.db.currentUser ?? "" }
    var partnerName: String { store.partner?.name ?? tr("your partner") }

    var body: some View {
        Page {
            GameHeader(emoji: "🎨", title: "Draw & Guess", subtitle: "Sketch a secret word. Your partner guesses it when they're free.", colors: ["#FF7A9C", "#E0306A"])
            let rounds = store.drawRounds
            if let last = rounds.last, !last.finished {
                if last.drawer == me { waitingGuess(last) } else { guessing(last) }
            } else if store.nextDrawer == nil || store.nextDrawer == me {
                if let last = rounds.last { roundResult(last) }
                drawing
            } else if let last = rounds.last {
                roundResult(last)
                Card { HStack(spacing: 12) { ProgressView(); Text("\(partnerName) is drawing next. We'll nudge you when it's ready.").foregroundStyle(.secondary) } }
            }
            let done = rounds.filter(\.finished)
            if !done.isEmpty {
                SectionHeading(title: "Our drawings")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10)], spacing: 10) {
                    ForEach(done.reversed()) { r in
                        VStack(spacing: 4) {
                            Sketch(strokes: r.strokes).frame(height: 100).background(.white, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(p.color("border")))
                            Text(LocalizedStringKey(r.word)).font(.caption.bold()); Text(r.solved ? "✓" : "✗").font(.caption2).foregroundStyle(r.solved ? .green : .secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Draw & Guess").navigationBarTitleDisplayMode(.inline)
        .onAppear { if choices.isEmpty { choices = Array(drawWords.shuffled().prefix(3)) } }
    }

    @ViewBuilder var drawing: some View {
        if let word {
            Card {
                HStack { Text("Draw:").foregroundStyle(.secondary); Text(LocalizedStringKey(word)).font(.headline); Spacer(); Button("Undo") { if !strokes.isEmpty { strokes.removeLast() } }.disabled(strokes.isEmpty); Button("Clear", role: .destructive) { strokes = [] } }
                canvas
                PrimaryButton(title: "Send to \(partnerName)") { store.perform { try store.submitDrawing(word: word, strokes: strokes); strokes = []; self.word = nil; choices = Array(drawWords.shuffled().prefix(3)) } }
                    .disabled(strokes.isEmpty).opacity(strokes.isEmpty ? 0.5 : 1)
            }
        } else {
            Card {
                Text("Your turn to draw").font(.headline)
                Text("Pick a word. Only you can see it.").font(.caption).foregroundStyle(.secondary)
                HStack { ForEach(choices, id: \.self) { w in Button { word = w } label: { Text(LocalizedStringKey(w)).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 12).background(p.soft, in: Capsule()) }.buttonStyle(.smooth) } }
                Button("Other words") { choices = Array(drawWords.shuffled().prefix(3)) }.font(.caption).frame(maxWidth: .infinity)
            }
        }
    }
    var canvas: some View {
        GeometryReader { geo in
            Sketch(strokes: strokes + (current.isEmpty ? [] : [current]))
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0)
                    .onChanged { v in current.append(CGPoint(x: min(1, max(0, v.location.x / geo.size.width)), y: min(1, max(0, v.location.y / geo.size.height)))) }
                    .onEnded { _ in if current.count > 1 { strokes.append(simplify(current)) } else if let p = current.first { strokes.append([p, p]) }; current = [] })
        }
        .aspectRatio(1, contentMode: .fit).background(.white, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(p.color("border")))
    }
    /// Drops points closer than ~0.6 % so drawings stay small to sync.
    func simplify(_ pts: [CGPoint]) -> [CGPoint] {
        var out: [CGPoint] = []
        for p in pts { if let l = out.last, hypot(p.x - l.x, p.y - l.y) < 0.006 { continue }; out.append(p) }
        if let last = pts.last, out.last != last { out.append(last) }
        return out
    }

    func guessing(_ r: DrawRound) -> some View {
        Card {
            Text("\(partnerName) drew something for you").font(.headline)
            Sketch(strokes: r.strokes, animated: true).aspectRatio(1, contentMode: .fit).background(.white, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(p.color("border")))
            ForEach(Array(r.guesses.enumerated()), id: \.offset) { _, g in Label(g.text, systemImage: "xmark.circle").font(.subheadline).foregroundStyle(.secondary) }
            HStack {
                TextField("Your guess", text: $guess).textFieldStyle(.roundedBorder).submitLabel(.send).onSubmit(send)
                Button("Guess", action: send).buttonStyle(.borderedProminent).disabled(guess.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            Text("\(3 - r.guesses.count) tries left").font(.caption).foregroundStyle(.secondary)
        }
    }
    func send() { let g = guess; guard !g.trimmingCharacters(in: .whitespaces).isEmpty else { return }; store.perform { try store.submitGuess(g); guess = "" } }
    func waitingGuess(_ r: DrawRound) -> some View {
        Card {
            Text("You drew: \(Text(LocalizedStringKey(r.word)).bold())")
            Sketch(strokes: r.strokes).frame(height: 160).background(.white, in: RoundedRectangle(cornerRadius: 14))
            ForEach(Array(r.guesses.enumerated()), id: \.offset) { _, g in Label("\(partnerName): \(g.text)", systemImage: "xmark.circle").font(.subheadline).foregroundStyle(.secondary) }
            HStack(spacing: 12) { ProgressView(); Text("Waiting for \(partnerName) to guess.").foregroundStyle(.secondary) }
        }
    }
    func roundResult(_ r: DrawRound) -> some View {
        let guesser = r.drawer == me ? partnerName : tr("You")
        return InfoBanner(text: r.solved ? "\(guesser) guessed “\(tr(String.LocalizationValue(r.word)))” 🎉" : "Nobody got “\(tr(String.LocalizationValue(r.word)))” this time", icon: r.solved ? "party.popper" : "questionmark.circle")
    }
}

/// Draws normalized strokes; `animated` replays them for the guesser.
struct Sketch: View {
    var strokes: [[CGPoint]]
    var animated = false
    @State private var progress: CGFloat = 0
    var body: some View {
        GeometryReader { geo in
            Path { path in
                for s in strokes where !s.isEmpty {
                    path.move(to: CGPoint(x: s[0].x * geo.size.width, y: s[0].y * geo.size.height))
                    for pt in s.dropFirst() { path.addLine(to: CGPoint(x: pt.x * geo.size.width, y: pt.y * geo.size.height)) }
                }
            }
            .trim(from: 0, to: animated ? progress : 1)
            .stroke(Color(hex: "#2B1B2E"), style: StrokeStyle(lineWidth: max(3, geo.size.width / 90), lineCap: .round, lineJoin: .round))
        }
        .padding(6)
        .onAppear { if animated { progress = 0; withAnimation(.easeInOut(duration: 2.5)) { progress = 1 } } }
    }
}
