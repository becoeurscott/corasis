import SwiftUI
import CryptoKit
import Security
import UserNotifications
import WidgetKit

struct AppError: LocalizedError {
    var message: String; var errorDescription: String? { message }
    init(message: String.LocalizationValue) { self.message = tr(message) }
    init(raw: String) { message = raw }
}
@MainActor final class Store: ObservableObject {
    @Published var affectionBursts: [AffectionBurst] = []
    @Published var db: Database { didSet { persist() } }
    @Published var error: String?
    @Published var locked = false
    @Published var pendingInvite = ""
    /// Set when a Mend the Heart invitation notification is tapped.
    @Published var openRepairs = false
    /// A rematch to open from a finished Love Duels board.
    @Published var pendingDuel: String?
    let file: URL
    private var generation = UUID()
    init(file: URL? = nil) {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Together", isDirectory: true)
        self.file = file ?? directory.appendingPathComponent("state.json")
        if FileManager.default.fileExists(atPath: self.file.path) {
            do { db = try JSONDecoder().decode(Database.self, from: Data(contentsOf: self.file)) }
            catch {
                let backup = self.file.appendingPathExtension("unreadable-" + UUID().uuidString)
                try? FileManager.default.copyItem(at: self.file, to: backup)
                db = Database(); self.error = tr("Saved data could not be opened. A copy of the original file has been kept for recovery. \(error.localizedDescription)")
            }
        } else { db = Database() }
        locked = db.prefs.lock && db.currentUser != nil
        if db.demo { seedDemoPartnerLive() }
    }
    func persist() {
        do { try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true); try JSONEncoder().encode(db).write(to: file, options: [.atomic, .completeFileProtectionUnlessOpen]) }
        catch { self.error = tr("Could not save your changes: \(error.localizedDescription)") }
        syncWidgetData()
    }
    private func syncWidgetData() {
        let s = streak; let tz = couple?.timezone ?? me?.timezone ?? TimeZone.current.identifier
        let evt = events.first { $0.day >= today && ($0.kind == "meeting" || $0.kind == "visit") }
        WidgetData(streakCurrent: s.current, streakLongest: s.longest, todayComplete: s.days.contains(today), timezone: tz, partnerMessage: db.widgetMessages[couple?.id ?? ""] ?? tr("A little closer, every day 💕"), myName: me?.name ?? "You", partnerName: partner?.name ?? "Partner", nextEventTitle: evt.map { $0.destination.isEmpty ? $0.title : $0.destination }, nextEventDay: evt?.day, daysToEvent: evt.map { Day.distance(today, $0.day) }, updatedAt: Date()).save()
        reloadWidgets()
    }
    private func reloadWidgets() {
        WidgetCenter.shared.reloadAllTimelines()
    }
    var me: Person? { db.people.first { $0.id == db.currentUser } }
    var couple: Couple? { guard let id = db.currentUser else { return nil }; return db.couples.first { $0.members.contains(id) } }
    var partner: Person? { guard let c = couple else { return nil }; return db.people.first { c.members.contains($0.id) && $0.id != db.currentUser } }
    var today: String { Day.key(zone: couple?.timezone ?? me?.timezone ?? TimeZone.current.identifier) }
    var moments: [Moment] { db.moments.filter { $0.coupleID == couple?.id } }
    var memories: [Memory] { db.memories.filter { $0.coupleID == couple?.id }.sorted { $0.day > $1.day } }
    var messages: [Note] { db.messages.filter { $0.coupleID == couple?.id }.sorted { $0.created < $1.created } }
    var activities: [Activity] { db.activities.filter { $0.coupleID == couple?.id && !$0.abandoned }.sorted { $0.created > $1.created } }
    var events: [Event] {
        db.events.filter { $0.coupleID == couple?.id }.map { original in
            var event = original
            if event.annual && event.day < today {
                var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .gmt
                let source = Day.date(event.day, zone: "UTC")
                let components = calendar.dateComponents([.month, .day], from: source)
                let anchor = Day.date(today, zone: "UTC").addingTimeInterval(-1)
                if let next = calendar.nextDate(after: anchor, matching: components, matchingPolicy: .nextTime) { event.day = Day.key(next, zone: "UTC") }
            }
            return event
        }.sorted { $0.day < $1.day }
    }
    var nextEvent: Event? { events.first { $0.day >= today && ($0.kind == "meeting" || $0.kind == "visit") } }
    var streak: (current: Int, longest: Int, days: [String]) { Day.streak(moments, members: couple?.members ?? [], today: today) }
    var verified: Bool { db.demo || db.accounts.first { $0.id == db.currentUser }?.verified == true }
    func perform(_ action: () throws -> Void) { do { try action() } catch { self.error = error.localizedDescription } }
    func requireCouple() throws -> Couple { guard me != nil, verified, let c = couple, c.members.count == 2 else { throw AppError(message: "Connect a partner before sharing. You can explore a demo from Partner connection.") }; return c }
    func hash(_ password: String, salt: String) -> String {
        // Local demonstration credentials only. A production server must handle auth.
        SHA256.hash(data: Data((salt + password).utf8)).map { String(format: "%02x", $0) }.joined()
    }
    func signUp(name: String, email: String, password: String) throws {
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard email.range(of: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", options: .regularExpression) != nil else { throw AppError(message: "Enter a valid email address.") }
        guard password.count >= 8 else { throw AppError(message: "Use at least 8 characters for your password.") }
        guard !db.accounts.contains(where: { $0.email == email }) else { throw AppError(message: "This email already has a local account. Sign in instead.") }
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { throw AppError(message: "Enter your first name.") }
        let person = Person(name: name.trimmingCharacters(in: .whitespaces), email: email)
        let salt = UUID().uuidString
        db.people.append(person); db.accounts.append(Account(id: person.id, email: email, passwordHash: hash(password, salt: salt), salt: salt, code: String(Int.random(in: 100000...999999))))
        db.currentUser = person.id; db.demo = false; adoptConnectionDraft()
    }
    func signIn(email: String, password: String) throws {
        guard let account = db.accounts.first(where: { $0.email == email.trimmingCharacters(in: .whitespaces).lowercased() }), hash(password, salt: account.salt) == account.passwordHash else { throw AppError(message: "Email or password is incorrect for this device.") }
        generation = UUID(); db.currentUser = account.id; db.demo = false; locked = db.prefs.lock
    }
    func verify(_ code: String) throws {
        guard let i = db.accounts.firstIndex(where: { $0.id == db.currentUser }), code == db.accounts[i].code else { throw AppError(message: "The verification code is incorrect.") }
        db.accounts[i].verified = true
    }
    func resetCode(email: String) -> String? {
        guard let i = db.accounts.firstIndex(where: { $0.email == email.lowercased().trimmingCharacters(in: .whitespaces) }) else { return nil }
        let code = String(Int.random(in: 100000...999999)); db.accounts[i].resetCode = code; return code
    }
    func resetPassword(email: String, code: String, password: String) throws {
        guard password.count >= 8, let i = db.accounts.firstIndex(where: { $0.email == email.lowercased().trimmingCharacters(in: .whitespaces) }), db.accounts[i].resetCode == code, !code.isEmpty else { throw AppError(message: "Check your reset code and use a password of at least 8 characters.") }
        db.accounts[i].passwordHash = hash(password, salt: db.accounts[i].salt); db.accounts[i].resetCode = nil
    }
    // MARK: InsForge accounts (used when Info.plist has InsForgeURL / InsForgeAnonKey)
    var isRemoteAccount: Bool { db.accounts.first { $0.id == db.currentUser }?.remote == true }
    func performAsync(_ action: @escaping () async throws -> Void) async { do { try await action() } catch { self.error = error.localizedDescription } }
    /// Mirrors a signed-in InsForge user locally, keeping a photo picked before the account existed.
    private func adoptRemote(_ user: RemoteUser, name: String, avatar: String?, replacing pendingID: String? = nil) {
        let email = user.email.lowercased()
        if let pendingID, pendingID != user.id {
            if let value = db.connectionPreferences?[pendingID] {
                var values = db.connectionPreferences ?? [:]; values[user.id] = value; values[pendingID] = nil; db.connectionPreferences = values
            }
            if let i = db.people.firstIndex(where: { $0.id == pendingID }) { db.people[i].id = user.id }
            db.accounts.removeAll { $0.id == pendingID }
        }
        if let i = db.people.firstIndex(where: { $0.id == user.id }) { if let avatar { db.people[i].avatar = avatar } }
        else { var person = Person(id: user.id, name: name.isEmpty ? "You" : name, email: email); person.avatar = avatar; db.people.append(person) }
        db.accounts.removeAll { $0.id == user.id }
        db.accounts.append(Account(id: user.id, email: email, passwordHash: "", salt: "", verified: true, code: "", resetCode: nil, remote: true))
        generation = UUID(); db.currentUser = user.id; db.demo = false
    }
    func createAccount(name: String, email: String, password: String, avatar: String?) async throws {
        guard InsForge.configured else { try signUp(name: name, email: email, password: password); if let avatar, let i = db.people.firstIndex(where: { $0.id == db.currentUser }) { db.people[i].avatar = avatar }; return }
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(); let name = name.trimmingCharacters(in: .whitespaces)
        guard email.range(of: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", options: .regularExpression) != nil else { throw AppError(message: "Enter a valid email address.") }
        guard password.count >= 8 else { throw AppError(message: "Use at least 8 characters for your password.") }
        guard !name.isEmpty else { throw AppError(message: "Enter your first name.") }
        let result = try await InsForge.shared.signUp(email: email, password: password, name: name)
        if let user = result.user, !result.needsVerification { adoptRemote(user, name: name, avatar: avatar); adoptConnectionDraft(); await syncProfile(); return }
        // Waiting for the emailed code: keep a pending local profile so the photo survives until verification.
        let pendingID = "pending-" + UUID().uuidString
        var person = Person(id: pendingID, name: name, email: email); person.avatar = avatar
        db.people.removeAll { $0.id.hasPrefix("pending-") }; db.accounts.removeAll { $0.id.hasPrefix("pending-") }
        db.people.append(person); db.accounts.append(Account(id: pendingID, email: email, passwordHash: "", salt: "", verified: false, code: "", resetCode: nil, remote: true))
        generation = UUID(); db.currentUser = pendingID; db.demo = false; adoptConnectionDraft()
    }
    func verifyAccount(_ code: String) async throws {
        guard isRemoteAccount, let account = db.accounts.first(where: { $0.id == db.currentUser }), let person = me else { try verify(code); return }
        let user = try await InsForge.shared.verifyEmail(email: account.email, code: code.trimmingCharacters(in: .whitespaces))
        adoptRemote(user, name: person.name, avatar: person.avatar, replacing: person.id)
        await syncProfile()
    }
    func resendVerification() async throws {
        guard isRemoteAccount, let account = db.accounts.first(where: { $0.id == db.currentUser }) else { if let i = db.accounts.firstIndex(where: { $0.id == db.currentUser }) { db.accounts[i].code = String(Int.random(in: 100000...999999)) }; return }
        try await InsForge.shared.resendVerification(email: account.email)
    }
    func logIn(email: String, password: String) async throws {
        guard InsForge.configured else { try signIn(email: email, password: password); return }
        let user = try await InsForge.shared.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), password: password)
        try await finishLogIn(user)
    }
    /// Google / Apple. Returns false when the person closes the sheet.
    func logIn(provider: String) async throws -> Bool {
        guard InsForge.configured else { throw AppError(message: "Social sign-in needs the online backend.") }
        let key = provider.lowercased()
        guard await InsForge.shared.oauthProviders().contains(key) else { throw AppError(message: "\(provider) sign-in isn’t switched on yet. Use Google or your email for now.") }
        let start = try await InsForge.shared.startOAuth(provider: key)
        guard let callback = try await OAuthSheet.shared.open(start.url) else { return false }
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        guard let code = items.first(where: { $0.name == "insforge_code" })?.value else { throw items.first(where: { $0.name == "error_description" })?.value.map { AppError(raw: $0) } ?? AppError(message: "Sign-in was not completed.") }
        try await finishLogIn(try await InsForge.shared.exchangeOAuth(code: code, verifier: start.verifier))
        return true
    }
    /// Step 1 of email sign-in/up. Returns the code only in local preview (no email service).
    func sendEmailCode(_ email: String) async throws -> String? {
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard email.range(of: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", options: .regularExpression) != nil else { throw AppError(message: "Enter a valid email address.") }
        if InsForge.configured { try await InsForge.shared.sendCode(email: email); return nil }
        let code = String(Int.random(in: 100000...999999))
        if let i = db.accounts.firstIndex(where: { $0.email == email }) { db.accounts[i].code = code; return code }
        let person = Person(name: "You", email: email)
        db.people.append(person); db.accounts.append(Account(id: person.id, email: email, passwordHash: "", salt: "", code: code))
        return code
    }
    /// Step 2: the code signs in, creating the account on first use.
    func verifyEmailCode(email: String, code: String, name: String, avatar: String?) async throws {
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(); let code = code.trimmingCharacters(in: .whitespaces)
        if InsForge.configured {
            let user = try await InsForge.shared.verifyCode(email: email, code: code, name: name.trimmingCharacters(in: .whitespaces))
            try await finishLogIn(user, name: name, avatar: avatar, draft: true); db.onboarded = true; return
        }
        guard let i = db.accounts.firstIndex(where: { $0.email == email }), db.accounts[i].code == code, !code.isEmpty else { throw AppError(message: "That code does not match. Check the code and try again.") }
        db.accounts[i].verified = true; db.accounts[i].code = ""
        if let p = db.people.firstIndex(where: { $0.id == db.accounts[i].id }) {
            if !name.isEmpty, db.people[p].name == "You" { db.people[p].name = name }
            if let avatar, db.people[p].avatar == nil { db.people[p].avatar = avatar }
        }
        generation = UUID(); db.currentUser = db.accounts[i].id; db.demo = false; db.onboarded = true; adoptConnectionDraft(); locked = db.prefs.lock
    }
    private func finishLogIn(_ user: RemoteUser, name: String = "", avatar: String? = nil, draft: Bool = false) async throws {
        adoptRemote(user, name: name, avatar: avatar); if draft { adoptConnectionDraft() }; locked = db.prefs.lock
        if let saved = try? await InsForge.shared.fetchProfile(id: user.id), let i = db.people.firstIndex(where: { $0.id == user.id }) {
            db.people[i].name = saved.first_name.isEmpty ? db.people[i].name : saved.first_name
            db.people[i].pronouns = saved.pronouns ?? ""; if TimeZone(identifier: saved.timezone) != nil { db.people[i].timezone = saved.timezone }
            db.people[i].avatarURL = saved.avatar_url; db.people[i].avatarKey = saved.avatar_key
            if saved.avatar_url != nil { db.people[i].avatarSource = db.people[i].avatar }
        } else { await syncProfile() }
        let preferences = try await InsForge.shared.fetchConnectionPreferences(userID: user.id)
        if preferences != nil || !draft { var values = db.connectionPreferences ?? [:]; values[user.id] = preferences; db.connectionPreferences = values }; db.connectionDraft = nil
        await syncCouple()
    }
    /// Uploads a new local photo if needed, then saves the profile row on InsForge.
    func syncProfile() async {
        guard isRemoteAccount, let person = me, !person.id.hasPrefix("pending-") else { return }
        do {
            var p = person
            if let path = p.avatar, path.hasPrefix("avatar:") {
                if let previous = p.avatarKey { await InsForge.shared.removeAvatar(key: previous) }
                p.avatarURL = path; p.avatarKey = nil; p.avatarSource = path
            } else if let path = p.avatar, p.avatarSource != path || p.avatarURL == nil {
                let previous = p.avatarKey
                let stored = try await InsForge.shared.uploadAvatar(userID: p.id, file: MediaFiles.url(path))
                p.avatarURL = stored.url; p.avatarKey = stored.key; p.avatarSource = path
                if let previous, previous != stored.key { await InsForge.shared.removeAvatar(key: previous) }
            }
            try await InsForge.shared.upsertProfile(RemoteProfile(id: p.id, first_name: p.name, pronouns: p.pronouns.isEmpty ? nil : p.pronouns, timezone: p.timezone, avatar_url: p.avatarURL, avatar_key: p.avatarKey))
            if let value = db.connectionPreferences?[p.id] { try await InsForge.shared.saveConnectionPreferences(userID: p.id, value: value) }
            if let i = db.people.firstIndex(where: { $0.id == p.id }) { db.people[i].avatarURL = p.avatarURL; db.people[i].avatarKey = p.avatarKey; db.people[i].avatarSource = p.avatarSource }
        } catch { self.error = tr("Your profile is saved on this iPhone but did not sync: \(error.localizedDescription)") }
    }
    func signOut() { if isRemoteAccount { let token = UserDefaults.standard.string(forKey: "apns-token"); Task { if let token { await InsForge.shared.removePushToken(token) }; await InsForge.shared.signOut() } }; UNUserNotificationCenter.current().removeAllPendingNotificationRequests(); generation = UUID(); db.currentUser = nil; db.demo = false; db.connectionDraft = nil; locked = false }
    func demo(name: String = "Sam") {
        generation = UUID()
        if db.people.contains(where: { $0.id == "demo-me" }), db.couples.contains(where: { $0.members.contains("demo-me") }) {
            seedDemoPartnerLive(); db.currentUser = "demo-me"; db.demo = true; db.onboarded = true; adoptConnectionDraft(); return
        }
        db.people.removeAll { $0.id == "demo-me" || $0.id == "demo-partner" }
        let me = Person(id: "demo-me", name: name.isEmpty ? "Sam" : name)
        let partner = Person(id: "demo-partner", name: "Alex", timezone: "America/Toronto", simulated: true)
        db.people += [me, partner]
        let c = Couple(members: [me.id, partner.id], start: Day.add(today, -420))
        db.couples.append(c); db.currentUser = me.id; db.demo = true; db.onboarded = true; adoptConnectionDraft(); seedDemoPartnerLive()
        db.events.append(Event(coupleID: c.id, title: tr("Next visit"), day: Day.add(today, 22), destination: "Montréal", notes: tr("Coffee and the long way home.")))
        db.memories.append(Memory(coupleID: c.id, owner: partner.id, title: tr("Before you land"), body: tr("I keep thinking about the first hour at the airport. No plans, just coffee and the long way home. Travel safe. — Simulated partner letter"), day: Day.add(today, -20)))
        db.messages.append(Note(coupleID: c.id, sender: partner.id, text: tr("Thinking about our next trip 💜 (simulated)")))
    }
    func updateProfile(name: String, pronouns: String, timezone: String, avatar: String? = nil) throws {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty, let i = db.people.firstIndex(where: { $0.id == db.currentUser }), TimeZone(identifier: timezone) != nil else { throw AppError(message: "Enter a name and a valid time zone.") }
        db.people[i].name = name; db.people[i].pronouns = pronouns; db.people[i].timezone = timezone
        if let avatar { db.people[i].avatar = avatar }
        if isRemoteAccount { Task { await syncProfile() } }
    }
    func saveCouple(_ c: Couple) { guard let i = db.couples.firstIndex(where: { $0.id == couple?.id }), c.id == db.couples[i].id, c.members == db.couples[i].members else { return }; db.couples[i] = c }
    // MARK: Partner connection on InsForge (real accounts); local accounts and the demo stay on-device.
    var usesRemoteCouple: Bool { InsForge.configured && isRemoteAccount && !db.demo }
    private func adoptRemoteCouple(_ rc: RemoteCouple) {
        guard let me else { return }
        let p = rc.partner
        if let i = db.people.firstIndex(where: { $0.id == p.id }) { db.people[i].name = p.first_name; db.people[i].timezone = p.timezone; db.people[i].avatarURL = p.avatar_url }
        else { var person = Person(id: p.id, name: p.first_name); person.timezone = p.timezone; person.avatarURL = p.avatar_url; db.people.append(person) }
        if !db.couples.contains(where: { $0.id == rc.couple_id }) {
            var c = Couple(id: rc.couple_id, members: [me.id, p.id]); c.timezone = rc.timezone
            db.couples.removeAll { $0.members.contains(me.id) }; db.couples.append(c)
        }
        for i in db.invites.indices where db.invites[i].owner == me.id && db.invites[i].status == "pending" { db.invites[i].status = "accepted" }
        pendingInvite = ""
    }
    func createInviteRemote() async throws {
        guard let me, couple == nil else { throw AppError(message: "You are already connected with a partner.") }
        let r = try await InsForge.shared.createInvitation()
        for i in db.invites.indices where db.invites[i].owner == me.id && db.invites[i].status == "pending" { db.invites[i].status = "revoked" }
        db.invites.append(Invite(owner: me.id, code: r.code, expires: ISO8601DateFormatter.flexible.date(from: r.expires_at) ?? Date().addingTimeInterval(86400)))
    }
    func acceptInviteRemote(_ code: String) async throws { adoptRemoteCouple(try await InsForge.shared.acceptInvitation(code: code)) }
    /// Checks the server for a partner connection (e.g. the partner just entered our code). Returns true when connected.
    @discardableResult func syncCouple() async -> Bool {
        guard usesRemoteCouple else { return couple != nil }
        guard let rc = try? await InsForge.shared.myCouple() else { return couple != nil }
        adoptRemoteCouple(rc); return true
    }
    func createInvite() throws -> Invite {
        guard let me, verified, couple == nil else { throw AppError(message: "You must be verified and unpaired to create an invitation.") }
        for i in db.invites.indices where db.invites[i].owner == me.id && db.invites[i].status == "pending" { db.invites[i].status = "revoked" }
        let invite = Invite(owner: me.id, code: UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(8).uppercased(), expires: Date().addingTimeInterval(86400))
        db.invites.append(invite); return invite
    }
    func acceptInvite(_ code: String) throws {
        guard let me, verified, couple == nil, let i = db.invites.firstIndex(where: { $0.code == code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }), db.invites[i].owner != me.id, db.invites[i].expires > Date(), db.invites[i].status == "pending", !db.couples.contains(where: { $0.members.contains(db.invites[i].owner) }) else { throw AppError(message: "The invitation is invalid, expired, already used, or belongs to you. Invitations only work between accounts on this device.") }
        db.couples.append(Couple(members: [db.invites[i].owner, me.id])); db.invites[i].status = "accepted"; pendingInvite = ""
    }
    func unlink() {
        guard let c = couple else { return }; generation = UUID()
        if usesRemoteCouple { Task { try? await InsForge.shared.unlinkCouple() } }
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        db.couples.removeAll { $0.id == c.id }
        db.moments.removeAll { $0.coupleID == c.id }; db.activities.removeAll { $0.coupleID == c.id }
        db.messages.removeAll { $0.coupleID == c.id }; db.memories.removeAll { $0.coupleID == c.id }
        db.events.removeAll { $0.coupleID == c.id }; db.widgetMessages[c.id] = nil
        c.members.forEach { db.sharing[$0] = Sharing() }
        removeUnusedMedia()
    }
    func deleteAccount() {
        guard let id = db.currentUser else { return }; unlink(); db.people.removeAll { $0.id == id }; db.accounts.removeAll { $0.id == id }; db.invites.removeAll { $0.owner == id }; db.messages.removeAll { $0.sender == id }; db.moments.removeAll { $0.author == id }; db.memories.removeAll { $0.owner == id }; db.favorites[id] = nil; db.sharing[id] = nil; db.connectionPreferences?[id] = nil; removeUnusedMedia(); signOut()
    }
    func addMoment(media: Media, caption: String) throws {
        let c = try requireCouple(); guard let id = db.currentUser, !moments.contains(where: { $0.author == id && $0.day == today }) else { throw AppError(message: "Your moment for today is already saved.") }
        let moment = Moment(coupleID: c.id, author: id, day: today, media: media, caption: caption)
        db.moments.append(moment); db.memories.append(Memory(coupleID: c.id, owner: id, title: caption, body: "", day: today, media: media, momentID: moment.id))
        if partner?.simulated == true { later { store in
            guard store.couple?.id == c.id, !store.db.moments.contains(where: { $0.coupleID == c.id && $0.author == "demo-partner" && $0.day == moment.day }) else { return }
            // A simulated moment reuses the supplied media and is explicitly labeled.
            let reply = Moment(coupleID: c.id, author: "demo-partner", day: moment.day, media: media, caption: tr("A little piece of my day · simulated"))
            store.db.moments.append(reply)
            store.db.memories.append(Memory(coupleID: c.id, owner: "demo-partner", title: reply.caption, body: "", day: moment.day, media: media, momentID: reply.id))
        } }
    }
    func restoreStreak() throws {
        let c = try requireCouple(); guard db.prefs.premium else { throw AppError(message: "Restore flame requires Together Plus.") }
        let yesterday = Day.add(today, -1)
        for member in c.members where !db.moments.contains(where: { $0.coupleID == c.id && $0.author == member && $0.day == yesterday }) {
            db.moments.append(Moment(coupleID: c.id, author: member, day: yesterday, media: Media(path: "flame-restore", kind: "system"), caption: tr("🔥 Flame restored")))
        }
    }
    func startActivity(question: Question, deck: Deck, daily: Bool = false) throws -> String {
        let c = try requireCouple()
        if deck.premium && !db.prefs.premium { throw AppError(message: "This deck is part of Together Plus.") }
        // Today's question has the same id on both phones, so both answers land in one session.
        let dailyID = "daily-\(c.id)-\(today)"
        if daily, let existing = activities.first(where: { $0.id == dailyID }) ?? activities.first(where: { $0.day == today && $0.deckID == "deck_daily" }) { return existing.id }
        var item = Activity(coupleID: c.id, deckID: deck.id, questionID: question.id, day: daily ? today : nil)
        if daily { item.id = dailyID }
        db.activities.append(item); return item.id
    }
    func activity(_ id: String) -> Activity? { activities.first { $0.id == id } }
    func saveDraft(_ id: String, text: String) { guard activity(id) != nil, let user = db.currentUser, let i = db.activities.firstIndex(where: { $0.id == id }), !db.activities[i].answers.contains(where: { $0.userID == user }) else { return }; db.activities[i].drafts[user] = text }
    func submit(_ id: String, text: String, comment: String = "", skipped: Bool = false) throws {
        let c = try requireCouple()
        guard let user = db.currentUser, let i = db.activities.firstIndex(where: { $0.id == id && $0.coupleID == c.id && !$0.abandoned }), !db.activities[i].answers.contains(where: { $0.userID == user }), skipped || !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw AppError(message: "Enter an answer. Submitted answers are locked.") }
        db.activities[i].answers.append(Answer(userID: user, text: text, skipped: skipped, comment: comment)); db.activities[i].drafts[user] = nil
        if partner?.simulated == true { later { store in
            guard store.couple?.id == c.id, let index = store.db.activities.firstIndex(where: { $0.id == id && !$0.abandoned }), !store.db.activities[index].answers.contains(where: { $0.userID == "demo-partner" }) else { return }
            let q = store.db.activities[index].questionID
            store.db.activities[index].answers.append(Answer(userID: "demo-partner", text: Product.shared.simulatedAnswers[q] ?? Product.shared.simulatedAnswers["default"]!))
        } }
    }
    func abandon(_ id: String) { guard activity(id) != nil, let i = db.activities.firstIndex(where: { $0.id == id }) else { return }; db.activities[i].abandoned = true }
    func reactActivity(_ id: String, emoji: String) { guard let a = activity(id), a.revealed(members: couple?.members ?? []), let user = db.currentUser, let i = db.activities.firstIndex(where: { $0.id == id }) else { return }; db.activities[i].reactions[user] = emoji }
    func favoriteQuestion(_ id: String) { guard let user = db.currentUser else { return }; var list = db.favorites[user] ?? []; list.contains(id) ? list.removeAll { $0 == id } : list.append(id); db.favorites[user] = list }
    func send(_ text: String, kind: String = "text", media: Media? = nil) throws {
        let c = try requireCouple(); guard let id = db.currentUser, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || media != nil else { return }
        db.messages.append(Note(coupleID: c.id, sender: id, text: text, kind: kind, media: media))
        if partner?.simulated == true { later { store in guard store.couple?.id == c.id else { return }; store.db.messages.append(Note(coupleID: c.id, sender: "demo-partner", text: kind == "affection" ? tr("Sending one right back 💕 (simulated)") : tr("That made me smile. Thinking of you. (simulated)"))) } }
    }
    func reactMessage(_ id: String) { guard messages.contains(where: { $0.id == id }), let user = db.currentUser, let i = db.messages.firstIndex(where: { $0.id == id }) else { return }; db.messages[i].reactions[user] = db.messages[i].reactions[user] == nil ? "❤️" : nil }
    func saveMemory(_ memory: Memory) throws { let c = try requireCouple(); guard memory.coupleID == c.id, memory.owner == db.currentUser else { throw AppError(message: "You can only edit your own memories.") }; if let i = db.memories.firstIndex(where: { $0.id == memory.id }) { guard db.memories[i].owner == db.currentUser else { return }; db.memories[i] = memory } else { db.memories.append(memory) } }
    func favoriteMemory(_ id: String) { guard memories.contains(where: { $0.id == id }), let user = db.currentUser, let i = db.memories.firstIndex(where: { $0.id == id }) else { return }; if db.memories[i].favorites.contains(user) { db.memories[i].favorites.removeAll { $0 == user } } else { db.memories[i].favorites.append(user) } }
    func deleteMemory(_ id: String) { guard let memory = memories.first(where: { $0.id == id && $0.owner == db.currentUser }) else { return }; db.memories.removeAll { $0.id == id }; if let momentID = memory.momentID { db.moments.removeAll { $0.id == momentID } }; removeUnusedMedia() }
    func saveEvent(_ event: Event) throws { let c = try requireCouple(); guard event.coupleID == c.id, !event.title.trimmingCharacters(in: .whitespaces).isEmpty else { throw AppError(message: "Give your event a title.") }; if let i = db.events.firstIndex(where: { $0.id == event.id && $0.coupleID == c.id }) { db.events[i] = event } else { db.events.append(event) } }
    func deleteEvent(_ id: String) { guard events.contains(where: { $0.id == id }) else { return }; db.events.removeAll { $0.id == id }; UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["event-" + id]) }
    /// The simulated partner shares country and battery, like the React Native demo (Montréal, 64%).
    func seedDemoPartnerLive() { var s = db.sharing["demo-partner"] ?? Sharing(location: true, battery: true, latitude: 45.5017, longitude: -73.5673, updated: Date()); s.location = true; s.battery = true; if s.latitude == nil || s.longitude == nil { s.latitude = 45.5017; s.longitude = -73.5673; s.updated = Date() }; if s.country == nil { s.country = "Canada" }; if s.countryCode == nil { s.countryCode = "CA" }; if s.batteryPercent == nil { s.batteryPercent = 64 }; db.sharing["demo-partner"] = s }
    func setSharing(location: Bool? = nil, battery: Bool? = nil) {
        guard let id = db.currentUser else { return }; var sharing = db.sharing[id] ?? Sharing()
        if let location { sharing.location = location; if !location { sharing.latitude = nil; sharing.longitude = nil; sharing.updated = nil; sharing.country = nil; sharing.countryCode = nil } }
        if let battery { sharing.battery = battery; if !battery { sharing.batteryPercent = nil } }; db.sharing[id] = sharing
        Task { await syncLive() }
    }
    func exportData() throws -> URL {
        guard let user = me else { throw AppError(message: "Sign in to export your data.") }
        // Credentials, other accounts, private drafts and unrevealed partner answers are excluded.
        struct Export: Encodable { var connectionPreferences: ConnectionPreferences?; var profile: Person; var couple: Couple?; var moments: [Moment]; var memories: [Memory]; var messages: [Note]; var activities: [Activity]; var events: [Event] }
        let safeActivities = activities.map { a -> Activity in var item = a; item.answers = a.visibleAnswers(viewer: user.id, members: couple?.members ?? []); item.drafts = [user.id: a.drafts[user.id] ?? ""]; return item }
        let value = Export(connectionPreferences: connectionPreferences, profile: user, couple: couple, moments: moments, memories: memories, messages: messages, activities: safeActivities, events: events)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("together-export.json"); let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; try encoder.encode(value).write(to: url); return url
    }
    var connectionPreferences: ConnectionPreferences? { db.currentUser.flatMap { db.connectionPreferences?[$0] } }
    func saveConnectionDraft(_ answers: [String:String], completed: Bool = false) throws {
        try ConnectionPreferences.validate(answers)
        db.connectionDraft = ConnectionPreferences(answers: answers, completed: completed)
    }
    func adoptConnectionDraft() {
        guard let id = db.currentUser, let draft = db.connectionDraft else { return }
        var values = db.connectionPreferences ?? [:]; values[id] = draft; db.connectionPreferences = values; db.connectionDraft = nil
    }
    func saveConnectionPreferences(_ answers: [String:String]) async throws {
        guard let id = db.currentUser, verified else { throw AppError(message: "Sign in to save your preferences.") }
        try ConnectionPreferences.validate(answers)
        let value = ConnectionPreferences(answers: answers, completed: true)
        if isRemoteAccount { try await InsForge.shared.saveConnectionPreferences(userID: id, value: value) }
        var values = db.connectionPreferences ?? [:]; values[id] = value; db.connectionPreferences = values
    }
    func removeUnusedMedia() {
        var used = Set(db.people.compactMap(\.avatar))
        db.moments.forEach { used.insert($0.media.path) }
        db.memories.compactMap(\.media).forEach { used.insert($0.path) }
        db.messages.compactMap(\.media).forEach { used.insert($0.path) }
        for activity in db.activities {
            for answer in activity.answers where answer.text.hasPrefix("media:") {
                if let media = try? JSONDecoder().decode(Media.self, from: Data(answer.text.dropFirst(6).utf8)) { used.insert(media.path) }
            }
        }
        guard let files = try? FileManager.default.contentsOfDirectory(at: file.deletingLastPathComponent().appendingPathComponent("Media"), includingPropertiesForKeys: nil) else { return }
        for file in files where !used.contains(file.lastPathComponent) && !used.contains(file.path) { try? FileManager.default.removeItem(at: file) }
    }
    func resetAll() { UNUserNotificationCenter.current().removeAllPendingNotificationRequests(); generation = UUID(); Secure.delete("pin"); db = Database(); locked = false }
    func later(_ action: @escaping @MainActor (Store) -> Void) {
        let current = generation
        Task { [weak self] in try? await Task.sleep(for: .seconds(2)); guard let self, self.generation == current else { return }; action(self) }
    }
}
enum Secure {
    static let service = "com.ebenezer.corasis"
    static func put(_ value: String, key: String) throws {
        delete(key); let query: [String:Any] = [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:service, kSecAttrAccount as String:key, kSecValueData as String:Data(value.utf8), kSecAttrAccessible as String:kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else { throw AppError(message: "Could not save the app lock securely.") }
    }
    static func get(_ key: String) -> String? { var result: CFTypeRef?; let q: [String:Any] = [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:service, kSecAttrAccount as String:key, kSecReturnData as String:true, kSecMatchLimit as String:kSecMatchLimitOne]; guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }; return String(data:data, encoding:.utf8) }
    static func delete(_ key: String) { SecItemDelete([kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:service, kSecAttrAccount as String:key] as CFDictionary) }
}

extension ISO8601DateFormatter {
    /// Accepts timestamps with or without fractional seconds (Postgres returns both).
    static let flexible: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
}
