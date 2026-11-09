import SwiftUI
import AVFoundation
import CoreLocation
import Photos
import UserNotifications

/// Every system permission is introduced by our own screen first. The iOS prompt only
/// appears after the person taps "Continue", so they know why we're asking.
enum PermissionKind: String, Identifiable {
    case location, locationAlways, notifications, microphone, camera, photos, faceID
    var id: String { rawValue }
    var emoji: String { ["location": "📍", "locationAlways": "🏡", "notifications": "🔔", "microphone": "🎙️", "camera": "📸", "photos": "🖼️", "faceID": "🔒"][rawValue]! }
    var title: String {
        switch self {
        case .location: "Share where you are"
        case .locationAlways: "Alerts, even when closed"
        case .notifications: "Never miss your partner"
        case .microphone: "Send your voice"
        case .camera: "Capture your moment"
        case .photos: "Save to your Photos"
        case .faceID: "Keep it just for you"
        }
    }
    var subtitle: String {
        switch self {
        case .location: "Your location shows on the map, the distance between you and your country flag. Only your partner sees it, and only while sharing is on."
        case .locationAlways: "Place and proximity alerts need to know when you arrive or leave, even when Corasis is closed. Choose “Always allow” on the next screen."
        case .notifications: "Get kisses, messages, place alerts and the “you’re close!” alert the moment they happen."
        case .microphone: "Record little voice notes for your partner. We only listen while you hold record."
        case .camera: "Take today’s moment and share it with your partner."
        case .photos: "Save your wallpaper and memories to your photo library."
        case .faceID: "Lock Corasis with Face ID so your private moments stay private."
        }
    }
    var points: [(String, String)] {
        switch self {
        case .location: [("heart.fill", "Only your partner can see it"), ("hand.raised.fill", "Turn sharing off any time")]
        case .locationAlways: [("bell.fill", "Arrive and leave alerts"), ("location.fill", "Uses low-power location"), ("hand.raised.fill", "Turn alerts off any time")]
        case .notifications: [("heart.fill", "Affection and messages"), ("mappin.and.ellipse", "Place and proximity alerts"), ("calendar", "Reminders before you meet")]
        case .microphone: [("waveform", "Only while recording"), ("lock.fill", "Sent to your partner only")]
        case .camera: [("camera.fill", "Only when you open the camera"), ("lock.fill", "Shared with your partner only")]
        case .photos: [("square.and.arrow.down", "Add-only access"), ("eye.slash.fill", "We never read your library")]
        case .faceID: [("faceid", "Stays on this phone"), ("lock.fill", "Nothing leaves your device")]
        }
    }
    var colors: [Color] {
        switch self {
        case .location, .locationAlways: [Color(hex: "#8FD3FF"), Color(hex: "#6C7BFF")]
        case .notifications: [Color(hex: "#FFD36E"), Color(hex: "#FF8A5B")]
        case .microphone, .camera: [Color(hex: "#F7A8C4"), Color(hex: "#C2477A")]
        case .photos, .faceID: [Color(hex: "#B9A4FF"), Color(hex: "#7C5CFF")]
        }
    }
    /// True only when the system would show its prompt now (we never pre-ask twice).
    @MainActor var needsAsking: Bool {
        get async {
            switch self {
            case .location: return CLLocationManager().authorizationStatus == .notDetermined
            case .locationAlways: let s = CLLocationManager().authorizationStatus; return s == .notDetermined || s == .authorizedWhenInUse
            case .notifications: return await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .notDetermined
            case .microphone: return AVAudioApplication.shared.recordPermission == .undetermined
            case .camera: return AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined
            case .photos: return PHPhotoLibrary.authorizationStatus(for: .addOnly) == .notDetermined
            case .faceID: return !UserDefaults.standard.bool(forKey: "primer-faceID")
            }
        }
    }
}

/// Shows the primer and waits for the answer. Call before any system request:
/// `guard await PermissionGate.shared.ask(.microphone) else { return }`
@MainActor final class PermissionGate: ObservableObject {
    static let shared = PermissionGate()
    @Published var current: PermissionKind?
    private var waiting: CheckedContinuation<Bool, Never>?

    /// Returns true to go ahead with the system request, false if they chose "Not now".
    func ask(_ kind: PermissionKind) async -> Bool {
        guard await kind.needsAsking else { return true }
        if kind == .faceID { UserDefaults.standard.set(true, forKey: "primer-faceID") }
        waiting?.resume(returning: false)
        return await withCheckedContinuation { c in waiting = c; current = kind }
    }
    func answer(_ yes: Bool) { let c = waiting; waiting = nil; current = nil; c?.resume(returning: yes) }
}

struct PermissionPrimerView: View {
    let kind: PermissionKind
    let answer: (Bool) -> Void
    @Environment(\.appPalette) var p
    @State private var pulse = false

    var body: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 12)
            ZStack {
                ForEach(0..<3) { i in
                    Circle().stroke(kind.colors[1].opacity(0.25), lineWidth: 2)
                        .frame(width: 120 + CGFloat(i) * 56, height: 120 + CGFloat(i) * 56)
                        .scaleEffect(pulse ? 1.08 : 0.92).opacity(pulse ? 0.3 : 0.9)
                        .animation(.easeInOut(duration: 1.6).repeatForever().delay(Double(i) * 0.25), value: pulse)
                }
                Circle().fill(LinearGradient(colors: kind.colors, startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 120, height: 120)
                    .shadow(color: kind.colors[1].opacity(0.45), radius: 24, y: 10)
                Text(kind.emoji).font(.system(size: 56))
            }.frame(height: 240).accessibilityHidden(true)
            Text(kind.title).font(.system(size: 30, weight: .heavy)).multilineTextAlignment(.center)
            Text(kind.subtitle).font(.body).foregroundStyle(p.secondary).multilineTextAlignment(.center)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(kind.points, id: \.1) { icon, text in
                    HStack(spacing: 12) { Image(systemName: icon).foregroundStyle(kind.colors[1]).frame(width: 26); Text(text).font(.subheadline.weight(.medium)) }
                }
            }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(p.surface, in: RoundedRectangle(cornerRadius: 20))
            Spacer()
            Button { answer(true) } label: {
                Text("Continue").font(.headline).foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 17)
                    .background(LinearGradient(colors: kind.colors, startPoint: .leading, endPoint: .trailing), in: Capsule())
            }.buttonStyle(.smooth)
            Button("Not now") { answer(false) }.font(.subheadline.weight(.semibold)).foregroundStyle(p.secondary)
        }
        .padding(24).frame(maxWidth: 520).frame(maxWidth: .infinity)
        .background(p.background.ignoresSafeArea()).foregroundStyle(p.text)
        .onAppear { pulse = true }
        .interactiveDismissDisabled()
    }
}

/// Attach once at the root: presents whichever primer the gate is asking for.
struct PermissionPrimerHost: ViewModifier {
    @ObservedObject var gate = PermissionGate.shared
    func body(content: Content) -> some View {
        content.fullScreenCover(item: Binding(get: { gate.current }, set: { if $0 == nil { gate.answer(false) } })) { kind in
            PermissionPrimerView(kind: kind) { gate.answer($0) }
        }
    }
}
