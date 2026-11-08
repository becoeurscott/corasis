import SwiftUI
import LocalAuthentication

@main struct TogetherApp: App {
    @StateObject private var store = Store()
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store)
                .preferredColorScheme(store.db.prefs.appearance == "system" ? nil : store.db.prefs.appearance == "dark" ? .dark : .light)
                .onAppear { appDelegate.store = store }
                // Foreground: look for new affection every few seconds while connected.
                .task(id: "\(store.couple?.id ?? "")-\(phase == .active)") {
                    guard store.couple != nil, phase == .active else { return }
                    await AppDelegate.requestPush()
                    while !Task.isCancelled { await store.checkAffection(); try? await Task.sleep(for: .seconds(4)) }
                }
                .onChange(of: phase) { _, value in
                    if value == .background && store.db.prefs.lock && store.me != nil { store.locked = true }
                }
                .onOpenURL { url in if url.host == "invite" { store.pendingInvite = url.lastPathComponent } }
        }
    }
}
struct RootView: View {
    @EnvironmentObject var store: Store
    /// DEBUG only: launch with `-babyGame` to open the baby game straight away with the demo partner.
    #if DEBUG
    @State private var debugBabyGame = ProcessInfo.processInfo.arguments.contains("-babyGame")
    #else
    private let debugBabyGame = false
    #endif
    @Environment(\.colorScheme) var scheme
    var body: some View {
        ZStack {
            if store.me == nil { OnboardingView() }
            else if !store.verified { VerificationView() }
            else if store.couple == nil && !store.db.demo && store.db.partnerStepDone != true { PartnerStepView() }
            else if debugBabyGame { NavigationStack { LifeGameView() } }
            else { MainTabs() }
            AffectionRain()
            if store.locked { LockView() }
        }
        .onAppear { if debugBabyGame && (store.me == nil || store.couple == nil) { store.demo() } }
        .scrollDismissesKeyboard(.interactively)
        .tint(palette.primary)
        .environment(\.appPalette, palette)
        .sheet(isPresented: Binding(get: { !store.pendingInvite.isEmpty && store.me != nil && store.verified }, set: { if !$0 { store.pendingInvite = "" } })) {
            NavigationStack { PartnerSettings().toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { store.pendingInvite = "" } } } }.environmentObject(store).environment(\.appPalette, palette)
        }
        .alert("Corasis", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) { Button("OK") { store.error = nil } } message: { Text(store.error ?? "") }
    }
    var palette: AppPalette { AppPalette(theme: store.db.prefs.theme, dark: scheme == .dark) }
}
struct AppPalette: Equatable {
    var values: [String:String]
    init(theme: String = "pink", dark: Bool = false) { let p = Product.shared.palettes[theme] ?? Product.shared.palettes["pink"]!; values = dark ? p.dark : p.light }
    func color(_ name: String) -> Color { Color(hex: values[name] ?? "#E0507F") }
    var primary: Color { color("primary") }; var soft: Color { color("primarySoft") }; var background: Color { color("background") }; var surface: Color { color("surface") }; var text: Color { color("text") }; var secondary: Color { color("textSecondary") }
    var gradient: LinearGradient { LinearGradient(colors: [color("gradientStart"), color("gradientEnd")], startPoint: .topLeading, endPoint: .bottomTrailing) }
}
private struct PaletteKey: EnvironmentKey { static let defaultValue = AppPalette() }
extension EnvironmentValues { var appPalette: AppPalette { get { self[PaletteKey.self] } set { self[PaletteKey.self] = newValue } } }
struct Page<Content: View>: View {
    @Environment(\.appPalette) var p
    @ViewBuilder var content: Content
    var body: some View { ScrollView { VStack(alignment: .leading, spacing: 20) { content }.padding(20).frame(maxWidth: 680).frame(maxWidth: .infinity) }.background(p.background).foregroundStyle(p.text) }
}
struct Card<Content: View>: View {
    @Environment(\.appPalette) var p
    @ViewBuilder var content: Content
    var body: some View { VStack(alignment: .leading, spacing: 14) { content }.frame(maxWidth: .infinity, alignment: .leading).padding(20).background(p.surface, in: RoundedRectangle(cornerRadius: 24)).overlay(RoundedRectangle(cornerRadius: 24).stroke(p.color("border").opacity(0.55), lineWidth: 1)) }
}
struct PrimaryButton: View {
    @Environment(\.appPalette) var p
    var title: String; var action: () -> Void
    var body: some View { Button(action: action) { Text(title).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 16).foregroundStyle(p.color("onPrimary")).background(p.primary, in: Capsule()) }.buttonStyle(.smooth) }
}
struct InfoBanner: View {
    @Environment(\.appPalette) var p
    var text: String; var icon = "info.circle"
    var body: some View { Label(text, systemImage: icon).font(.subheadline).foregroundStyle(p.secondary).padding(16).frame(maxWidth: .infinity, alignment: .leading).background(p.soft, in: RoundedRectangle(cornerRadius: 20)) }
}
struct SectionHeading: View { var title: String; var body: some View { Text(title).font(.title3.bold()).padding(.top, 4) } }
struct Avatar: View {
    @Environment(\.appPalette) var p
    var person: Person?; var size: CGFloat = 62
    var body: some View { Group { if let preset = PresetAvatar.emoji(person?.avatar) ?? PresetAvatar.emoji(person?.avatarURL) { Text(preset).font(.system(size: size * 0.55)).frame(maxWidth: .infinity, maxHeight: .infinity).background(p.soft) } else if let path = person?.avatar, let image = UIImage(contentsOfFile: MediaFiles.url(path).path) { Image(uiImage: image).resizable().scaledToFill() } else if let remote = person?.avatarURL.flatMap(URL.init(string:)) { AsyncImage(url: remote) { image in image.resizable().scaledToFill() } placeholder: { p.soft } } else { Text(String((person?.name ?? "?").prefix(1))).font(.system(size: size * 0.4, weight: .bold)).foregroundStyle(p.primary).frame(maxWidth: .infinity, maxHeight: .infinity).background(p.soft) } }.frame(width: size, height: size).clipShape(Circle()).accessibilityLabel(person?.name ?? "Partner") }
}
struct RowLink<Destination: View>: View {
    var title: String; var icon: String; var detail = ""; @ViewBuilder var destination: Destination
    var body: some View { NavigationLink { destination } label: { HStack(spacing: 14) { Image(systemName: icon).frame(width: 24).foregroundStyle(.tint); VStack(alignment: .leading, spacing: 3) { Text(title).font(.body.weight(.semibold)); if !detail.isEmpty { Text(detail).font(.caption).foregroundStyle(.secondary) } }; Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary) }.padding(.vertical, 8).contentShape(Rectangle()) }.buttonStyle(.smooth) }
}
struct MainTabs: View {
    @EnvironmentObject var store: Store
    @State private var selectedTab = 0
    var fr: Bool { AppLanguage.resolve(store.db.prefs.language) == "fr" }
    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack { HomeView() }.tabItem { Label(fr ? "Accueil" : "Home", systemImage: "house.fill") } .tag(0)
            NavigationStack { CoupleMapView() }.tabItem { Label(fr ? "Carte" : "Map", systemImage: "map") } .tag(1)
            NavigationStack { ActivitiesView() }.tabItem { Label(fr ? "Ensemble" : "Together", systemImage: "heart") } .tag(2)
            NavigationStack { MemoriesView() }.tabItem { Label(fr ? "Souvenirs" : "Memories", systemImage: "photo.on.rectangle") } .tag(3)
            NavigationStack { ProfileView() }.tabItem { Label(fr ? "Profil" : "Profile", systemImage: "person.crop.circle") } .tag(4)
        }
    }
}
struct LockView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var pin = ""
    var body: some View { VStack(spacing: 24) { Image(systemName: "lock.heart.fill").font(.system(size: 64)).foregroundStyle(p.primary); Text("Your little space").font(.largeTitle.bold()); Text("Unlock Together to continue").foregroundStyle(.secondary); SecureField("App PIN", text: $pin).keyboardType(.numberPad).textFieldStyle(.soft).frame(maxWidth: 260); PrimaryButton(title: "Unlock with PIN") { if !pin.isEmpty && pin == Secure.get("pin") { store.locked = false; pin = "" } else { store.error = "Incorrect PIN." } }.frame(maxWidth: 280); Button("Use Face ID / Touch ID") { Task { let context = LAContext(); do { if try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock your private Together space") { store.locked = false } } catch { store.error = error.localizedDescription } } } }.frame(maxWidth: .infinity, maxHeight: .infinity).background(p.background).task { let context = LAContext(); if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) { if (try? await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock Together")) == true { store.locked = false } } } }
}

/// Text field look shared with the RN `Input` (src/components/ui/Input.tsx): surface fill, 16pt corners, 56pt tall.
struct SoftFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View { SoftFieldBox { configuration } }
}
private struct SoftFieldBox<Content: View>: View {
    @Environment(\.appPalette) var p
    @ViewBuilder var content: Content
    var body: some View {
        content.font(.system(size: 17)).tint(p.primary)
            .padding(.horizontal, 16).padding(.vertical, 16).frame(minHeight: 56)
            .background(p.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(p.color("border"), lineWidth: 1.5))
    }
}
extension TextFieldStyle where Self == SoftFieldStyle { static var soft: SoftFieldStyle { SoftFieldStyle() } }

/// Built-in avatars a user can pick instead of a photo; stored as `avatar:<emoji>`. Same list as PRESET_AVATARS in src/components/ui/Avatar.tsx.
enum PresetAvatar {
    static let all = ["🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐰", "🐱", "🐶", "🐧", "🦋", "🌸"]
    static func emoji(_ value: String?) -> String? { guard let value, value.hasPrefix("avatar:") else { return nil }; return String(value.dropFirst(7)) }
}
