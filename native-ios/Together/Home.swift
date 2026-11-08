import SwiftUI
import MapKit

struct HomeView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var capture = false
    var body: some View {
        Page {
            HStack { VStack(alignment: .leading, spacing: 4) { Text("OUR LITTLE WORLD").font(.caption.weight(.bold)).tracking(2).foregroundStyle(p.primary); Text("Closer, together.").font(.system(size: 30, weight: .bold, design: .rounded)) }; Spacer(); NavigationLink { MessagesView() } label: { Image(systemName: "envelope").font(.title2).padding(12).background(p.soft, in: Circle()) } }
            PartnerHeader()
            if store.couple != nil { AffectionBar() }
            if store.couple != nil { ShareLiveCard() }
            if store.partner?.simulated == true { InfoBanner(text: "Alex is a simulated partner. Replies are generated on this device and never reach a real person.", icon: "testtube.2") }
            if store.partner == nil { Card { Text("Your shared space starts here").font(.title2.bold()); Text("Invite your partner or explore with a simulated partner.").foregroundStyle(.secondary); NavigationLink("Partner connection") { PartnerSettings() } } }
            Card {
                HStack(spacing: 16) { Text("🔥").font(.system(size: 36)).padding(16).background(p.soft, in: RoundedRectangle(cornerRadius: 18)); VStack(alignment: .leading) { Text("\(store.streak.current) days").font(.system(size: 30, weight: .bold)); Text("Send a moment to keep your flame growing").font(.subheadline).foregroundStyle(.secondary) } }
                HStack { status(store.me); Spacer(); status(store.partner) }
                PrimaryButton(title: "Send my moment") { capture = true }
                NavigationLink { FlameView() } label: { Text("Flame details & history").font(.subheadline.bold()).frame(maxWidth: .infinity).padding(.top, 4) }
            }
            if let suggestion = store.connectionPreferences?.suggestion {
                NavigationLink { DeckView(deck: suggestion.deck) } label: {
                    Card { Text("A STARTING POINT FOR YOU").font(.caption.bold()).tracking(1).foregroundStyle(p.primary); Text("\(suggestion.deck.emoji) \(suggestion.deck.title)").font(.title3.bold()); Text(suggestion.body).foregroundStyle(.secondary); Text(suggestion.duration).font(.caption).foregroundStyle(.secondary) }
                }.buttonStyle(.smooth)
            }
            if let event = store.nextEvent { NavigationLink { EventDetail(id: event.id) } label: {
                VStack(alignment: .leading, spacing: 12) { Text("NEXT MEETING").font(.caption.bold()).tracking(2); HStack(alignment: .firstTextBaseline, spacing: 10) { Text("\(Day.distance(store.today, event.day))").font(.system(size: 62, weight: .bold, design: .rounded)); Text("days to go").font(.title2.bold()) }; Text("\(event.destination.isEmpty ? event.title : event.destination) · \(Day.label(event.day))").font(.subheadline) }.foregroundStyle(.white).frame(maxWidth: .infinity, alignment: .leading).padding(24).background(p.gradient, in: RoundedRectangle(cornerRadius: 26))
            }.buttonStyle(.smooth) } else { Card { RowLink(title: "Plan your next meeting", icon: "calendar.badge.plus") { EventEditor() } } }
            NavigationLink { DailyQuestionView() } label: { Card { Text("QUESTION OF THE DAY").font(.caption.bold()).tracking(1.5).foregroundStyle(p.primary); Text(Product.shared.daily(store.today).text).font(.title3.bold()); Text("Tap to answer · hidden until you both do").font(.caption).foregroundStyle(.secondary) } }.buttonStyle(.smooth)
            SectionHeading(title: "A little affection")
            HStack { ForEach(["😘", "🤗", "💭", "🫶"], id: \.self) { emoji in Button { store.perform { try store.send(emoji, kind: "affection") }; if store.db.prefs.haptics { UIImpactFeedbackGenerator(style: .light).impactOccurred() } } label: { Text(emoji).font(.system(size: 28)).frame(maxWidth: .infinity).padding(.vertical, 16).background(p.surface, in: RoundedRectangle(cornerRadius: 20)) }.accessibilityLabel(emoji == "😘" ? "Send a kiss" : emoji == "🤗" ? "Send a hug" : emoji == "💭" ? "Thinking of you" : "Need you") } }
        }.toolbar(.hidden, for: .navigationBar).sheet(isPresented: $capture) { NavigationStack { CaptureMomentView() } }
    }
    func status(_ person: Person?) -> some View { let sent = store.moments.contains { $0.author == person?.id && $0.day == store.today }; return Text("\(person?.name ?? "Partner"): \(sent ? "Sent ✓" : "Waiting…")").font(.caption.bold()).foregroundStyle(p.primary).padding(10).background(p.soft.opacity(0.5), in: Capsule()) }
}
struct PartnerHeader: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @StateObject private var locator = CountryLocator()
    @State private var myBattery: Int?
    @State private var charging = false
    private let avatar: CGFloat = 72
    var body: some View {
        HStack(alignment: .top) { person(store.me); Spacer(minLength: 0); VStack(spacing: 8) { Text("💕").font(.title).frame(width: 48, height: 48).background(p.soft, in: Circle()).padding(.top, avatar / 2 - 24); Text(timeDifference).font(.caption).foregroundStyle(.secondary); if let distance { Text("📍 " + distance).font(.caption).foregroundStyle(.secondary).accessibilityLabel(distance + " apart") } }.frame(width: 96); Spacer(minLength: 0); person(store.partner) }
            .background(alignment: .top) { if store.partner != nil { GeometryReader { geo in let column = (geo.size.width - 96) / 2; let half = max(0, (geo.size.width - column - avatar - 12 - 52) / 2); HStack(spacing: 52) { DottedConnector(color: p.primary).frame(width: half, height: 4); DottedConnector(color: p.primary).frame(width: half, height: 4).scaleEffect(x: -1) }.position(x: geo.size.width / 2, y: avatar / 2) } } }
            .padding(.vertical, 12)
            .onAppear { readBattery(); locator.start() }
            .onReceive(NotificationCenter.default.publisher(for: UIDevice.batteryLevelDidChangeNotification)) { _ in readBattery() }
            .onReceive(NotificationCenter.default.publisher(for: UIDevice.batteryStateDidChangeNotification)) { _ in readBattery() }
    }
    func person(_ person: Person?) -> some View {
        let mine = person?.id == store.me?.id
        let s = person.flatMap { store.db.sharing[$0.id] }
        // Yours always; your partner's only when they share it.
        let code = mine ? (locator.code ?? s?.countryCode) : (s?.location == true ? s?.countryCode : nil)
        let battery = mine ? (myBattery ?? s?.batteryPercent) : (s?.battery == true ? s?.batteryPercent : nil)
        return VStack(spacing: 6) {
            Avatar(person: person, size: avatar); Text(person?.name ?? "Partner").font(.headline).lineLimit(1)
            HStack(spacing: 4) {
                if let flag = Flag.emoji(code) { Text(flag).font(.subheadline).accessibilityLabel(Locale.current.localizedString(forRegionCode: code ?? "") ?? "Country") }
                Text(clock(person?.timezone ?? TimeZone.current.identifier) + (mine ? " · You" : person?.simulated == true ? "" : " · Partner")).font(.caption).foregroundStyle(.secondary)
            }
            if let battery { BatteryGauge(percent: battery, charging: mine && charging) }
        }.frame(maxWidth: .infinity)
    }
    func readBattery() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let level = UIDevice.current.batteryLevel; myBattery = level >= 0 ? Int((level * 100).rounded()) : nil
        charging = [.charging, .full].contains(UIDevice.current.batteryState)
        if let id = store.db.currentUser, store.db.sharing[id]?.battery == true, let myBattery { store.db.sharing[id]?.batteryPercent = myBattery }
    }
    /// Your position from this phone; your partner's only when they share location.
    var distance: String? {
        guard let partner = store.partner, let s = store.db.sharing[partner.id], s.location, let lat = s.latitude, let lon = s.longitude else { return nil }
        let mine = locator.location ?? store.db.currentUser.flatMap { store.db.sharing[$0] }.flatMap { m in m.latitude.flatMap { la in m.longitude.map { CLLocation(latitude: la, longitude: $0) } } }
        guard let mine else { return nil }
        let km = mine.distance(from: CLLocation(latitude: lat, longitude: lon)) / 1000
        let f = MeasurementFormatter(); f.unitOptions = .naturalScale; f.numberFormatter.maximumFractionDigits = km >= 100 ? 0 : 1
        return f.string(from: Measurement(value: km, unit: UnitLength.kilometers))
    }
    func clock(_ zone: String) -> String { let f = DateFormatter(); f.timeZone = TimeZone(identifier: zone); f.dateFormat = "HH:mm"; return f.string(from: Date()) }
    var timeDifference: String { let mine = TimeZone(identifier: store.me?.timezone ?? "UTC")?.secondsFromGMT() ?? 0; let theirs = TimeZone(identifier: store.partner?.timezone ?? "UTC")?.secondsFromGMT() ?? 0; let delta = Double(theirs - mine) / 3600; return delta == 0 ? "Same time zone" : "\(abs(delta).formatted())h \(delta > 0 ? "ahead" : "behind")" }
}
enum Flag {
    /// "FR" → 🇫🇷
    static func emoji(_ code: String?) -> String? {
        guard let code, code.count == 2, code.allSatisfy(\.isLetter) else { return nil }
        return String(String.UnicodeScalarView(code.uppercased().unicodeScalars.compactMap { UnicodeScalar(127397 + $0.value) }))
    }
}
/// Country code of this phone's current location (asks for "while using" permission once).
@MainActor final class CountryLocator: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published var code: String?
    @Published var location: CLLocation?
    private let manager = CLLocationManager()
    static var cached: String?
    static var cachedLocation: CLLocation?
    override init() { super.init(); manager.delegate = self; manager.desiredAccuracy = kCLLocationAccuracyReduced; code = Self.cached; location = Self.cachedLocation }
    func start() { guard Self.cached == nil else { return }; switch manager.authorizationStatus { case .notDetermined: manager.requestWhenInUseAuthorization(); case .authorizedWhenInUse, .authorizedAlways: manager.requestLocation(); default: break } }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways { manager.requestLocation() } }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Self.cachedLocation = location; self.location = location
        CLGeocoder().reverseGeocodeLocation(location) { [weak self] places, _ in Task { @MainActor in guard let iso = places?.first?.isoCountryCode else { return }; Self.cached = iso; self?.code = iso } }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}
/// A drawn battery: green, orange at 20 % or less, red at 10 % or less; ⚡ while charging.
struct BatteryGauge: View {
    var percent: Int; var charging = false
    var body: some View {
        let level = min(max(percent, 0), 100)
        let fill: Color = charging ? .green : level <= 10 ? .red : level <= 20 ? .orange : .green
        HStack(spacing: 4) {
            HStack(spacing: 1) {
                RoundedRectangle(cornerRadius: 3).stroke(.secondary, lineWidth: 1.5).frame(width: 24, height: 12)
                    .overlay(alignment: .leading) { RoundedRectangle(cornerRadius: 1.5).fill(fill).frame(width: max(2, 19 * CGFloat(level) / 100), height: 7).padding(.leading, 2.5).animation(.easeInOut, value: level) }
                RoundedRectangle(cornerRadius: 1).fill(.secondary).frame(width: 2, height: 5)
            }
            Text("\(charging ? "⚡" : "")\(level)%").font(.caption.monospacedDigit()).foregroundStyle(level <= 10 && !charging ? .red : .secondary)
        }.accessibilityElement(children: .ignore).accessibilityLabel("Battery \(level) percent\(charging ? ", charging" : "")")
    }
}
/// Dots marching left to right; flip with scaleEffect(x: -1) for the other direction.
struct DottedConnector: View {
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @Environment(\.scenePhase) private var scenePhase
    var color: Color
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reducedMotion || scenePhase != .active)) { context in
            Canvas { ctx, size in
                let gap: CGFloat = 10, dot: CGFloat = 4
                let shift = reducedMotion ? 0 : CGFloat(context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 0.7) / 0.7) * gap
                var x = -gap + shift; var i = 0
                while x < size.width { if x >= 0 { ctx.fill(Path(ellipseIn: CGRect(x: x, y: (size.height - dot) / 2, width: dot, height: dot)), with: .color(color.opacity(0.35 + 0.25 * Double(i % 3)))) }; x += gap; i += 1 }
            }
        }.accessibilityHidden(true)
    }
}
struct CaptureMomentView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var media: Media?
    @State private var caption = ""
    var body: some View { Page { Text("A little piece of your day.").font(.title2.bold()); Text("Both of you send a photo or video for the day to count. Your couple day follows \(store.couple?.timezone ?? "your time zone").").foregroundStyle(.secondary); Card { MediaChooser(media: $media); TextField("Add a caption", text: $caption, axis: .vertical).textFieldStyle(.soft) }; PrimaryButton(title: "Send my moment") { store.perform { guard let media else { throw AppError(message: "Choose a photo or video first.") }; try store.addMoment(media: media, caption: caption); dismiss() } } }.navigationTitle("Daily moment").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } } }
}
struct FlameView: View {
    @EnvironmentObject var store: Store
    @State private var capture = false
    var body: some View { Page { Card { Text("🔥 \(store.streak.current) days").font(.largeTitle.bold()); Text("Longest flame: \(store.streak.longest) days").font(.headline); Text("Each of you sends one moment per couple day. Extra moments never add extra credit.").foregroundStyle(.secondary); PrimaryButton(title: "Send my moment") { capture = true } }; SectionHeading(title: "Moment history"); if store.moments.isEmpty { ContentUnavailableView("Your flame starts with a moment", systemImage: "flame", description: Text("Choose a photo or video to begin.")) }; ForEach(Array(Set(store.moments.map(\.day))).sorted().reversed(), id: \.self) { day in NavigationLink { MomentDayView(day: day) } label: { Card { HStack { Text(Day.label(day)).font(.headline); Spacer(); Text(store.streak.days.contains(day) ? "🔥 Complete" : "Waiting").font(.caption) } } }.buttonStyle(.smooth) } }.navigationTitle("Daily flame").sheet(isPresented: $capture) { NavigationStack { CaptureMomentView() } } }
}
struct MomentDayView: View {
    @EnvironmentObject var store: Store
    var day: String
    var body: some View { Page { ForEach(store.moments.filter { $0.day == day }) { moment in Card { Text(store.db.people.first { $0.id == moment.author }.map { $0.name + ($0.simulated ? " · simulated" : "") } ?? "Partner").font(.headline); MediaPreview(media: moment.media); Text(moment.caption) } } }.navigationTitle(Day.label(day)).navigationBarTitleDisplayMode(.inline) }
}
struct CoupleMapView: View {
    @EnvironmentObject var store: Store
    @StateObject private var location = LocationService()
    @Environment(\.scenePhase) var phase
    var body: some View { Page {
        Text("Two places, one connection.").font(.title2.bold())
        Map {
            if let sharing = ownSharing, sharing.location, let lat = sharing.latitude, let lon = sharing.longitude { Marker(store.me?.name ?? "You", coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon)) }
            if store.partner?.simulated == true { Marker("Alex · simulated Montréal", systemImage: "heart.fill", coordinate: CLLocationCoordinate2D(latitude: 45.5019, longitude: -73.5674)) }
        }.frame(height: 340).clipShape(RoundedRectangle(cornerRadius: 24))
        if store.partner?.simulated == true { InfoBanner(text: "Alex’s Montréal pin is a fixed demo location, not a live person’s position.") }
        PartnerHeader()
        Card { Toggle("Share my location", isOn: Binding(get: { ownSharing?.location ?? false }, set: { store.setSharing(location: $0); if $0 { location.request(store: store) } })); Toggle("Share my battery", isOn: Binding(get: { ownSharing?.battery ?? false }, set: { store.setSharing(battery: $0); UIDevice.current.isBatteryMonitoringEnabled = $0 })); if ownSharing?.battery == true { Text(UIDevice.current.batteryLevel >= 0 ? "Your battery: \(Int(UIDevice.current.batteryLevel * 100))%" : "Battery unavailable in this simulator").font(.caption) }; Text("Sharing is opt-in. Turning location off immediately clears your saved position. No location history is recorded.").font(.caption).foregroundStyle(.secondary) }
        InfoBanner(text: "This build stores data on this device. Live sharing between phones requires a shared backend.")
    }.navigationTitle("Map").onChange(of: phase) { _, phase in if phase == .active && ownSharing?.location == true { location.request(store: store) } }.onAppear { if ownSharing?.location == true { location.request(store: store) } } }
    var ownSharing: Sharing? { store.db.sharing[store.db.currentUser ?? ""] }
}

/// One-time ask on Home: share location (flag + distance) and battery with the partner.
struct ShareLiveCard: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) private var p
    @AppStorage("share-live-asked") private var asked = false
    var mine: Sharing? { store.db.sharing[store.db.currentUser ?? ""] }
    var body: some View {
        if !asked, store.usesRemoteCouple, mine?.location != true, mine?.battery != true {
            Card {
                Text("Share with \(store.partner?.name ?? "your partner")?").font(.headline)
                Text("They'll see your country flag, how far apart you are, and your battery. You can change this anytime in Map.").font(.subheadline).foregroundStyle(.secondary)
                HStack {
                    Button("Not now") { asked = true }.frame(minHeight: 44)
                    Spacer()
                    Button { store.setSharing(location: true, battery: true); UIDevice.current.isBatteryMonitoringEnabled = true; asked = true; Task { await store.syncLive() } } label: {
                        Text("Share").font(.headline).padding(.horizontal, 22).frame(minHeight: 44).foregroundStyle(p.color("onPrimary")).background(p.primary, in: Capsule())
                    }.buttonStyle(.smooth)
                }
            }
        }
    }
}
