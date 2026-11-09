import SwiftUI
import MapKit
import CoreLocation
import UserNotifications

// Place alerts: save your partner's (or your own) home, work… and get told when they arrive or leave.
// The phone of the person the place belongs to watches it (iOS region monitoring) and sends the alert.
// Proximity alert: when you're both sharing location and come within 500 m, you both get "You're close!".

struct Place: Codable, Identifiable, Equatable {
    var id = UUID().uuidString
    var coupleID: String
    var owner: String          // whose place it is; their phone watches it
    var addedBy: String
    var name: String
    var emoji: String
    var latitude: Double
    var longitude: Double
    var radius: Double = 150
    var alerts = true
    var coordinate: CLLocationCoordinate2D { .init(latitude: latitude, longitude: longitude) }
}

enum Proximity {
    static let meters: CLLocationDistance = 500
    static var enabled: Bool { get { UserDefaults.standard.bool(forKey: "proximity-alert") } set { UserDefaults.standard.set(newValue, forKey: "proximity-alert") } }
}

extension Store {
    var places: [Place] { guard let c = couple else { return [] }; return (db.places ?? []).filter { $0.coupleID == c.id } }
    func savePlace(_ place: Place) {
        var all = db.places ?? []
        if let i = all.firstIndex(where: { $0.id == place.id }) { all[i] = place } else { all.append(place) }
        db.places = all; PlaceMonitor.shared.refresh(self)
    }
    func deletePlace(_ id: String) { db.places?.removeAll { $0.id == id }; PlaceMonitor.shared.refresh(self) }

    /// Sends an arrive/leave/near alert to the partner (push via partner-alert-push).
    func sendPartnerAlert(kind: String, place: String?) {
        guard usesRemoteCouple else { return }
        Task {
            guard let id = try? await InsForge.shared.sendPartnerAlert(kind: kind, place: place) else { return }
            await InsForge.shared.pushPartnerAlert(id: id)
        }
    }

    /// Called after each live sync: fires once when you two come within range.
    func checkProximity() {
        guard Proximity.enabled, let me, let partner,
              let a = db.sharing[me.id], a.location, let la = a.latitude ?? CountryLocator.cachedLocation?.coordinate.latitude, let lo = a.longitude ?? CountryLocator.cachedLocation?.coordinate.longitude,
              let b = db.sharing[partner.id], b.location, let pla = b.latitude, let plo = b.longitude else { return }
        let near = CLLocation(latitude: la, longitude: lo).distance(from: CLLocation(latitude: pla, longitude: plo)) <= Proximity.meters
        let key = "proximity-near-\(couple?.id ?? "")"
        let was = UserDefaults.standard.bool(forKey: key)
        UserDefaults.standard.set(near, forKey: key)
        guard near, !was else { return }
        if usesRemoteCouple { sendPartnerAlert(kind: "near", place: nil) }
        else { Self.localNotify(title: "💞 You're close!", body: "You and \(partner.name) are near each other right now.") }
    }
    static func localNotify(title: String, body: String) {
        let c = UNMutableNotificationContent(); c.title = title; c.body = body; c.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: nil))
    }
}

/// Watches the places that belong to me and reports arrivals/departures. Created at launch so iOS can wake the app.
@MainActor final class PlaceMonitor: NSObject, @preconcurrency CLLocationManagerDelegate {
    static let shared = PlaceMonitor()
    private let manager = CLLocationManager()
    weak var store: Store?
    override init() { super.init(); manager.delegate = self }

    func refresh(_ store: Store) {
        self.store = store
        let mine = store.places.filter { $0.owner == store.db.currentUser && $0.alerts }
        for region in manager.monitoredRegions where region.identifier.hasPrefix("place-") && !mine.contains(where: { "place-\($0.id)" == region.identifier }) { manager.stopMonitoring(for: region) }
        guard !mine.isEmpty, CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return }
        Task {
            if manager.authorizationStatus != .authorizedAlways {
                guard await PermissionGate.shared.ask(.locationAlways) else { return }
                if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
                manager.requestAlwaysAuthorization()
            }
            for p in mine.prefix(20) {
                let r = CLCircularRegion(center: p.coordinate, radius: max(100, p.radius), identifier: "place-\(p.id)")
                r.notifyOnEntry = true; r.notifyOnExit = true
                manager.startMonitoring(for: r)
            }
        }
    }
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) { report(region, "arrive") }
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) { report(region, "leave") }
    private func report(_ region: CLRegion, _ kind: String) {
        guard let store, let place = store.places.first(where: { "place-\($0.id)" == region.identifier }), place.alerts else { return }
        store.sendPartnerAlert(kind: kind, place: place.name)
    }
}

// MARK: Views

struct PlaceAlertsView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var editing: Place?
    var partnerName: String { store.partner?.name ?? "your partner" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Place alerts").font(.system(size: 34, weight: .heavy))
                Text("Add \(partnerName)'s home, work or other places they go often. Get an alert when they arrive or leave.").foregroundStyle(p.secondary)
                Button { editing = newPlace(owner: store.partner?.id, name: "", emoji: "📍") } label: {
                    Label("Add a new place", systemImage: "plus.circle.fill").font(.title3.bold()).foregroundStyle(p.primary)
                        .frame(maxWidth: .infinity).padding(.vertical, 26)
                        .overlay(RoundedRectangle(cornerRadius: 26).stroke(p.primary, lineWidth: 2))
                }.buttonStyle(.smooth).padding(.vertical, 8)
                ForEach(store.places) { place in row(place) }
                ForEach(suggestions, id: \.name) { s in
                    HStack(spacing: 14) {
                        tile(s.emoji, s.tint)
                        VStack(alignment: .leading, spacing: 4) { Text(s.name).font(.headline); Text("Not set").font(.subheadline).foregroundStyle(p.secondary) }
                        Spacer()
                        Button { editing = newPlace(owner: store.partner?.id, name: s.name, emoji: s.emoji) } label: {
                            Label("Add", systemImage: "plus.circle.fill").font(.headline).foregroundStyle(.white).padding(.horizontal, 16).padding(.vertical, 11).background(p.primary, in: Capsule())
                        }.buttonStyle(.smooth)
                    }.padding(14).background(p.surface, in: RoundedRectangle(cornerRadius: 24))
                }
                if store.partner == nil { InfoBanner(text: "Connect your partner to use place alerts.") }
            }.padding(20).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }
        .background(p.background).foregroundStyle(p.text)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) { place in NavigationStack { PlaceEditor(place: place) } }
        .onAppear { PlaceMonitor.shared.refresh(store) }
    }
    var suggestions: [(name: String, emoji: String, tint: Color)] {
        [("\(partnerName)'s home", "🏠", Color(hex: "#FFE1EC")), ("\(partnerName)'s work", "💼", Color(hex: "#E1E8FF"))]
            .filter { s in !store.places.contains { $0.name == s.0 } }.map { ($0.0, $0.1, $0.2) }
    }
    func newPlace(owner: String?, name: String, emoji: String) -> Place? {
        guard let c = store.couple, let me = store.db.currentUser else { return nil }
        let loc = CountryLocator.cachedLocation?.coordinate ?? CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522)
        return Place(coupleID: c.id, owner: owner ?? me, addedBy: me, name: name, emoji: emoji, latitude: loc.latitude, longitude: loc.longitude)
    }
    func tile(_ emoji: String, _ tint: Color) -> some View { Text(emoji).font(.system(size: 34)).frame(width: 64, height: 64).background(tint, in: RoundedRectangle(cornerRadius: 18)) }
    func row(_ place: Place) -> some View {
        HStack(spacing: 14) {
            tile(place.emoji, place.owner == store.db.currentUser ? Color(hex: "#FFE1EC") : Color(hex: "#E1E8FF"))
            VStack(alignment: .leading, spacing: 4) {
                Text(place.name).font(.headline)
                HStack(spacing: 4) { Text("Added by").foregroundStyle(p.secondary); Text(place.addedBy == store.db.currentUser ? "me" : partnerName).foregroundStyle(p.primary) }.font(.subheadline)
            }
            Spacer()
            Button { var x = place; x.alerts.toggle(); store.savePlace(x) } label: {
                Image(systemName: place.alerts ? "bell.fill" : "bell.slash").font(.title3).foregroundStyle(place.alerts ? .white : p.secondary)
                    .frame(width: 52, height: 52).background(place.alerts ? p.primary : p.soft, in: Circle())
            }.buttonStyle(.smooth).accessibilityLabel(place.alerts ? "Alerts on" : "Alerts off")
        }
        .padding(14).background(p.surface, in: RoundedRectangle(cornerRadius: 24))
        .contentShape(Rectangle()).onTapGesture { editing = place }
    }
}

struct PlaceEditor: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @Environment(\.dismiss) var dismiss
    @State var place: Place
    @State private var camera: MapCameraPosition = .automatic
    @State private var center: CLLocationCoordinate2D?
    private let emojis = ["🏠", "💼", "🏋️", "🎓", "☕", "🛒", "👵", "📍"]

    var body: some View {
        Form {
            Section {
                ZStack {
                    Map(position: $camera) { UserAnnotation() }
                        .onMapCameraChange(frequency: .continuous) { center = $0.region.center }
                    Image(systemName: "mappin.circle.fill").font(.system(size: 40)).foregroundStyle(p.primary).shadow(radius: 4).allowsHitTesting(false)
                    Circle().stroke(p.primary.opacity(0.5), lineWidth: 2).fill(p.primary.opacity(0.12)).frame(width: 90, height: 90).allowsHitTesting(false)
                }.frame(height: 260).listRowInsets(EdgeInsets())
                Button { if let l = CountryLocator.cachedLocation { camera = .region(MKCoordinateRegion(center: l.coordinate, latitudinalMeters: 600, longitudinalMeters: 600)) } } label: { Label("Use my current location", systemImage: "location.fill") }
            } footer: { Text("Move the map so the pin sits on the place.") }
            Section("Place") {
                TextField("Name, e.g. Alex's home", text: $place.name)
                ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(emojis, id: \.self) { e in Button(e) { place.emoji = e }.font(.title).padding(6).background(place.emoji == e ? p.soft : .clear, in: RoundedRectangle(cornerRadius: 10)) } } }
                Picker("Whose place", selection: $place.owner) {
                    if let partner = store.partner { Text(partner.name).tag(partner.id) }
                    Text("Mine").tag(store.db.currentUser ?? "")
                }
                Toggle("Arrive and leave alerts", isOn: $place.alerts)
            }
            if store.places.contains(where: { $0.id == place.id }) {
                Section { Button("Delete place", role: .destructive) { store.deletePlace(place.id); dismiss() } }
            }
        }
        .navigationTitle(place.name.isEmpty ? "New place" : place.name).navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    if let c = center { place.latitude = c.latitude; place.longitude = c.longitude }
                    place.name = place.name.trimmingCharacters(in: .whitespaces)
                    store.savePlace(place); dismiss()
                }.disabled(place.name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .onAppear { camera = .region(MKCoordinateRegion(center: place.coordinate, latitudinalMeters: 600, longitudinalMeters: 600)) }
    }
}

struct ProximityAlertView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @Environment(\.dismiss) var dismiss
    @State private var on = Proximity.enabled
    @State private var sweep = false

    var body: some View {
        VStack(spacing: 18) {
            (Text("🔔 Proximity ") + Text("Alert").foregroundStyle(p.primary)).font(.system(size: 32, weight: .heavy)).multilineTextAlignment(.center)
            Text("Turn this on to be told when you and \(store.partner?.name ?? "your partner") are close to each other.").foregroundStyle(p.secondary).multilineTextAlignment(.center)
            radar.frame(maxHeight: 420)
            Spacer(minLength: 0)
            Button { Task { await toggle() } } label: {
                Text(on ? "Turn off proximity alert" : "Turn on proximity alert").font(.headline).foregroundStyle(on ? p.primary : .white)
                    .frame(maxWidth: .infinity).padding(.vertical, 17).background(on ? p.soft : p.primary, in: Capsule())
            }.buttonStyle(.smooth)
            if !on { Button("Not now") { dismiss() }.font(.subheadline.weight(.semibold)).foregroundStyle(p.secondary) }
            else { Text("On · alerts within \(Int(Proximity.meters)) m. You both need location sharing turned on.").font(.caption).foregroundStyle(p.secondary).multilineTextAlignment(.center) }
        }
        .padding(24).frame(maxWidth: 560).frame(maxWidth: .infinity)
        .background(p.background).foregroundStyle(p.text)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { withAnimation(.linear(duration: 3).repeatForever(autoreverses: false)) { sweep = true } }
    }
    var radar: some View {
        GeometryReader { geo in
            let s = min(geo.size.width, geo.size.height)
            ZStack {
                RoundedRectangle(cornerRadius: 40).fill(LinearGradient(colors: [Color(hex: "#E9B8FF"), Color(hex: "#B07CFF"), Color(hex: "#F3C6F1")], startPoint: .top, endPoint: .bottom))
                ForEach(1..<4) { i in Circle().stroke(.white.opacity(0.35), lineWidth: 1.5).frame(width: s * CGFloat(i) * 0.28) }
                AngularGradient(colors: [.white.opacity(0.0), .white.opacity(0.45)], center: .center, startAngle: .degrees(0), endAngle: .degrees(70))
                    .clipShape(Circle()).frame(width: s * 0.84).rotationEffect(.degrees(sweep ? 360 : 0))
                Image(systemName: "heart.fill").font(.system(size: 34)).foregroundStyle(.white).shadow(color: .white, radius: 10)
                if let partner = store.partner { Avatar(person: partner, size: s * 0.22).overlay(Circle().stroke(.white, lineWidth: 5)).offset(x: -s * 0.24, y: s * 0.18) }
                Avatar(person: store.me, size: s * 0.15).overlay(Circle().stroke(.white, lineWidth: 4)).offset(x: s * 0.22, y: -s * 0.16)
            }.frame(width: geo.size.width, height: geo.size.height)
        }.clipShape(RoundedRectangle(cornerRadius: 40)).accessibilityHidden(true)
    }
    func toggle() async {
        if on { on = false; Proximity.enabled = false; return }
        guard await PermissionGate.shared.ask(.notifications) else { return }
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        if let me = store.me, store.db.sharing[me.id]?.location != true { store.setSharing(location: true, battery: store.db.sharing[me.id]?.battery ?? false) }
        on = true; Proximity.enabled = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        store.checkProximity()
    }
}

/// The two map shortcuts: place alerts and proximity alert.
struct MapAlertButtons: View {
    @Environment(\.appPalette) var p
    var body: some View {
        HStack(spacing: 10) {
            NavigationLink { PlaceAlertsView() } label: { chip("mappin.and.ellipse", "Place alerts") }
            NavigationLink { ProximityAlertView() } label: { chip("bell.badge.fill", Proximity.enabled ? "Proximity · on" : "Proximity") }
        }
    }
    func chip(_ icon: String, _ text: String) -> some View {
        Label(text, systemImage: icon).font(.subheadline.weight(.semibold)).foregroundStyle(p.primary)
            .padding(.horizontal, 14).padding(.vertical, 10).background(.regularMaterial, in: Capsule()).shadow(color: .black.opacity(0.12), radius: 6, y: 2)
    }
}
