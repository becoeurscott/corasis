import SwiftUI

// Mend the Heart ("Réparons le Cœur"): a gentle six-step repair after a hurt.
// Not about who is right — about feeling heard and finding a solution together.
// Each partner only edits their own RepairEntry; CoupleSync carries it to the other phone.

enum RepairStep: Int, CaseIterable {
    case invite, feelings, listen, perspective, needs, solution, gesture, done
    var title: String {
        switch self {
        case .invite: tr("An invitation")
        case .feelings: tr("Share how you feel")
        case .listen: tr("Listen to my heart")
        case .perspective: tr("Step into my shoes")
        case .needs: tr("What I need")
        case .solution: tr("Our solution")
        case .gesture: tr("A mending gesture")
        case .done: tr("Heart mended")
        }
    }
}

struct RepairEmotion: Identifiable { var id: String; var emoji: String; var label: String }
var repairEmotions: [RepairEmotion] { [
    RepairEmotion(id: "sad", emoji: "😢", label: tr("Sadness")), RepairEmotion(id: "angry", emoji: "😠", label: tr("Anger")),
    RepairEmotion(id: "disappointed", emoji: "💔", label: tr("Disappointment")), RepairEmotion(id: "lonely", emoji: "🥺", label: tr("Loneliness")),
    RepairEmotion(id: "frustrated", emoji: "😤", label: tr("Frustration")), RepairEmotion(id: "misunderstood", emoji: "😕", label: tr("Misunderstood")),
] }

extension Store {
    func repairEntries(_ repair: String? = nil) -> [RepairEntry] {
        guard let c = couple else { return [] }
        return (db.repairs ?? []).filter { $0.coupleID == c.id && (repair == nil || $0.repair == repair) }
    }
    /// Repairs grouped by id, newest first.
    var repairIDs: [String] {
        let all = repairEntries(); var seen: [String] = []
        for e in all.sorted(by: { $0.created > $1.created }) where !seen.contains(e.repair) { seen.append(e.repair) }
        return seen
    }
    /// Invitations from my partner I haven't answered yet.
    var repairWaiting: Int {
        guard let me = db.currentUser else { return 0 }
        return repairIDs.filter { id in let e = repairEntries(id); return !e.contains { $0.user == me } || e.first { $0.user == me }?.response == "later" }.count
    }
    func repairStep(_ id: String) -> RepairStep {
        guard let me = db.currentUser, let partner = couple?.members.first(where: { $0 != me }) else { return .invite }
        let e = repairEntries(id)
        guard let m = e.first(where: { $0.user == me }), let t = e.first(where: { $0.user == partner }), m.response == "accepted", t.response == "accepted" else { return .invite }
        if m.story.isEmpty || t.story.isEmpty { return .feelings }
        if !m.listened || !t.listened { return .listen }
        if m.reformulation.isEmpty || t.reformulation.isEmpty || m.approved != t.reformulation || t.approved != m.reformulation { return .perspective }
        if m.need.isEmpty || t.need.isEmpty { return .needs }
        let deal = repairDeal(m, t)
        if m.agreed != deal || t.agreed != deal { return .solution }
        if m.gesture.isEmpty || t.gesture.isEmpty { return .gesture }
        return .done
    }
    func repairDeal(_ a: RepairEntry, _ b: RepairEntry) -> String {
        [a, b].sorted { $0.user < $1.user }.map(\.proposal).joined(separator: "\n")
    }
    func startRepair(topic: String) throws -> String {
        let c = try requireCouple(); guard let me = db.currentUser else { throw AppError(message: "Sign in first.") }
        let id = UUID().uuidString
        var all = db.repairs ?? []
        all.append(RepairEntry(coupleID: c.id, repair: id, user: me, starter: true, topic: topic.trimmingCharacters(in: .whitespacesAndNewlines), response: "accepted"))
        db.repairs = all; simulatePartnerRepair(id)
        // Make sure the invitation is on the server before the partner's phone buzzes.
        if usesRemoteCouple { let topic = all.last?.topic; Task { await CoupleSync.shared.sync(self); sendPartnerAlert(kind: "repair", place: topic?.isEmpty == false ? topic : nil) } }
        return id
    }
    /// Changes only my own side of a repair.
    func updateRepair(_ id: String, _ change: (inout RepairEntry) -> Void) {
        guard let c = couple, let me = db.currentUser else { return }
        var all = db.repairs ?? []
        var e = all.first { $0.repair == id && $0.user == me } ?? RepairEntry(coupleID: c.id, repair: id, user: me)
        change(&e); e.updated = Date()
        all.removeAll { $0.id == e.id }; all.append(e); db.repairs = all
        simulatePartnerRepair(id)
    }
    func deleteRepair(_ id: String) { db.repairs?.removeAll { $0.repair == id } }

    /// The demo partner plays along one step behind you, so the flow can be tried alone.
    private func simulatePartnerRepair(_ id: String) {
        guard let partner, partner.simulated, let c = couple else { return }
        later { store in
            guard let me = store.db.currentUser, var all = store.db.repairs, let m = all.first(where: { $0.repair == id && $0.user == me }) else { return }
            var t = all.first { $0.repair == id && $0.user == partner.id } ?? RepairEntry(coupleID: c.id, repair: id, user: partner.id)
            let before = t.updated
            if t.response.isEmpty { t.response = "accepted" }
            if !m.story.isEmpty && t.story.isEmpty { t.emotions = ["misunderstood"]; t.story = tr("I was swamped all day and felt accused when I wasn't trying to hurt you. · simulated") }
            if m.listened { t.listened = true }
            if m.listened && t.reformulation.isEmpty { t.reformulation = tr("You felt you weren't a priority today, and that hurt. · simulated") }
            if !m.reformulation.isEmpty { t.approved = m.reformulation }
            if !m.need.isEmpty && t.need.isEmpty { t.need = tr("I'd like you to understand I can't always answer quickly. · simulated") }
            if !m.need.isEmpty && t.proposal.isEmpty { t.proposal = tr("I'll send a quick text when I know I'll be unreachable. · simulated") }
            if !m.agreed.isEmpty { t.agreed = store.repairDeal(m, t) }
            if !m.gesture.isEmpty && t.gesture.isEmpty { t.gesture = tr("Thank you for telling me. I love you. 💕 · simulated") }
            if !m.followUp.isEmpty && t.followUp.isEmpty { t.followUp = "kept" }
            t.updated = Date()
            guard t.updated != before else { return }
            all.removeAll { $0.id == t.id }; all.append(t); store.db.repairs = all
        }
    }
}

// MARK: Home

struct RepairHomeView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var topic = ""
    @State private var open: String?
    @State private var notice: String?
    @State private var safety = false
    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 8) {
                Text("MEND THE HEART").font(.caption.bold()).foregroundStyle(.tint)
                Text("Sometimes loving each other means learning to understand each other.").font(.title2.bold())
                Text("Did something hurt? Take a moment to share how you feel and find your way back to each other, at your own pace. This isn't about who's right.").foregroundStyle(.secondary)
            }
            if store.couple == nil { InfoBanner(text: tr("Connect with your partner first.")) } else {
                Card {
                    Text("What would you like to mend?").font(.headline)
                    TextField("e.g. Yesterday, when I didn't hear from you all day", text: $topic, axis: .vertical).lineLimit(2...4).textFieldStyle(.roundedBorder)
                    PrimaryButton(title: tr("Start a repair")) {
                        do { open = try store.startRepair(topic: topic); topic = "" } catch { notice = error.localizedDescription }
                    }
                    Text("\(store.partner?.name ?? "Your partner") will be invited. They can accept, decline, or come back later — nobody has to take part.").font(.caption).foregroundStyle(.secondary)
                }
            }
            let ids = store.repairIDs
            if !ids.isEmpty {
                SectionHeading(title: tr("Your repairs"))
                ForEach(ids, id: \.self) { id in
                    NavigationLink { RepairView(id: id) } label: { row(id) }.buttonStyle(.smooth)
                }
            }
            let solutions = ids.filter { store.repairStep($0) == .done }
            if !solutions.isEmpty {
                SectionHeading(title: tr("Our solutions box"))
                Text("Agreements you found together, kept privately for the two of you.").font(.caption).foregroundStyle(.secondary)
                ForEach(solutions, id: \.self) { id in
                    let e = store.repairEntries(id)
                    Card {
                        Text(e.first(where: \.starter)?.topic.nonEmpty ?? tr("A repair")).font(.headline)
                        ForEach(e.filter { !$0.proposal.isEmpty }) { x in Label(x.proposal, systemImage: "checkmark.heart").font(.subheadline) }
                    }
                }
            }
            Button("If you feel unsafe in your relationship") { safety = true }.font(.footnote).frame(maxWidth: .infinity)
        }
        .navigationTitle("Mend the Heart").navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $open) { RepairView(id: $0) }
        .sheet(isPresented: $safety) { RepairSafetyView() }
        .alert(notice ?? "", isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } })) { Button("OK") { notice = nil } }
    }
    func row(_ id: String) -> some View {
        let step = store.repairStep(id); let e = store.repairEntries(id)
        return Card {
            HStack {
                RepairHeart(progress: Double(step.rawValue) / 7, size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text(e.first(where: \.starter)?.topic.nonEmpty ?? tr("A repair")).font(.headline).lineLimit(2)
                    Text(e.contains(where: \.paused) ? "Paused" : step == .done ? "Mended" : "Step \(max(1, step.rawValue)) of 6 · \(step.title)").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
        }
    }
}

extension String { var nonEmpty: String? { isEmpty ? nil : self } }

// MARK: Session

struct RepairView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @Environment(\.dismiss) var dismiss
    var id: String
    @State private var emotions: Set<String> = []
    @State private var text = ""
    @State private var clarifying = false
    @State private var confirmDelete = false
    @State private var safety = false
    var me: String { store.db.currentUser ?? "" }
    var mine: RepairEntry? { store.repairEntries(id).first { $0.user == me } }
    var theirs: RepairEntry? { store.repairEntries(id).first { $0.user != me } }
    var partnerName: String { store.partner?.name ?? tr("Your partner") }
    var step: RepairStep { store.repairStep(id) }

    var body: some View {
        Page {
            VStack(spacing: 10) {
                RepairHeart(progress: Double(step.rawValue) / 7, size: 110).frame(maxWidth: .infinity)
                if step != .invite && step != .done { Text("STEP \(step.rawValue) OF 6").font(.caption.bold()).foregroundStyle(.tint) }
                Text(step.title).font(.title2.bold())
                if let topic = store.repairEntries(id).first(where: \.starter)?.topic.nonEmpty { Text("“\(topic)”").font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center) }
            }.frame(maxWidth: .infinity)
            if let who = store.repairEntries(id).first(where: \.paused) { paused(who) } else { content }
            if step != .invite && step != .done && !(mine?.paused ?? false) {
                Button { store.updateRepair(id) { $0.paused = true } } label: { Label("I need a pause", systemImage: "pause.circle") }.frame(maxWidth: .infinity, minHeight: 44)
            }
            Button("If you feel unsafe in your relationship") { safety = true }.font(.footnote).frame(maxWidth: .infinity)
        }
        .navigationTitle("Mend the Heart").navigationBarTitleDisplayMode(.inline)
        .toolbar { Menu { Button("Delete this repair", role: .destructive) { confirmDelete = true } } label: { Image(systemName: "ellipsis.circle") } }
        .confirmationDialog("Delete this repair for both of you?", isPresented: $confirmDelete, titleVisibility: .visible) { Button("Delete", role: .destructive) { store.deleteRepair(id); dismiss() } }
        .sheet(isPresented: $safety) { RepairSafetyView() }
        .animation(.spring(duration: 0.5), value: step)
        .onChange(of: step) { _, _ in text = ""; emotions = []; clarifying = false }
    }

    @ViewBuilder var content: some View {
        switch step {
        case .invite: invite
        case .feelings:
            if mine?.story.isEmpty ?? true { feelingsForm } else { waiting("Your feelings are saved privately. They'll be revealed when \(partnerName) has shared too.") }
        case .listen:
            if let m = mine, let t = theirs {
                testimony(t, title: "\(partnerName)'s heart"); testimony(m, title: "Your heart")
                if m.listened { waiting("Waiting for \(partnerName) to finish listening.") }
                else {
                    Text("Read without answering. Just listen.").font(.caption).foregroundStyle(.secondary)
                    PrimaryButton(title: tr("I've listened")) { store.updateRepair(id) { $0.listened = true } }
                }
            }
        case .perspective: perspective
        case .needs:
            if mine?.need.isEmpty ?? true {
                Card {
                    Text("Say one precise need, not an accusation.").font(.headline)
                    Text("Try starting with “I'd like…” or “I need…”.").font(.caption).foregroundStyle(.secondary)
                    TextField("I'd like a short message when you're very busy.", text: $text, axis: .vertical).lineLimit(3...6).textFieldStyle(.roundedBorder)
                    if let hint = accusationHint(text) { Label(hint, systemImage: "lightbulb").font(.caption).foregroundStyle(.orange) }
                    PrimaryButton(title: tr("Share my need")) { submit { $0.need = text } }
                }
            } else { waiting("Waiting for \(partnerName) to share their need.") }
        case .solution: solution
        case .gesture:
            if let t = theirs, let m = mine {
                needs(m, t)
                if m.gesture.isEmpty {
                    Card {
                        Text("End with something tender").font(.headline)
                        Text("A loving word, a thank-you, or a small promise.").font(.caption).foregroundStyle(.secondary)
                        TextField("Thank you for listening to me…", text: $text, axis: .vertical).lineLimit(2...5).textFieldStyle(.roundedBorder)
                        PrimaryButton(title: tr("Send my gesture")) { submit { $0.gesture = text } }
                    }
                } else { waiting("Waiting for \(partnerName)'s gesture.") }
            }
        case .done: done
        }
    }

    // MARK: Steps

    @ViewBuilder var invite: some View {
        if mine == nil || mine?.response == "later" {
            Card {
                Text("❤️ \(partnerName) would like to mend something with you.").font(.headline)
                Text("They're not looking for a fight — they'd like you to understand each other. Would you like to take part?").foregroundStyle(.secondary)
                PrimaryButton(title: tr("Yes, let's talk")) { store.updateRepair(id) { $0.response = "accepted" } }
                Button("Later") { store.updateRepair(id) { $0.response = "later" }; dismiss() }.frame(maxWidth: .infinity, minHeight: 44)
                Button("Not this time", role: .destructive) { store.updateRepair(id) { $0.response = "declined" } }.frame(maxWidth: .infinity, minHeight: 44)
            }
        } else if mine?.response == "declined" {
            InfoBanner(text: tr("You chose not to take part. That's okay."), icon: "heart")
            Button("Actually, I'd like to talk") { store.updateRepair(id) { $0.response = "accepted" } }.frame(maxWidth: .infinity, minHeight: 44)
        } else if theirs?.response == "declined" {
            InfoBanner(text: tr("\(partnerName) isn't ready to do this right now. Nobody has to take part — you can try again another time."), icon: "heart")
        } else if theirs?.response == "later" {
            waiting("\(partnerName) will come back to this later.")
        } else {
            waiting("\(partnerName) has been invited. You'll continue together once they accept.")
        }
    }

    var feelingsForm: some View {
        Card {
            Label("Your private space", systemImage: "lock.fill").font(.caption.bold()).foregroundStyle(.secondary)
            Text("How do you feel?").font(.headline)
            Text("Pick what's closest to what you feel.").font(.caption).foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 10) {
                ForEach(repairEmotions) { e in
                    let on = emotions.contains(e.id)
                    Button { if on { emotions.remove(e.id) } else { emotions.insert(e.id) } } label: {
                        VStack(spacing: 4) { Text(e.emoji).font(.title); Text(e.label).font(.caption.weight(.semibold)) }
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(on ? p.soft : p.surface, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(on ? p.primary : p.color("border"), lineWidth: on ? 2 : 1))
                    }.buttonStyle(.smooth)
                }
            }
            Text("What made you feel this way?").font(.headline)
            TextField("I felt I wasn't a priority today.", text: $text, axis: .vertical).lineLimit(3...8).textFieldStyle(.roundedBorder)
            PrimaryButton(title: tr("Save my feelings")) {
                guard !emotions.isEmpty else { return }
                let chosen = repairEmotions.map(\.id).filter(emotions.contains)
                submit { $0.emotions = chosen; $0.story = text }
            }.disabled(emotions.isEmpty)
            Text("Stays private until you've both finished.").font(.caption).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder var perspective: some View {
        if let m = mine, let t = theirs {
            testimony(t, title: "What \(partnerName) shared")
            if m.reformulation.isEmpty || clarifying {
                Card {
                    Text("In your own words, what did \(partnerName) feel?").font(.headline)
                    if let note = clarifyNote(t, on: m) { Label("\(partnerName) asked: \(note)", systemImage: "questionmark.bubble").font(.caption) }
                    TextField("You needed to focus on your work and felt accused…", text: $text, axis: .vertical).lineLimit(3...6).textFieldStyle(.roundedBorder)
                    PrimaryButton(title: tr("Share my understanding")) { submit { $0.reformulation = text } }
                    Text("The goal is to check you understood, not to agree.").font(.caption).foregroundStyle(.secondary)
                }
            } else if t.approved != m.reformulation {
                Card {
                    Text("You said:").font(.caption).foregroundStyle(.secondary); Text(m.reformulation)
                    if let note = clarifyNote(t, on: m) {
                        Label("\(partnerName) would like a precision: \(note)", systemImage: "questionmark.bubble").font(.subheadline)
                        Button("Rephrase") { text = m.reformulation; clarifying = true }.frame(maxWidth: .infinity, minHeight: 44)
                    } else { Text("Waiting for \(partnerName) to read it.").font(.caption).foregroundStyle(.secondary) }
                }
            }
            if !t.reformulation.isEmpty && m.approved != t.reformulation {
                Card {
                    Text("\(partnerName) understood you like this:").font(.headline)
                    Text("“\(t.reformulation)”").italic()
                    PrimaryButton(title: tr("Yes, that's me")) { store.updateRepair(id) { $0.approved = t.reformulation; $0.clarify = "" } }
                    TextField("Not quite — what would you add?", text: $text, axis: .vertical).lineLimit(1...4).textFieldStyle(.roundedBorder)
                    Button("Ask for a precision") { let note = t.reformulation + "\u{1}" + text; store.updateRepair(id) { $0.clarify = note }; text = "" }.frame(maxWidth: .infinity, minHeight: 44).disabled(text.isEmpty)
                }
            } else if t.reformulation.isEmpty && !m.reformulation.isEmpty { waiting("Waiting for \(partnerName) to put your feelings into words.") }
        }
    }

    @ViewBuilder var solution: some View {
        if let m = mine, let t = theirs {
            needs(m, t)
            if m.proposal.isEmpty {
                Card {
                    Text("Suggest one realistic action").font(.headline)
                    TextField("I'll let you know when I'll be unreachable for a long time.", text: $text, axis: .vertical).lineLimit(2...5).textFieldStyle(.roundedBorder)
                    PrimaryButton(title: tr("Suggest it")) { submit { $0.proposal = text } }
                }
            } else if t.proposal.isEmpty { waiting("Waiting for \(partnerName)'s suggestion.") }
            else {
                let deal = store.repairDeal(m, t)
                Card {
                    Text("Our agreement").font(.headline)
                    Label(m.proposal, systemImage: "person.fill"); Label(t.proposal, systemImage: "heart.fill")
                    if m.agreed == deal { Text("You agreed. Waiting for \(partnerName).").font(.caption).foregroundStyle(.secondary) }
                    else {
                        PrimaryButton(title: tr("I agree to our solution")) { store.updateRepair(id) { $0.agreed = deal } }
                        Button("Change my suggestion") { text = m.proposal; store.updateRepair(id) { $0.proposal = ""; $0.agreed = "" } }.frame(maxWidth: .infinity, minHeight: 44)
                    }
                    Text("If nothing works for both of you, take a pause — there's no penalty.").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder var done: some View {
        if let m = mine, let t = theirs {
            Card {
                Text("\(partnerName)'s gesture").font(.caption.bold()).foregroundStyle(.secondary); Text(t.gesture)
                Divider()
                Text("Your agreement").font(.caption.bold()).foregroundStyle(.secondary)
                Label(m.proposal, systemImage: "checkmark.heart"); Label(t.proposal, systemImage: "checkmark.heart")
            }
            InfoBanner(text: tr("A repair isn't only in the words — it's in what we do next. Your agreement is saved in your solutions box."), icon: "heart.text.square")
            let due = (m.updated.addingTimeInterval(3 * 86400)) < Date() || !m.followUp.isEmpty
            Card {
                Text("Follow-up").font(.headline)
                if !m.followUp.isEmpty {
                    Text("You said: \(followLabel(m.followUp))\(m.followNote.isEmpty ? "" : " — \(m.followNote)")").font(.subheadline)
                    if !t.followUp.isEmpty { Text("\(partnerName) said: \(followLabel(t.followUp))\(t.followNote.isEmpty ? "" : " — \(t.followNote)")").font(.subheadline) }
                } else if due {
                    Text("Have your commitments been kept? Anything left to talk about?").font(.subheadline)
                    TextField("Optional note", text: $text).textFieldStyle(.roundedBorder)
                    HStack {
                        ForEach(["kept", "partly", "talk"], id: \.self) { k in Button(followLabel(k)) { let n = text; store.updateRepair(id) { $0.followUp = k; $0.followNote = n } }.buttonStyle(.bordered) }
                    }
                } else { Text("In a few days, you'll each be able to say how it's going. No scores, no percentages.").font(.caption).foregroundStyle(.secondary) }
            }
        }
    }

    // MARK: Pieces

    func paused(_ who: RepairEntry) -> some View {
        Card {
            Text(who.user == me ? "You've taken a pause." : "\(partnerName) needs a pause.").font(.headline)
            Text("The conversation will pick up when you're both ready. Take the time you need.").foregroundStyle(.secondary)
            if who.user == me { PrimaryButton(title: tr("I'm ready to continue")) { store.updateRepair(id) { $0.paused = false } } }
        }
    }
    func waiting(_ text: LocalizedStringKey) -> some View {
        Card { HStack(spacing: 12) { ProgressView(); Text(text).foregroundStyle(.secondary) } }
    }
    func testimony(_ e: RepairEntry, title: LocalizedStringKey) -> some View {
        Card {
            Text(title).font(.caption.bold()).foregroundStyle(.secondary)
            Text(e.emotions.compactMap { id in repairEmotions.first { $0.id == id }.map { "\($0.emoji) \($0.label)" } }.joined(separator: "  ")).font(.subheadline.weight(.semibold))
            Text(e.story)
        }
    }
    func needs(_ m: RepairEntry, _ t: RepairEntry) -> some View {
        Card {
            Text("What you each need").font(.caption.bold()).foregroundStyle(.secondary)
            Label(m.need, systemImage: "person.fill"); Label(t.need, systemImage: "heart.fill")
        }
    }
    func submit(_ change: @escaping (inout RepairEntry) -> Void) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        store.updateRepair(id, change); text = ""; clarifying = false
    }
    /// A precision request only counts for the wording it was asked about.
    func clarifyNote(_ t: RepairEntry, on m: RepairEntry) -> String? {
        let parts = t.clarify.components(separatedBy: "\u{1}")
        return parts.count == 2 && parts[0] == m.reformulation && !m.reformulation.isEmpty ? parts[1] : nil
    }
    func followLabel(_ k: String) -> String { ["kept": tr("Kept 💚"), "partly": tr("Partly"), "talk": tr("Let's talk again")][k] ?? k }
    func accusationHint(_ s: String) -> String? {
        let l = s.lowercased()
        let flags = ["you never", "you always", "your fault", "tu ne ", "tu n'", "toujours", "jamais", "c'est ta faute"]
        return flags.contains(where: l.contains) ? tr("That sounds a bit like a reproach. Try turning it into a concrete request: “I'd like…”") : nil
    }
}

// MARK: Heart

/// Two halves of a heart that slide together as the repair progresses.
struct RepairHeart: View {
    var progress: Double; var size: CGFloat
    var body: some View {
        let gap = (1 - min(1, progress)) * size * 0.28
        ZStack {
            half(left: true).offset(x: -gap, y: gap * 0.3).rotationEffect(.degrees(-(1 - progress) * 12))
            half(left: false).offset(x: gap, y: gap * 0.3).rotationEffect(.degrees((1 - progress) * 12))
        }
        .frame(width: size * 1.5, height: size)
        .animation(.spring(duration: 0.8, bounce: 0.3), value: progress)
    }
    func half(left: Bool) -> some View {
        Image(systemName: "heart.fill").resizable().scaledToFit().frame(width: size, height: size)
            .foregroundStyle(LinearGradient(colors: [Color(hex: "#FF8FA3"), Color(hex: "#D6336C")], startPoint: .top, endPoint: .bottom))
            .mask(HStack(spacing: 0) { Rectangle().opacity(left ? 1 : 0); Rectangle().opacity(left ? 0 : 1) })
    }
}

// MARK: Safety

struct RepairSafetyView: View {
    @Environment(\.dismiss) var dismiss
    var body: some View {
        NavigationStack {
            Page {
                Text("An ordinary disagreement is not the same as manipulation, threats or violence.").font(.headline)
                Text("Mend the Heart will never push you to forgive, apologise, make up, or stay in a relationship that isn't safe. If you feel afraid, controlled or hurt, please reach out to someone you trust or a professional.")
                Card {
                    Label("Emergency: 112 (Europe) · 911 (US)", systemImage: "phone.fill")
                    Label("France — Violences Femmes Info: 3919 (free, 24/7)", systemImage: "phone")
                    Label("US — National DV Hotline: 1-800-799-7233", systemImage: "phone")
                }
                Text("Your repairs are private to the two of you and can be deleted at any time from the ⋯ menu.").font(.caption).foregroundStyle(.secondary)
            }
            .navigationTitle("Your safety").navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}
