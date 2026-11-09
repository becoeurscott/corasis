import CryptoKit
import Foundation

/// Keeps everything the couple shares in step with the partner's phone (docs/SYNC.md).
/// Every ~10 s while the app is open: send what changed here, merge what changed there.
@MainActor final class CoupleSync {
    static let shared = CoupleSync()
    private var running = false
    private var appliedKeys: [String] = []

    /// Per-account bookkeeping kept outside the main database.
    private struct State: Codable {
        var coupleID: String?
        var since: String?
        var hashes: [String: String] = [:]      // "kind:id" -> hash of what both sides agree on
        var mediaKeys: [String: String] = [:]   // local file name -> bucket key
    }
    private func stateKey(_ user: String) -> String { "couple-sync-\(user)" }
    private func load(_ user: String) -> State {
        guard let data = UserDefaults.standard.data(forKey: stateKey(user)), let s = try? JSONDecoder().decode(State.self, from: data) else { return State() }
        return s
    }
    private func save(_ s: State, _ user: String) { if let data = try? JSONEncoder().encode(s) { UserDefaults.standard.set(data, forKey: stateKey(user)) } }

    func sync(_ store: Store) async {
        guard !running, store.usesRemoteCouple, let me = store.me, let couple = store.couple else { return }
        running = true; defer { running = false }
        var state = load(me.id)
        if state.coupleID != couple.id { state = State(coupleID: couple.id) }   // new partner: start fresh

        // 1. Push: everything that differs from what we last agreed on.
        let local = await shared(store, couple: couple, state: &state)
        var changes: [[String: Any]] = []
        for (key, item) in local where state.hashes[key] != item.hash {
            changes.append(["kind": item.kind, "id": item.id, "data": item.data, "deleted": false])
        }
        let localKeys = Set(local.keys)
        for (key, _) in state.hashes where !localKeys.contains(key) {
            let parts = key.split(separator: ":", maxSplits: 1).map(String.init)
            if parts.count == 2, parts[0] != "widget", parts[0] != "couple" { changes.append(["kind": parts[0], "id": parts[1], "data": [:] as [String: Any], "deleted": true]) }
        }

        // 2. Send in batches, then merge what came back.
        var batches = stride(from: 0, to: changes.count, by: 150).map { Array(changes[$0..<min($0 + 150, changes.count)]) }
        if batches.isEmpty { batches = [[]] }
        for (index, batch) in batches.enumerated() {
            guard let reply = try? await InsForge.shared.syncItems(batch, since: index == 0 ? state.since : state.since) else { return }
            for item in batch {
                let key = "\(item["kind"] as! String):\(item["id"] as! String)"
                if item["deleted"] as? Bool == true { state.hashes[key] = nil } else { state.hashes[key] = local[key]?.hash }
            }
            let items = reply["items"] as? [[String: Any]] ?? []
            var newest: String?
            for raw in items {
                guard let kind = raw["kind"] as? String, let id = raw["id"] as? String else { continue }
                let deleted = raw["deleted"] as? Bool ?? false
                let data = raw["data"] as? [String: Any] ?? [:]
                let ok = await apply(store, kind: kind, id: id, data: data, deleted: deleted, couple: couple, state: &state)
                if !ok { break }   // media download failed: retry from here next time
                if let updated = raw["updated_at"] as? String { newest = updated }
            }
            // Remember what we now agree on, so received items aren't sent straight back.
            if !appliedKeys.isEmpty {
                let now = await shared(store, couple: store.couple ?? couple, state: &state)
                for key in appliedKeys { state.hashes[key] = now[key]?.hash }
                appliedKeys = []
            }
            if let newest, let date = ISO8601DateFormatter.flexible.date(from: newest) {
                state.since = ISO8601DateFormatter.flexible.string(from: date.addingTimeInterval(-5))
            } else if state.since == nil {
                state.since = ISO8601DateFormatter.flexible.string(from: Date().addingTimeInterval(-5))
            }
        }
        save(state, me.id)
    }

    // MARK: Local → shared

    private struct Item { var kind: String; var id: String; var data: [String: Any]; var hash: String }
    private func item(_ kind: String, _ id: String, _ data: [String: Any]) -> Item {
        let json = (try? JSONSerialization.data(withJSONObject: data, options: [.sortedKeys])) ?? Data()
        return Item(kind: kind, id: id, data: data, hash: SHA256.hash(data: json).map { String(format: "%02x", $0) }.joined())
    }
    private func iso(_ d: Date?) -> Any { d.map { ISO8601DateFormatter.flexible.string(from: $0) } ?? NSNull() }
    private func opt(_ s: String?) -> Any { s.flatMap { $0.isEmpty ? nil : $0 } ?? NSNull() }

    /// Uploads the file the first time; afterwards reuses the stored key.
    private func media(_ m: Media?, couple: Couple, state: inout State) async -> Any {
        guard let m else { return NSNull() }
        if let key = state.mediaKeys[m.path] { return ["key": key, "kind": m.kind] }
        let url = MediaFiles.url(m.path)
        guard FileManager.default.fileExists(atPath: url.path), let key = try? await InsForge.shared.uploadCoupleMedia(coupleID: couple.id, file: url) else { return NSNull() }
        state.mediaKeys[m.path] = key
        return ["key": key, "kind": m.kind]
    }

    private func shared(_ store: Store, couple: Couple, state: inout State) async -> [String: Item] {
        var out: [String: Item] = [:]
        func add(_ i: Item) { out["\(i.kind):\(i.id)"] = i }
        let db = store.db
        for m in db.moments where m.coupleID == couple.id {
            add(item("moment", m.id, ["authorId": m.author, "day": m.day, "caption": opt(m.caption), "createdAt": iso(m.created), "media": await media(m.media, couple: couple, state: &state)]))
        }
        for n in db.messages where n.coupleID == couple.id {
            add(item("message", n.id, ["senderId": n.sender, "kind": n.kind, "text": opt(n.text), "affection": NSNull(), "media": await media(n.media, couple: couple, state: &state), "createdAt": iso(n.created), "reactions": n.reactions]))
        }
        for a in db.activities where a.coupleID == couple.id {
            let subs: [[String: Any]] = a.answers.map { ["userId": $0.userID, "answer": $0.text, "comment": opt($0.comment), "skipped": $0.skipped, "submittedAt": iso(a.created)] }
            add(item("session", a.id, ["deckId": a.deckID, "questionId": a.questionID, "day": opt(a.day), "createdAt": iso(a.created), "abandoned": a.abandoned, "submissions": subs, "reactions": a.reactions]))
        }
        for m in db.memories where m.coupleID == couple.id {
            let kind = m.momentID != nil ? "moment" : (m.media?.kind ?? "letter")
            add(item("memory", m.id, ["ownerId": m.owner, "kind": kind, "title": opt(m.title), "body": opt(m.body), "caption": NSNull(), "day": m.day, "createdAt": iso(nil), "media": await media(m.media, couple: couple, state: &state), "favoritedBy": m.favorites, "momentId": opt(m.momentID)]))
        }
        for e in db.events where e.coupleID == couple.id {
            add(item("event", e.id, ["kind": e.kind, "title": e.title, "date": e.day, "allDay": e.allDay, "time": e.allDay ? NSNull() : e.time as Any, "timezone": couple.timezone, "destination": opt(e.destination), "notes": opt(e.notes), "annual": e.annual, "reminders": [e.reminderDays], "cancelled": false, "createdBy": ""]))
        }
        for g in db.lifeGames ?? [] where g.coupleID == couple.id {
            add(item("life", g.id, lifeData(g)))
        }
        for e in db.checkups ?? [] where e.coupleID == couple.id {
            add(item("checkup", e.id, ["round": e.round, "userId": e.user, "ratings": e.ratings, "guess": e.guess, "submittedAt": iso(e.submitted)]))
        }
        for p in db.places ?? [] where p.coupleID == couple.id {
            add(item("place", p.id, ["owner": p.owner, "addedBy": p.addedBy, "name": p.name, "emoji": p.emoji, "lat": p.latitude, "lon": p.longitude, "radius": p.radius, "alerts": p.alerts]))
        }
        add(item("couple", "settings", ["start": opt(couple.start), "stage": couple.stage, "distance": couple.distance, "goals": couple.goals, "timezone": couple.timezone]))
        if let note = db.widgetMessages[couple.id], !note.isEmpty { add(item("widget", "note", ["text": note, "by": "", "at": iso(nil)])) }
        return out
    }

    private func lifeData(_ g: LifeGame) -> [String: Any] {
        [
            "status": g.status, "proposedBy": g.proposedBy, "acceptedBy": g.acceptedBy, "name": opt(g.name), "bornAt": iso(g.born),
            "stage": g.stage, "stageStartedAt": iso(g.stageStarted), "needs": g.needs, "needsAt": iso(g.needsAt), "care": g.care, "skills": g.skills,
            "decisions": g.decisions,
            "votes": g.votes.map { v -> [String: Any] in ["id": v.id, "choice": v.choice, "options": v.options, "round": v.round, "picks": v.picks, "previousPicks": v.previousPicks ?? NSNull(), "decided": v.decided, "result": opt(v.result), "coin": v.coin, "openedAt": iso(v.opened)] },
            "log": g.log.map { ["id": $0.id, "userId": $0.userID, "actionId": $0.action, "at": iso($0.at)] },
            "milestones": g.milestones.map { ["id": $0.id, "kind": $0.kind, "text": $0.text, "at": iso($0.at)] },
            "endedAt": iso(g.ended), "ending": opt(g.ending), "clockOffsetMs": g.clockOffset * 1000, "keepsakeSaved": g.keepsakeSaved,
        ]
    }

    // MARK: Shared → local

    private func str(_ v: Any?) -> String? { v as? String }
    private func date(_ v: Any?) -> Date? { (v as? String).flatMap { ISO8601DateFormatter.flexible.date(from: $0) ?? ISO8601DateFormatter().date(from: $0) } }

    /// Downloads media we don't have yet into the app's media folder.
    private func localMedia(_ v: Any?, state: inout State) async -> (Media?, Bool) {
        guard let m = v as? [String: Any], let key = m["key"] as? String else { return (nil, true) }
        let kind = m["kind"] as? String ?? "photo"
        if let path = state.mediaKeys.first(where: { $0.value == key })?.key, FileManager.default.fileExists(atPath: MediaFiles.url(path).path) { return (Media(path: path, kind: kind), true) }
        guard let data = try? await InsForge.shared.downloadCoupleMedia(key: key) else { return (nil, false) }
        let ext = (key as NSString).pathExtension.isEmpty ? "bin" : (key as NSString).pathExtension
        guard let file = try? MediaFiles.save(data, extension: ext) else { return (nil, false) }
        state.mediaKeys[file.lastPathComponent] = key
        return (Media(path: file.lastPathComponent, kind: kind), true)
    }

    /// Returns false when a media file couldn't be fetched yet (try again next sync).
    private func apply(_ store: Store, kind: String, id: String, data d: [String: Any], deleted: Bool, couple: Couple, state: inout State) async -> Bool {
        let key = "\(kind):\(id)"
        if deleted {
            switch kind {
            case "moment": store.db.moments.removeAll { $0.id == id }
            case "message": store.db.messages.removeAll { $0.id == id }
            case "session": store.db.activities.removeAll { $0.id == id }
            case "memory": store.db.memories.removeAll { $0.id == id }
            case "event": store.db.events.removeAll { $0.id == id }
            case "life": store.db.lifeGames?.removeAll { $0.id == id }
            case "place": store.db.places?.removeAll { $0.id == id }; PlaceMonitor.shared.refresh(store)
            case "checkup": store.db.checkups?.removeAll { $0.id == id }
            default: break
            }
            state.hashes[key] = nil
            return true
        }
        switch kind {
        case "moment":
            let (m, ok) = await localMedia(d["media"], state: &state); guard ok, let m else { return ok }
            let value = Moment(id: id, coupleID: couple.id, author: str(d["authorId"]) ?? "", day: str(d["day"]) ?? store.today, media: m, caption: str(d["caption"]) ?? "", created: date(d["createdAt"]) ?? Date())
            upsert(&store.db.moments, value)
        case "message":
            let (m, ok) = await localMedia(d["media"], state: &state); guard ok else { return false }
            var value = Note(id: id, coupleID: couple.id, sender: str(d["senderId"]) ?? "", text: str(d["text"]) ?? "", kind: str(d["kind"]) ?? "text", media: m, created: date(d["createdAt"]) ?? Date())
            value.reactions = d["reactions"] as? [String: String] ?? [:]
            upsert(&store.db.messages, value)
        case "session":
            let existing = store.db.activities.first { $0.id == id }
            let me = store.me?.id ?? ""
            let remote = (d["submissions"] as? [[String: Any]] ?? []).map { Answer(userID: str($0["userId"]) ?? "", text: str($0["answer"]) ?? "", skipped: $0["skipped"] as? Bool ?? false, comment: str($0["comment"]) ?? "") }
            // My own answer is mine; my partner's comes from the server.
            let mine = existing?.answers.filter { $0.userID == me } ?? []
            let answers = mine + remote.filter { $0.userID != me || mine.isEmpty }
            var value = Activity(id: id, coupleID: couple.id, deckID: str(d["deckId"]) ?? "", questionID: str(d["questionId"]) ?? "", day: str(d["day"]))
            value.answers = answers; value.drafts = existing?.drafts ?? [:]; value.abandoned = d["abandoned"] as? Bool ?? false
            value.reactions = d["reactions"] as? [String: String] ?? [:]; value.created = date(d["createdAt"]) ?? existing?.created ?? Date()
            upsert(&store.db.activities, value)
        case "memory":
            let (m, ok) = await localMedia(d["media"], state: &state); guard ok else { return false }
            var value = Memory(id: id, coupleID: couple.id, owner: str(d["ownerId"]) ?? "", title: str(d["title"]) ?? "", body: str(d["body"]) ?? "", day: str(d["day"]) ?? store.today, media: m)
            value.favorites = d["favoritedBy"] as? [String] ?? []; value.momentID = str(d["momentId"])
            upsert(&store.db.memories, value)
        case "event":
            var value = Event(coupleID: couple.id, title: str(d["title"]) ?? "", day: str(d["date"]) ?? store.today)
            value.id = id; value.kind = str(d["kind"]) ?? "meeting"; value.destination = str(d["destination"]) ?? ""; value.notes = str(d["notes"]) ?? ""
            value.annual = d["annual"] as? Bool ?? false; value.allDay = d["allDay"] as? Bool ?? true; value.time = str(d["time"]) ?? "12:00"
            value.reminderDays = (d["reminders"] as? [Int])?.first ?? 1
            upsert(&store.db.events, value)
        case "life":
            guard let g = life(id: id, couple: couple, d) else { return true }
            var all = store.db.lifeGames ?? []; if let i = all.firstIndex(where: { $0.id == id }) { all[i] = g } else { all.insert(g, at: 0) }; store.db.lifeGames = all
        case "place":
            guard let owner = str(d["owner"]), let name = str(d["name"]), let lat = d["lat"] as? Double, let lon = d["lon"] as? Double else { return true }
            let v = Place(id: id, coupleID: couple.id, owner: owner, addedBy: str(d["addedBy"]) ?? "", name: name, emoji: str(d["emoji"]) ?? "📍", latitude: lat, longitude: lon, radius: d["radius"] as? Double ?? 150, alerts: d["alerts"] as? Bool ?? true)
            var all = store.db.places ?? []; all.removeAll { $0.id == id }; all.append(v); store.db.places = all
            PlaceMonitor.shared.refresh(store)
        case "checkup":
            guard let round = str(d["round"]), let user = str(d["userId"]), let ratings = d["ratings"] as? [Int] else { return true }
            let e = CheckupEntry(coupleID: couple.id, round: round, user: user, ratings: ratings, guess: d["guess"] as? Int ?? 0, submitted: date(d["submittedAt"]) ?? Date())
            var all = store.db.checkups ?? []; all.removeAll { $0.id == e.id }; all.append(e); store.db.checkups = all
        case "couple":
            if let i = store.db.couples.firstIndex(where: { $0.id == couple.id }) {
                store.db.couples[i].start = str(d["start"]); store.db.couples[i].stage = str(d["stage"]) ?? store.db.couples[i].stage
                store.db.couples[i].distance = str(d["distance"]) ?? store.db.couples[i].distance; store.db.couples[i].goals = d["goals"] as? [String] ?? []
                if let tz = str(d["timezone"]), TimeZone(identifier: tz) != nil { store.db.couples[i].timezone = tz }
            }
        case "widget":
            store.db.widgetMessages[couple.id] = str(d["text"]) ?? ""
        default:
            return true
        }
        appliedKeys.append(key)
        return true
    }

    private func upsert<T: Identifiable>(_ list: inout [T], _ value: T) where T.ID == String {
        if let i = list.firstIndex(where: { $0.id == value.id }) { list[i] = value } else { list.append(value) }
    }

    private func life(id: String, couple: Couple, _ d: [String: Any]) -> LifeGame? {
        guard let proposedBy = str(d["proposedBy"]) else { return nil }
        var g = LifeGame(id: id, coupleID: couple.id, proposedBy: proposedBy, acceptedBy: d["acceptedBy"] as? [String] ?? [], needs: (d["needs"] as? [String: Double]) ?? [:], needsAt: date(d["needsAt"]) ?? Date(), skills: (d["skills"] as? [String: Int]) ?? [:])
        g.status = str(d["status"]) ?? "proposed"; g.name = str(d["name"]); g.born = date(d["bornAt"]); g.stage = str(d["stage"]) ?? "newborn"
        g.stageStarted = date(d["stageStartedAt"]); g.care = d["care"] as? Int ?? 0; g.decisions = d["decisions"] as? [String: String] ?? [:]
        g.votes = (d["votes"] as? [[String: Any]] ?? []).map { v in
            var x = LifeVote(id: str(v["id"]) ?? UUID().uuidString, choice: str(v["choice"]) ?? "", options: v["options"] as? [String] ?? [])
            x.round = v["round"] as? Int ?? 1; x.picks = v["picks"] as? [String: String] ?? [:]; x.previousPicks = v["previousPicks"] as? [String: String]
            x.decided = v["decided"] as? Bool ?? false; x.result = str(v["result"]); x.coin = v["coin"] as? Bool ?? false; x.opened = date(v["openedAt"]) ?? Date()
            return x
        }
        g.log = (d["log"] as? [[String: Any]] ?? []).map { LifeLogEntry(id: str($0["id"]) ?? UUID().uuidString, userID: str($0["userId"]) ?? "", action: str($0["actionId"]) ?? "", at: date($0["at"]) ?? Date()) }
        g.milestones = (d["milestones"] as? [[String: Any]] ?? []).map { LifeMilestone(id: str($0["id"]) ?? UUID().uuidString, kind: str($0["kind"]) ?? "", text: str($0["text"]) ?? "", at: date($0["at"]) ?? Date()) }
        g.ended = date(d["endedAt"]); g.ending = str(d["ending"]); g.clockOffset = ((d["clockOffsetMs"] as? Double) ?? 0) / 1000; g.keepsakeSaved = d["keepsakeSaved"] as? Bool ?? false
        return g
    }
}
