#if DEBUG
import Foundation

/// DEBUG only: launch with `-gamesSelfTest`. Simulates two phones (two separate Stores)
/// playing every new game, passing each move through the same JSON round-trip the server
/// sync uses, and checks both sides always agree. Results go to the console ("SELFTEST …").
@MainActor enum GamesSelfTest {
    static func run() {
        let a = "user-a", b = "user-b"
        func phone(_ me: String) -> Store {
            let s = Store(file: FileManager.default.temporaryDirectory.appendingPathComponent("selftest-\(me)-\(UUID().uuidString).json"))
            s.db = Database()
            s.db.people = [Person(id: a, name: "Ana"), Person(id: b, name: "Ben")]
            s.db.accounts = [a, b].map { Account(id: $0, email: "\($0)@test", passwordHash: "", salt: "", verified: true, code: "") }
            var c = Couple(members: [a, b]); c.id = "couple-test"; c.timezone = "Europe/Paris"
            s.db.couples = [c]; s.db.currentUser = me
            return s
        }
        let A = phone(a), B = phone(b)
        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { if !ok { failures.append(what) }; print("SELFTEST \(ok ? "PASS" : "FAIL") \(what)") }
        /// Copies every play entry each side has into the other, via JSON like the server.
        func sync() {
            for (from, to) in [(A, B), (B, A)] {
                for e in from.db.plays ?? [] {
                    let dict = try! JSONSerialization.jsonObject(with: CoupleSync.coder.encode(e))
                    let back = try! CoupleSync.decoder.decode(PlayEntry.self, from: JSONSerialization.data(withJSONObject: dict))
                    var all = to.db.plays ?? []; all.removeAll { $0.id == back.id }; all.append(back); to.db.plays = all
                }
            }
        }

        // Love Duels — Four in a Row: A wins with a vertical line in column 0.
        let four = try! A.startDuel(.four); sync()
        for (who, col) in [(A, 0), (B, 1), (A, 0), (B, 1), (A, 0), (B, 1), (A, 0)] { try! who.duelMove(four, col); sync() }
        let fa = A.duelState(four)!, fb = B.duelState(four)!
        check(fa.winner == a && fb.winner == a, "Four in a Row: both phones see Ana win")
        check(fa.columns == fb.columns, "Four in a Row: same board on both phones")
        try! B.duelMove(four, 2); sync()
        check(A.plays(match: four).count == 8, "Four in a Row: no moves after the game ends")

        // Love Duels — Dots & Boxes: play the whole board alternating whoever's turn it is.
        let dots = try! B.startDuel(.dots); sync()
        var guardCount = 0
        while let s = A.duelState(dots), s.winner == nil, guardCount < 100 {
            let mover = s.turn == a ? A : B
            try! mover.duelMove(dots, s.legalMoves.first!); sync(); guardCount += 1
        }
        let da = A.duelState(dots)!, db = B.duelState(dots)!
        check(da.winner != nil && da.winner == db.winner, "Dots & Boxes: game finishes with the same result")
        check(da.score(a) + da.score(b) == 16 && da.score(a) == db.score(a), "Dots & Boxes: 16 boxes, same score on both phones")
        check(B.duelMatches.count == 2 && A.duelMatches.count == 2, "Love Duels: both phones list both matches")

        // Two Halves — same puzzle on both phones, complementary clues, shared result.
        let pa = A.halvesPuzzle()!, pb = B.halvesPuzzle()!
        check(pa.answer == pb.answer && pa.cards.map(\.emoji) == pb.cards.map(\.emoji), "Two Halves: identical puzzle on both phones")
        check(pa.halfOf[a] != pa.halfOf[b], "Two Halves: each partner gets a different half")
        for day in (0..<30).map({ Day.add(A.today, $0) }) {
            let pz = A.halvesPuzzle(day: day)!
            let rebuilt = HalvesPuzzle(couple: A.couple!, day: day)
            if pz.answer != rebuilt.answer || pz.clues.map(\.count) != rebuilt.clues.map(\.count) { check(false, "Two Halves: deterministic on \(day)") }
        }
        check(true, "Two Halves: 30 days deterministic")
        try! A.lockHalves(pa.answer); sync()
        check(B.halvesPick(a) == pa.answer && B.halvesPick(b) == nil, "Two Halves: partner sees my pick, theirs still open")
        try! B.lockHalves(pb.answer); sync()
        check(A.halvesSolved == 1 && B.halvesSolved == 1, "Two Halves: solved together on both phones")

        // Draw & Guess — A draws, B guesses wrong then right, then B draws.
        try! A.submitDrawing(word: "cat", strokes: [[CGPoint(x: 0.1, y: 0.1), CGPoint(x: 0.9, y: 0.9)]]); sync()
        check(B.drawRounds.last?.word == "cat" && B.drawRounds.last?.strokes.first?.count == 2, "Draw & Guess: partner receives the drawing")
        try! B.submitGuess("dog"); sync()
        check(A.drawRounds.last?.guesses.count == 1 && A.drawRounds.last?.finished == false, "Draw & Guess: wrong guess shows on drawer's phone")
        try! B.submitGuess("  Cat "); sync()
        check(A.drawRounds.last?.solved == true && B.drawRounds.last?.solved == true, "Draw & Guess: right guess solves on both phones")
        check(A.nextDrawer == b && B.nextDrawer == b, "Draw & Guess: turns swap to the guesser")
        _ = try? A.submitDrawing(word: "sun", strokes: [[CGPoint(x: 0.5, y: 0.5), CGPoint(x: 0.6, y: 0.6)]]); sync()
        check(B.drawRounds.count == 1, "Draw & Guess: the wrong person can't draw out of turn")

        // Our Garden — computed from shared data, so both sides match.
        check(A.gardenGrowth.games == B.gardenGrowth.games, "Our Garden: same growth on both phones")

        print("SELFTEST DONE \(failures.isEmpty ? "ALL PASS" : "\(failures.count) FAILED: \(failures)")")
    }
}
#endif
