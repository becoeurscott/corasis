import SwiftUI
import PhotosUI
import LocalAuthentication
import UserNotifications

struct ProfileView: View {
    @EnvironmentObject var store: Store
    var body: some View { Page {
        NavigationLink { ProfileEditor() } label: { Card { HStack(spacing: 16) { Avatar(person: store.me); VStack(alignment: .leading, spacing: 5) { Text(store.me?.name ?? "You").font(.title2.bold()); Text(store.me?.timezone.replacingOccurrences(of: "_", with: " ") ?? "").font(.caption).foregroundStyle(.secondary); Text(store.db.demo ? tr("Demo account · local") : store.me?.email ?? "").font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "chevron.right").font(.caption) } } }.buttonStyle(.smooth)
        if store.db.demo { InfoBanner(text: tr("Demo mode: everything is stored on this device and Alex is simulated.")) }
        SectionHeading(title: tr("Couple"))
        Card { RowLink(title: store.partner.map { "\(store.me?.name ?? "You") & \($0.name)" } ?? "Your relationship", icon: "heart", detail: store.couple?.start.map { "\(Day.distance($0, store.today)) days together" } ?? "Add your relationship details") { CoupleSettings() }; Divider(); RowLink(title: "Partner connection", icon: "link", detail: "Invitations and unlinking") { PartnerSettings() }; Divider(); RowLink(title: "Next meeting & calendar", icon: "calendar") { CalendarView() }; Divider(); RowLink(title: "Widgets & wallpaper", icon: "iphone") { WidgetsView() } }
        SectionHeading(title: "Appearance")
        Card { RowLink(title: "Theme & appearance", icon: "paintpalette", detail: LocalizedStringKey(Product.shared.palettes[store.db.prefs.theme]?.label ?? tr("Pink"))) { ThemeSettings() }; Divider(); RowLink(title: "Language", icon: "globe", detail: store.db.prefs.language == "auto" ? "Automatic" : store.db.prefs.language == "fr" ? "Français" : "English") { LanguageSettings() } }
        SectionHeading(title: tr("Preferences"))
        Card { RowLink(title: "Your connection preferences", icon: "heart", detail: "What feels right for you · private") { ConnectionSettingsView() }; Divider(); RowLink(title: "Time zone & couple day", icon: "clock") { TimezoneSettings() }; Divider(); RowLink(title: "Notifications", icon: "bell") { NotificationSettings() }; Divider(); RowLink(title: "Location & battery sharing", icon: "location") { SharingSettings() }; Divider(); RowLink(title: "App lock", icon: "lock", detail: store.db.prefs.lock ? "On" : "Off") { LockSettings() }; Divider(); RowLink(title: "Together Plus", icon: "sparkles", detail: store.db.prefs.premium ? "Active" : "Off") { PlusSettings() } }
        SectionHeading(title: tr("Support & privacy"))
        Card { RowLink(title: "Help & FAQ", icon: "questionmark.circle") { HelpView() }; Divider(); RowLink(title: "Privacy & terms", icon: "hand.raised") { PrivacyView() }; Divider(); RowLink(title: "Your data", icon: "square.and.arrow.down", detail: "Export, unlink, delete account") { DataSettings() } }
        Button("Sign out") { store.signOut() }.frame(maxWidth: .infinity).padding(.vertical, 8)
        Text("Corasis · v1.0").font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity)
    }.navigationTitle("Profile") }
}
struct ProfileEditor: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var pronouns = ""
    @State private var zone = TimeZone.current.identifier
    @State private var media: Media?
    var body: some View { Form { Section { TextField("First name", text: $name); TextField("Pronouns (optional)", text: $pronouns); TimezonePicker(title: tr("Your time zone"), selection: $zone) }; Section("Profile photo") { MediaChooser(media: $media, photosOnly: true) }; Button("Save profile") { store.perform { try store.updateProfile(name: name, pronouns: pronouns, timezone: zone, avatar: media?.path); dismiss() } } }.navigationTitle("Your profile").onAppear { name = store.me?.name ?? ""; pronouns = store.me?.pronouns ?? ""; zone = store.me?.timezone ?? TimeZone.current.identifier; media = store.me?.avatar.map { Media(path: $0, kind: "photo") } } }
}
struct CoupleSettings: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var stage = "dating"
    @State private var start = Date()
    @State private var hasStart = false
    @State private var distance = "long_distance"
    @State private var goals: Set<String> = []
    var body: some View { Form { if store.couple == nil { Section { Text("Connect a partner to save shared relationship details."); NavigationLink("Partner connection") { PartnerSettings() } } } else {
        Section("Your relationship") { Picker("Stage", selection: $stage) { ForEach(["dating", "committed", "engaged", "married", "other"], id: \.self) { Text($0.capitalized).tag($0) } }; Toggle("Add start date", isOn: $hasStart); if hasStart { DatePicker("Together since", selection: $start, in: ...Date(), displayedComponents: .date) }; Picker("Living situation", selection: $distance) { Text("Long distance").tag("long_distance"); Text("Nearby").tag("nearby") } }
        Section("More of") { ForEach(["Deeper conversations", "Daily connection", "Playful moments", "Planning visits"], id: \.self) { goal in Toggle(LocalizedStringKey(goal), isOn: Binding(get: { goals.contains(goal) }, set: { if $0 { goals.insert(goal) } else { goals.remove(goal) } })) } }
        Button("Save details") { if var c = store.couple { c.stage = stage; c.start = hasStart ? Day.key(start, zone: c.timezone) : nil; c.distance = distance; c.goals = Array(goals); store.saveCouple(c); dismiss() } }
    } }.navigationTitle("Couple details").onAppear { if let c = store.couple { stage = c.stage; hasStart = c.start != nil; start = c.start.map { Day.date($0, zone: c.timezone) } ?? Date(); distance = c.distance; goals = Set(c.goals) } } }
}
struct PartnerSettings: View {
    @EnvironmentObject var store: Store
    @State private var code = ""
    @State private var unlink = false
    @State private var busy = false
    func run(_ action: @escaping () async throws -> Void) { busy = true; Task { await store.performAsync(action); busy = false } }
    var invitation: Invite? { store.db.invites.last { $0.owner == store.db.currentUser && $0.status == "pending" && $0.expires > Date() } }
    var body: some View { Page {
        if !store.usesRemoteCouple { InfoBanner(text: tr("Local preview: invitations only work between accounts on this device.")) }
        if let partner = store.partner { Card { HStack { Avatar(person: partner); VStack(alignment: .leading) { Text(partner.name).font(.title2.bold()); Text(partner.simulated ? "Simulated demo partner" : "Connected local account").font(.caption).foregroundStyle(.secondary) } }; Button("Unlink partner", role: .destructive) { unlink = true } } }
        else { Card { Text("Invite your partner").font(.title2.bold()); if let invitation { Text(invitation.code).font(.system(.largeTitle, design: .monospaced).bold()).textSelection(.enabled); Text("Expires \(invitation.expires.formatted())").font(.caption).foregroundStyle(.secondary); ShareLink(item: URL(string: "together-swift://invite/\(invitation.code)")!); Button("Revoke invitation", role: .destructive) { if let i = store.db.invites.firstIndex(where: { $0.id == invitation.id }) { store.db.invites[i].status = "revoked" } } } else { PrimaryButton(title: busy ? "Please wait…" : "Create invitation") { if store.usesRemoteCouple { run { try await store.createInviteRemote() } } else { store.perform { _ = try store.createInvite() } } }.disabled(busy) } }
            Card { Text("Have an invitation?").font(.headline); TextField("Partner code", text: $code).textInputAutocapitalization(.characters).autocorrectionDisabled().textFieldStyle(.soft); PrimaryButton(title: busy ? "Please wait…" : "Connect partner") { if store.usesRemoteCouple { run { try await store.acceptInviteRemote(code) } } else { store.perform { try store.acceptInvite(code) } } }.disabled(busy || code.trimmingCharacters(in: .whitespaces).isEmpty) }
            Button("Explore a separate demo with Alex") { store.demo(name: store.me?.name ?? "Sam") }.frame(maxWidth: .infinity)
        }
    }.navigationTitle("Partner connection").navigationBarTitleDisplayMode(.inline).onAppear { code = store.pendingInvite }
        // While our code is out, check every few seconds whether the partner has used it.
        .task(id: invitation?.code) {
            guard invitation != nil, store.usesRemoteCouple else { return }
            while !Task.isCancelled, store.couple == nil {
                if await store.syncCouple() { break }
                try? await Task.sleep(for: .seconds(5))
            }
        }.confirmationDialog("Unlink your partner? Shared content will no longer appear in either account. Export your data first if you want a copy.", isPresented: $unlink, titleVisibility: .visible) { Button("Unlink partner", role: .destructive) { store.unlink() } } }
}
struct ThemeSettings: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    var body: some View { Page { ForEach(["pink", "purple", "red", "blue"], id: \.self) { key in let theme = Product.shared.palettes[key]!
        Button { store.db.prefs.theme = key } label: { Card { HStack(spacing: 18) { Circle().fill(Color(hex: theme.light["primary"]!)).frame(width: 46, height: 46); VStack(alignment: .leading, spacing: 4) { Text(theme.label).font(.headline); Text(theme.tagline).font(.subheadline).foregroundStyle(.secondary) }; Spacer(); if store.db.prefs.theme == key { Image(systemName: "checkmark.circle.fill").foregroundStyle(p.primary) } } } }.buttonStyle(.smooth)
    }; Card { Picker("Appearance", selection: $store.db.prefs.appearance) { Text("System").tag("system"); Text("Light").tag("light"); Text("Dark").tag("dark") }.pickerStyle(.segmented) } }.navigationTitle("Theme & appearance").navigationBarTitleDisplayMode(.inline) }
}
struct LanguageSettings: View {
    @EnvironmentObject var store: Store
    var body: some View { Form { Picker("Language", selection: $store.db.prefs.language) { Text("Automatic · follows your phone (\(AppLanguage.device == "fr" ? "Français" : "English"))").tag("auto"); Text("English").tag("en"); Text("Français").tag("fr") }.pickerStyle(.inline); Section { Text("Changes the whole app, including questions and games. Things you and your partner wrote stay as written.").font(.footnote).foregroundStyle(.secondary) } }.navigationTitle("Language") }
}
struct TimezonePicker: View {
    var title: String
    @Binding var selection: String
    var body: some View { NavigationLink { TimezoneList(title: title, selection: $selection) } label: { LabeledContent(title, value: selection.replacingOccurrences(of: "_", with: " ")) } }
}
struct TimezoneList: View {
    @Environment(\.dismiss) var dismiss
    var title: String
    @Binding var selection: String
    @State private var search = ""
    var body: some View { List(TimeZone.knownTimeZoneIdentifiers.filter { search.isEmpty || $0.localizedCaseInsensitiveContains(search.replacingOccurrences(of: " ", with: "_")) }, id: \.self) { zone in Button { selection = zone; dismiss() } label: { HStack { Text(zone.replacingOccurrences(of: "_", with: " ")); Spacer(); if zone == selection { Image(systemName: "checkmark") } } } }.searchable(text: $search).navigationTitle(title).navigationBarTitleDisplayMode(.inline) }
}
struct TimezoneSettings: View {
    @EnvironmentObject var store: Store
    var body: some View { Form { Section("Your clock") { TimezonePicker(title: tr("Your time zone"), selection: Binding(get: { store.me?.timezone ?? TimeZone.current.identifier }, set: { zone in store.perform { try store.updateProfile(name: store.me?.name ?? "", pronouns: store.me?.pronouns ?? "", timezone: zone) } })) }; if store.couple != nil { Section("Shared day boundary") { TimezonePicker(title: tr("Couple time zone"), selection: Binding(get: { store.couple?.timezone ?? "UTC" }, set: { zone in if var c = store.couple { c.timezone = zone; store.saveCouple(c) } })); Text("The daily question and flame use this time zone. Changing it can change which day new moments belong to; existing moments retain their original day.").font(.footnote).foregroundStyle(.secondary) } }; Picker("Distance units", selection: $store.db.prefs.unit) { Text("Kilometers").tag("km"); Text("Miles").tag("mi") } }.navigationTitle("Time & couple day").navigationBarTitleDisplayMode(.inline) }
}
struct NotificationSettings: View {
    @EnvironmentObject var store: Store
    @State private var reminder = Date()
    @State private var quietStart = Date()
    @State private var quietEnd = Date()
    var body: some View { Form {
        Section { Toggle("Enable notifications", isOn: $store.db.prefs.notifications); Toggle("Daily reminder", isOn: $store.db.prefs.dailyReminder); DatePicker("Reminder time", selection: $reminder, displayedComponents: .hourAndMinute) }
        Section("Categories") { Toggle("Partner moments", isOn: $store.db.prefs.momentAlerts); Toggle("Messages", isOn: $store.db.prefs.messageAlerts); Toggle("Activities", isOn: $store.db.prefs.activityAlerts); Toggle("Meetings", isOn: $store.db.prefs.meetingAlerts); Text("Partner alerts need a server and push notifications. Daily and calendar reminders are local notifications.").font(.caption).foregroundStyle(.secondary) }
        Section("Quiet hours") { DatePicker("From", selection: $quietStart, displayedComponents: .hourAndMinute); DatePicker("Until", selection: $quietEnd, displayedComponents: .hourAndMinute); Toggle("Sound", isOn: $store.db.prefs.sound); Toggle("Haptics", isOn: $store.db.prefs.haptics) }
        Button("Save & request notification permission") { store.db.prefs.reminderTime = clock(reminder); store.db.prefs.quietStart = clock(quietStart); store.db.prefs.quietEnd = clock(quietEnd); Task { do { try await Reminders.update(prefs: store.db.prefs); for event in store.events { try await Reminders.schedule(event: event, zone: store.couple?.timezone ?? "UTC", prefs: store.db.prefs) } } catch { store.error = error.localizedDescription } } }
    }.navigationTitle("Notifications").onAppear { reminder = date(store.db.prefs.reminderTime); quietStart = date(store.db.prefs.quietStart); quietEnd = date(store.db.prefs.quietEnd) } }
    func clock(_ date: Date) -> String { let f = DateFormatter(); f.dateFormat = "HH:mm"; return f.string(from: date) }
    func date(_ clock: String) -> Date { let f = DateFormatter(); f.dateFormat = "HH:mm"; return f.date(from: clock) ?? Date() }
}
struct SharingSettings: View {
    @EnvironmentObject var store: Store
    @StateObject private var location = LocationService()
    var body: some View { Form { Section { Toggle("Share my location", isOn: Binding(get: { store.db.sharing[store.db.currentUser ?? ""]?.location ?? false }, set: { store.setSharing(location: $0); if $0 { location.request(store: store) } })); Toggle("Share my battery", isOn: Binding(get: { store.db.sharing[store.db.currentUser ?? ""]?.battery ?? false }, set: { store.setSharing(battery: $0); UIDevice.current.isBatteryMonitoringEnabled = $0 })) }; Section { Text("Location is requested only while the app is open and sharing is enabled. Turning it off clears your saved coordinates immediately. No location history is recorded. Battery is unavailable in the simulator. Cross-phone sharing requires a backend.").font(.footnote).foregroundStyle(.secondary) } }.navigationTitle("Sharing") }
}
struct LockSettings: View {
    @EnvironmentObject var store: Store
    @State private var pin = ""
    @State private var confirm = ""
    @State private var current = ""
    var body: some View { Form {
        Section { Text(store.db.prefs.lock ? "App lock is enabled" : "Protect your shared space").font(.headline); Text("Re-entry can use Face ID, Touch ID, device authentication, or your app PIN. The PIN is stored in the iOS Keychain. App lock does not encrypt your exported files.").font(.footnote).foregroundStyle(.secondary) }
        if store.db.prefs.lock { Section { SecureField("Current app PIN", text: $current).keyboardType(.numberPad); Button("Disable app lock", role: .destructive) { if current == Secure.get("pin") { store.db.prefs.lock = false; Secure.delete("pin") } else { store.error = tr("Incorrect PIN.") } } } }
        else { Section("Set a PIN") { SecureField("PIN (4–8 digits)", text: $pin).keyboardType(.numberPad); SecureField("Confirm PIN", text: $confirm).keyboardType(.numberPad); Button("Enable app lock") { Task { guard await PermissionGate.shared.ask(.faceID) else { return }; store.perform { guard pin.count >= 4 && pin.count <= 8, pin.allSatisfy(\.isNumber), pin == confirm else { throw AppError(message: "Use 4–8 digits and enter the same PIN twice.") }; try Secure.put(pin, key: "pin"); store.db.prefs.lock = true; pin = ""; confirm = "" } } } } }
    }.navigationTitle("App lock") }
}
struct PlusSettings: View {
    var body: some View { PaywallView() }
}
struct HelpView: View {
    let faq: [(String,String)] = [
        (tr("How does the flame work?"), tr("Each of you sends a photo or video in the same couple day. A day counts once. Missing a day restarts the current streak; the longest streak remains.")),
        (tr("When are answers revealed?"), tr("Only after both partners submit or skip. Submitted answers are locked. Unrevealed partner answers are excluded from the interface and data export.")),
        (tr("Can I connect a real partner?"), tr("You can test two local accounts on one device. A remote backend is not configured, so invitations do not connect separate phones.")),
        (tr("Is my location tracked?"), tr("Only a current position is saved when you opt in while the app is open. Turning sharing off clears it. No history is recorded.")),
        (tr("What happens if we unlink?"), tr("Both accounts lose access to the shared content in the interface. Export first if you want a copy. Your individual account remains.")),
        (tr("Is this therapy?"), tr("No. Conversation starters, quizzes, and streaks are for connection and play, not professional advice or relationship assessment."))]
    var body: some View { Page { ForEach(faq, id: \.0) { q, answer in Card { DisclosureGroup(q) { Text(answer).font(.body).foregroundStyle(.secondary).padding(.top, 8) } } }; Link("Email support", destination: URL(string: "mailto:support@together.app?subject=Together%20app")!) }.navigationTitle("Help & FAQ") }
}
struct PrivacyView: View {
    var body: some View { Page {
        Card { Text("Your private space").font(.title2.bold()); Text("This preview stores profiles, messages, media, answers, and calendar events on this device. There is no server, cross-device sync, or end-to-end encryption. A simulated partner is clearly labeled.") }
        Card { Text("Permissions").font(.headline); Text("The photo picker grants access only to the items you select. Camera and microphone are requested when you capture or record. Location is opt-in and only requested in the foreground. Turning location sharing off clears saved coordinates.") }
        Card { Text("Media & data").font(.headline); Text("Imported photos, videos, and voice notes are copied into the app’s private storage. Exports contain your profile and accessible couple content, excluding passwords and hidden answers. Deleting a daily moment’s album entry also removes its flame credit.") }
        Card { Text("Your choices").font(.headline); Text("Export your data, unlink, or delete your local account in Your data. Reset local preview removes all local accounts and media. You cannot delete your partner’s account. App lock protects re-entry; keep exported files private.") }
        Card { Text("Terms").font(.headline); Text("Be kind. Share only content you have the right to share. Activities and streaks are games, not measures of your relationship. This preview has no paid subscription or remote delivery guarantees.") }
    }.navigationTitle("Privacy & terms").navigationBarTitleDisplayMode(.inline) }
}
struct DataSettings: View {
    @EnvironmentObject var store: Store
    @State private var export: URL?
    @State private var action = ""
    @State private var confirm = false
    var body: some View { Form {
        Section("Your copy") { Button("Prepare data export") { store.perform { export = try store.exportData() } }; if let export { ShareLink(item: export) { Label("Share JSON export", systemImage: "square.and.arrow.up") } }; Text("Includes accessible text and media references. Media files can be shared individually from a memory. Hidden partner answers and credentials are excluded.").font(.caption).foregroundStyle(.secondary) }
        Section("Account") { Button("Sign out") { store.signOut() }; Button("Unlink partner", role: .destructive) { ask("Unlink partner") }; Button("Delete my local account", role: .destructive) { ask(tr("Delete account")) } }
        Section("This device") { Button("Reset local preview", role: .destructive) { ask(tr("Reset all")) }; Text("Reset removes all accounts, saved content, and imported media in the SwiftUI app. React Native data is separate.").font(.caption).foregroundStyle(.secondary) }
    }.navigationTitle("Your data").confirmationDialog(action + tr("? This cannot be undone. Export first if you want a copy."), isPresented: $confirm, titleVisibility: .visible) { Button(action, role: .destructive) { if action == "Reset all" { store.resetAll(); try? FileManager.default.removeItem(at: MediaFiles.directory) } else if action == "Unlink partner" { store.unlink() } else { store.deleteAccount() } } } }
    func ask(_ title: String) { action = title; confirm = true }
}
