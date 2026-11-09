import SwiftUI
import CoreLocation
import UIKit
import UserNotifications

/// Affection: one tap sends an emoji; it floats up your partner's screen (or arrives as a push when the app is closed).
enum Affection {
    static let emojis = ["❤️", "😘", "🥰", "🤗", "🌹", "✨"]
}

struct AffectionBurst: Identifiable, Equatable { let id = UUID(); let emoji: String }

// MARK: Store

extension Store {
    /// Sends an emoji to the partner: plays the burst here too, then saves it and pushes it.
    func sendAffection(_ emoji: String) {
        guard let couple, let me else { return }
        showAffection(emoji)
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        if db.demo || !usesRemoteCouple {
            // The simulated partner answers with the same emoji a moment later.
            if partner?.simulated == true { Task { try? await Task.sleep(for: .seconds(3)); self.showAffection(emoji) } }
            _ = (couple, me); return
        }
        Task {
            do {
                let id = try await InsForge.shared.sendAffection(emoji: emoji)
                await InsForge.shared.pushAffection(id: id)
            } catch { self.error = error.localizedDescription }
        }
    }
    func showAffection(_ emoji: String) { affectionBursts.append(AffectionBurst(emoji: emoji)) }
    /// Shows emojis the partner sent since we last looked (foreground polling and after opening a notification).
    func checkAffection() async {
        guard usesRemoteCouple else { return }
        let key = "affection-seen-\(db.currentUser ?? "")"
        let since = UserDefaults.standard.string(forKey: key) ?? ISO8601DateFormatter().string(from: Date())
        guard let items = try? await InsForge.shared.receivedAffections(since: since), !items.isEmpty else {
            if UserDefaults.standard.string(forKey: key) == nil { UserDefaults.standard.set(since, forKey: key) }
            return
        }
        for item in items.suffix(3) { showAffection(item.emoji) }
        if let last = items.last?.created_at { UserDefaults.standard.set(last, forKey: key) }
    }
    func registerPushToken(_ token: String) {
        guard usesRemoteCouple || isRemoteAccount else { return }
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        Task { try? await InsForge.shared.savePushToken(token, environment: environment) }
    }
}

// MARK: Live status sync

extension Store {
    /// Sends my shared location/battery and pulls my partner's (both opt-in).
    func syncLive() async {
        guard usesRemoteCouple, let me, let partner else { return }
        let mine = db.sharing[me.id] ?? Sharing()
        var battery: Int?
        if mine.battery { UIDevice.current.isBatteryMonitoringEnabled = true; let level = UIDevice.current.batteryLevel; if level >= 0 { battery = Int((level * 100).rounded()) } }
        let loc = mine.location ? (CountryLocator.cachedLocation ?? mine.latitude.flatMap { la in mine.longitude.map { CLLocation(latitude: la, longitude: $0) } }) : nil
        let code = mine.location ? (CountryLocator.cached ?? mine.countryCode) : nil
        try? await InsForge.shared.updateLive(shareLocation: mine.location, shareBattery: mine.battery, lat: loc?.coordinate.latitude, lon: loc?.coordinate.longitude,
                                              country: code.flatMap { Locale.current.localizedString(forRegionCode: $0) }, countryCode: code, battery: battery)
        guard let theirs = try? await InsForge.shared.partnerLive(), theirs.user_id == partner.id else { return }
        var s = db.sharing[partner.id] ?? Sharing()
        s.location = theirs.share_location; s.battery = theirs.share_battery
        s.latitude = theirs.lat; s.longitude = theirs.lon; s.country = theirs.country; s.countryCode = theirs.country_code
        s.batteryPercent = theirs.battery; s.updated = theirs.location_at.flatMap { ISO8601DateFormatter.flexible.date(from: $0) }
        db.sharing[partner.id] = s
        checkProximity()
    }
}

// MARK: Push registration

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    weak var store: Store?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        _ = PlaceMonitor.shared   // ready for region events when iOS wakes the app
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: "apns-token")
        Task { @MainActor in self.store?.registerPushToken(token) }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {}
    /// App open: show the floating emojis instead of a banner.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        if let emoji = (notification.request.content.userInfo["affection"] as? [String: Any])?["emoji"] as? String {
            await MainActor.run { self.store?.showAffection(emoji) }
            return []
        }
        return [.banner, .sound]
    }
    /// Tapped the notification: open the app and play the burst.
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        if let emoji = (response.notification.request.content.userInfo["affection"] as? [String: Any])?["emoji"] as? String {
            await MainActor.run { self.store?.showAffection(emoji) }
        }
    }
    /// Asks once (after the partner is connected) and registers with Apple.
    @MainActor static func requestPush() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined, await PermissionGate.shared.ask(.notifications) { _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge]) }
        let after = await center.notificationSettings()
        if after.authorizationStatus == .authorized || after.authorizationStatus == .provisional { UIApplication.shared.registerForRemoteNotifications() }
    }
}

// MARK: Views

/// Row of emojis under the partner header on Home.
struct AffectionBar: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) private var p
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Send affection").font(.caption.weight(.bold)).tracking(1.5).foregroundStyle(p.primary)
            HStack(spacing: 0) {
                ForEach(Affection.emojis, id: \.self) { emoji in
                    Button { store.sendAffection(emoji) } label: {
                        Text(emoji).font(.system(size: 30)).frame(maxWidth: .infinity, minHeight: 52).background(p.soft, in: Circle()).padding(.horizontal, 3)
                    }
                    .buttonStyle(.smooth)
                    .accessibilityLabel("Send \(emoji) to \(store.partner?.name ?? "your partner")")
                }
            }
        }
        .disabled(store.couple == nil)
        .opacity(store.couple == nil ? 0.4 : 1)
    }
}

/// Full-screen layer: each burst sends many copies of the emoji floating up and fading out.
struct AffectionRain: View {
    @EnvironmentObject var store: Store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(store.affectionBursts) { burst in
                    BurstView(emoji: burst.emoji, size: geo.size, reduceMotion: reduceMotion) {
                        store.affectionBursts.removeAll { $0.id == burst.id }
                    }
                }
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }
}

private struct BurstView: View {
    let emoji: String; let size: CGSize; let reduceMotion: Bool; let done: () -> Void
    struct Particle: Identifiable { let id = UUID(); let x: CGFloat; let delay: Double; let scale: CGFloat; let drift: CGFloat; let spin: Double; let duration: Double }
    @State private var particles: [Particle] = []
    @State private var launched = false
    var body: some View {
        ZStack {
            if reduceMotion {
                Text(emoji).font(.system(size: 96)).position(x: size.width / 2, y: size.height / 2).opacity(launched ? 0 : 1)
            } else {
                ForEach(particles) { pt in
                    Text(emoji)
                        .font(.system(size: 44 * pt.scale))
                        .rotationEffect(.degrees(launched ? pt.spin : 0))
                        .position(x: pt.x + (launched ? pt.drift : 0), y: launched ? -80 : size.height + 60)
                        .opacity(launched ? 0 : 1)
                        .animation(.easeOut(duration: pt.duration).delay(pt.delay), value: launched)
                }
            }
        }
        .onAppear {
            particles = (0..<18).map { _ in
                Particle(x: .random(in: 24...(max(25, size.width - 24))), delay: .random(in: 0...0.8), scale: .random(in: 0.7...1.4), drift: .random(in: -60...60), spin: .random(in: -40...40), duration: .random(in: 2.2...3.4))
            }
            DispatchQueue.main.async { withAnimation(reduceMotion ? .easeOut(duration: 1.5) : nil) { launched = true } }
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.5) { done() }
        }
    }
}
