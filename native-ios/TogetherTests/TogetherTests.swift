import XCTest
@testable import TogetherNative

@MainActor final class TogetherTests: XCTestCase {
    var directory: URL!
    var store: Store!
    override func setUp() async throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        store = Store(file: directory.appendingPathComponent("state.json"))
    }
    override func tearDown() async throws { store.signOut(); try? FileManager.default.removeItem(at: directory); store = nil }
    func register(_ name: String, _ email: String) throws {
        try store.signUp(name: name, email: email, password: "password123")
        try store.verify(store.db.accounts.last!.code)
    }
    func pair() throws -> (String, String) {
        try register("One", "one@example.com"); let one = store.db.currentUser!; let invitation = try store.createInvite()
        store.signOut(); try register("Two", "two@example.com"); let two = store.db.currentUser!; try store.acceptInvite(invitation.code)
        return (one, two)
    }
    func testSharedCatalogReferencesAndDailyRotation() {
        let product = Product.shared
        XCTAssertEqual(Set(product.questions.map(\.id)).count, product.questions.count)
        for deck in product.decks { XCTAssertFalse(deck.questionIds.isEmpty); XCTAssertTrue(deck.questionIds.allSatisfy { product.question($0) != nil }) }
        let day = "2026-11-07"; let pool = product.decks.first!.questionIds
        let index = Int(Day.date(day, zone: "UTC").timeIntervalSince1970 / 86400) % pool.count
        XCTAssertEqual(product.daily(day).id, pool[index])
        XCTAssertEqual(Set(product.palettes.keys), Set(["pink", "purple", "red", "blue"]))
    }
    func testStreakRequiresBothMembersAndCountsEachDayOnce() {
        func moment(_ author: String, _ day: String) -> Moment { Moment(coupleID: "c", author: author, day: day, media: Media(path: "x.jpg", kind: "photo"), caption: "") }
        let moments = [moment("a", "2026-11-05"), moment("b", "2026-11-05"), moment("a", "2026-11-06"), moment("a", "2026-11-06"), moment("b", "2026-11-06"), moment("a", "2026-11-07")]
        let result = Day.streak(moments, members: ["a", "b"], today: "2026-11-07")
        XCTAssertEqual(result.current, 2); XCTAssertEqual(result.longest, 2); XCTAssertEqual(result.days.count, 2)
        XCTAssertEqual(Day.streak(moments, members: ["a", "b"], today: "2026-11-08").current, 0)
        XCTAssertEqual(Day.add("2024-02-28", 1), "2024-02-29")
    }
    func testHiddenAnswersRevealAndSubmittedAnswersAreImmutable() throws {
        let (one, _) = try pair(); let deck = Product.shared.decks[0]; let question = Product.shared.question(deck.questionIds[0])!
        let id = try store.startActivity(question: question, deck: deck)
        try store.submit(id, text: "My private answer")
        store.signOut(); try store.signIn(email: "one@example.com", password: "password123")
        XCTAssertEqual(store.db.currentUser, one)
        let a = try XCTUnwrap(store.activity(id)); XCTAssertTrue(a.visibleAnswers(viewer: one, members: store.couple!.members).isEmpty)
        let export = try Data(contentsOf: store.exportData()); XCTAssertFalse(String(decoding: export, as: UTF8.self).contains("My private answer"))
        try store.submit(id, text: "Other answer")
        XCTAssertTrue(store.activity(id)!.revealed(members: store.couple!.members))
        XCTAssertEqual(store.activity(id)!.visibleAnswers(viewer: one, members: store.couple!.members).count, 2)
        XCTAssertThrowsError(try store.submit(id, text: "Changed answer"))
    }
    func testExpiredUsedAndSelfInvitationsAreRejected() throws {
        try register("One", "one@example.com"); let invite = try store.createInvite()
        XCTAssertThrowsError(try store.acceptInvite(invite.code))
        store.signOut(); try register("Two", "two@example.com")
        store.db.invites[0].expires = Date().addingTimeInterval(-1)
        XCTAssertThrowsError(try store.acceptInvite(invite.code))
        store.db.invites[0].expires = Date().addingTimeInterval(1000); try store.acceptInvite(invite.code)
        store.signOut(); try register("Three", "three@example.com")
        XCTAssertThrowsError(try store.acceptInvite(invite.code))
    }
    func testCoupleIsolationAndExportExcludesCredentials() throws {
        _ = try pair(); try store.send("Private couple message")
        let firstCouple = store.couple!.id
        store.signOut(); try register("Three", "three@example.com")
        XCTAssertTrue(store.messages.isEmpty); XCTAssertThrowsError(try store.send("Intrusion"))
        let data = try Data(contentsOf: store.exportData()); let json = String(decoding: data, as: UTF8.self)
        XCTAssertFalse(json.contains("Private couple message")); XCTAssertFalse(json.contains("passwordHash")); XCTAssertFalse(json.contains(firstCouple))
    }
    func testPersistenceAndLocationRevocation() throws {
        _ = try pair(); store.setSharing(location: true); let id = store.db.currentUser!
        store.db.sharing[id]?.latitude = 45; store.db.sharing[id]?.longitude = -73; store.db.sharing[id]?.updated = Date()
        store.setSharing(location: false)
        XCTAssertNil(store.db.sharing[id]?.latitude); XCTAssertNil(store.db.sharing[id]?.longitude); XCTAssertNil(store.db.sharing[id]?.updated)
        try store.send("Saved through restart")
        let reloaded = Store(file: store.file)
        XCTAssertEqual(reloaded.messages.last?.text, "Saved through restart"); XCTAssertEqual(reloaded.db.currentUser, id)
    }
    func testDeletingMomentMemoryRemovesFlameCreditAndUnlinkHidesContent() throws {
        _ = try pair(); try store.addMoment(media: Media(path: "test.jpg", kind: "photo"), caption: "Today")
        XCTAssertEqual(store.moments.count, 1); let memory = try XCTUnwrap(store.memories.first)
        store.deleteMemory(memory.id); XCTAssertTrue(store.moments.isEmpty)
        try store.send("Gone after unlink"); store.unlink(); XCTAssertNil(store.couple); XCTAssertTrue(store.messages.isEmpty); XCTAssertTrue(store.db.messages.isEmpty); XCTAssertTrue(store.db.activities.isEmpty)
    }
    func testMediaCleanupKeepsFilesStillReferencedByAnotherMemory() throws {
        _ = try pair()
        let mediaDirectory = directory.appendingPathComponent("Media")
        try FileManager.default.createDirectory(at: mediaDirectory, withIntermediateDirectories: true)
        let used = mediaDirectory.appendingPathComponent("used.jpg")
        let unused = mediaDirectory.appendingPathComponent("unused.jpg")
        try Data([1]).write(to: used); try Data([2]).write(to: unused)
        let memory = Memory(coupleID: store.couple!.id, owner: store.db.currentUser!, title: "Keep", body: "", day: store.today, media: Media(path: "used.jpg", kind: "photo"))
        try store.saveMemory(memory); store.removeUnusedMedia()
        XCTAssertTrue(FileManager.default.fileExists(atPath: used.path)); XCTAssertFalse(FileManager.default.fileExists(atPath: unused.path))
        store.deleteMemory(memory.id); XCTAssertFalse(FileManager.default.fileExists(atPath: used.path))
    }
    func testAnnualEventsAndCoupleTimezoneBoundary() throws {
        _ = try pair()
        try store.saveEvent(Event(coupleID: store.couple!.id, title: "Anniversary", day: "2020-01-01", annual: true))
        XCTAssertGreaterThanOrEqual(store.events.first!.day, store.today)
        XCTAssertTrue(store.events.first!.day.hasSuffix("01-01"))
        let instant = ISO8601DateFormatter().date(from: "2026-11-07T00:30:00Z")!
        XCTAssertEqual(Day.key(instant, zone: "America/Chicago"), "2026-11-06")
        XCTAssertEqual(Day.key(instant, zone: "Asia/Tokyo"), "2026-11-07")
    }
    func testConnectionAnswersPersistAndStayPrivateBetweenAccounts() async throws {
        try store.saveConnectionDraft(["focus": "appreciation"], completed: true)
        try register("Ada", "ada@example.com")
        let ada = store.db.currentUser!
        XCTAssertEqual(store.connectionPreferences?.answers["focus"], "appreciation")
        let reloaded = Store(file: store.file)
        XCTAssertEqual(reloaded.connectionPreferences?.answers["focus"], "appreciation")
        store.signOut(); try register("Bo", "bo@example.com")
        XCTAssertNil(store.connectionPreferences)
        try await store.saveConnectionPreferences(["pace": "playful"])
        let export = String(decoding: try Data(contentsOf: store.exportData()), as: UTF8.self)
        XCTAssertFalse(export.contains("appreciation")); XCTAssertTrue(export.contains("playful"))
        XCTAssertEqual(store.db.connectionPreferences?[ada]?.answers["focus"], "appreciation")
        try await store.saveConnectionPreferences([:])
        XCTAssertEqual(store.connectionPreferences?.answers, [:])
    }
    func testConnectionValidationAndRecommendations() throws {
        XCTAssertNoThrow(try ConnectionPreferences.validate([:]))
        XCTAssertThrowsError(try ConnectionPreferences.validate(["pace": "unknown"]))
        XCTAssertThrowsError(try ConnectionPreferences.validate(["diagnosis": "anything"]))
        for question in Product.shared.connectionOnboarding.questions {
            for option in question.options { XCTAssertNoThrow(try ConnectionPreferences.validate([question.id: option.id])) }
        }
        let prefs = ConnectionPreferences(answers: ["focus": "deeper_conversations", "pace": "gentle", "daily_time": "two_minutes"])
        XCTAssertEqual(prefs.suggestion?.deck.id, "deck_ev")
        XCTAssertEqual(prefs.suggestion?.duration, "About 2 minutes · one prompt is enough")
        XCTAssertNil(ConnectionPreferences().suggestion)
    }
    func testLegacyDatabaseStillLoadsWithoutConnectionPreferences() throws {
        let encoded = try JSONEncoder().encode(Database())
        var object = try JSONSerialization.jsonObject(with: encoded) as! [String:Any]
        object.removeValue(forKey: "connectionPreferences"); object.removeValue(forKey: "connectionDraft")
        let legacy = try JSONDecoder().decode(Database.self, from: JSONSerialization.data(withJSONObject: object))
        XCTAssertNil(legacy.connectionPreferences); XCTAssertNil(legacy.connectionDraft)
    }
    func testDemoCallbacksDoNotLeakAcrossSignOut() async throws {
        store.demo(); try store.send("Message before signing out"); store.signOut()
        try await Task.sleep(for: .seconds(2.2))
        XCTAssertEqual(store.db.messages.filter { $0.sender == "demo-partner" }.count, 1)
        XCTAssertNil(store.db.currentUser)
    }

    // MARK: Our Little One (mirrors src/__tests__/lifeGame.test.ts)
    func bornGame(at t0: Date) throws -> LifeGame {
        var g = LifeGame(coupleID: "c", status: "naming", proposedBy: "a", acceptedBy: ["a", "b"], needs: Life.fresh(80), needsAt: t0, skills: ["smart": 0, "kind": 0, "creative": 0, "sporty": 0])
        var v = LifeVote(choice: "name", options: Life.options(g, "name"))
        v = try Life.cast(v, user: "a", option: "mia", members: ["a", "b"]); v = try Life.cast(v, user: "b", option: "mia", members: ["a", "b"])
        g.votes = [v]; return Life.decide(g, v, at: t0)
    }
    func testLifeNamingDecayAndCare() throws {
        let t0 = Date(timeIntervalSince1970: 1_767_225_600); let g = try bornGame(at: t0)
        XCTAssertEqual(g.status, "alive"); XCTAssertEqual(g.name, "Mia")
        XCTAssertEqual(Life.decayed(g, at: t0.addingTimeInterval(36000))["hunger"]!, 40, accuracy: 0.001)
        XCTAssertEqual(Life.mood(Life.decayed(g, at: t0.addingTimeInterval(40 * 3600))), "sad")
        XCTAssertEqual(try Life.apply(g, action: "feed", user: "a", at: t0.addingTimeInterval(3 * 86400)).care, 0)
        XCTAssertEqual(try Life.apply(g, action: "feed", user: "a", at: t0.addingTimeInterval(3600)).care, 15)
        XCTAssertThrowsError(try Life.apply(g, action: "homework", user: "a", at: t0))
    }
    func testLifeGrowthChoicesAndOneYearLimit() throws {
        let t0 = Date(timeIntervalSince1970: 1_767_225_600); var g = try bornGame(at: t0); g.care = 300
        XCTAssertFalse(Life.canGrow(g, at: t0.addingTimeInterval(2 * 86400)))
        XCTAssertEqual(Life.evaluate(g, at: t0.addingTimeInterval(8 * 86400)).stage, "toddler")
        var child = g; child.stage = "child"; child.stageStarted = t0; child.care = 900
        let waiting = Life.evaluate(child, at: t0.addingTimeInterval(50 * 86400))
        XCTAssertEqual(waiting.stage, "child"); XCTAssertEqual(waiting.votes.last?.choice, "school")
        let ended = Life.evaluate(try bornGame(at: t0), at: t0.addingTimeInterval(366 * 86400))
        XCTAssertEqual(ended.status, "ended"); XCTAssertTrue(ended.ending?.contains("Mia") == true)
    }
    func testLifeVotesSecondRoundThenCoinFlip() throws {
        var v = LifeVote(choice: "school", options: ["northstar", "maple", "explorers", "riverside"])
        v = try Life.cast(v, user: "a", option: "northstar", members: ["a", "b"]); v = try Life.cast(v, user: "b", option: "maple", members: ["a", "b"])
        XCTAssertEqual(v.round, 2); XCTAssertEqual(v.previousPicks?["b"], "maple")
        v = try Life.cast(v, user: "a", option: "northstar", members: ["a", "b"]); v = try Life.cast(v, user: "b", option: "maple", members: ["a", "b"], coin: { false })
        XCTAssertTrue(v.decided); XCTAssertTrue(v.coin); XCTAssertEqual(v.result, "maple")
        XCTAssertThrowsError(try Life.cast(LifeVote(choice: "school", options: ["maple"]), user: "stranger", option: "maple", members: ["a", "b"]))
    }
    func testLifeNeedsBothParentsAndStaysInCouple() throws {
        let (_, _) = try pair()
        try store.proposeBaby(); XCTAssertEqual(store.lifeGame?.status, "proposed")
        XCTAssertThrowsError(try store.respondToBaby(true))
        XCTAssertThrowsError(try store.lifeAction("feed"))
        store.signOut(); try store.signIn(email: "one@example.com", password: "password123")
        try store.respondToBaby(true); XCTAssertEqual(store.lifeGame?.status, "naming")
        store.signOut(); try register("Three", "three@example.com")
        XCTAssertNil(store.lifeGame)
    }
}
