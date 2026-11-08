import SwiftUI
import PhotosUI
import AVKit
import CoreLocation
import UserNotifications
import UniformTypeIdentifiers

struct MovieTransfer: Transferable {
    var url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { value in SentTransferredFile(value.url) } importing: { received in
            let url = try MediaFiles.copy(received.file, extension: received.file.pathExtension.isEmpty ? "mov" : received.file.pathExtension)
            return MovieTransfer(url: url)
        }
    }
}
enum MediaFiles {
    static var directory: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Together/Media", isDirectory: true) }
    static func url(_ path: String) -> URL { path.hasPrefix("/") ? URL(fileURLWithPath: path) : directory.appendingPathComponent(path) }
    static func save(_ data: Data, extension ext: String) throws -> URL { try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true); let file = directory.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext); try data.write(to: file, options: [.atomic, .completeFileProtectionUnlessOpen]); return file }
    static func copy(_ source: URL, extension ext: String) throws -> URL { try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true); let file = directory.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext); try FileManager.default.copyItem(at: source, to: file); return file }
    static func load(_ item: PhotosPickerItem) async throws -> Media {
        if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
            guard let movie = try await item.loadTransferable(type: MovieTransfer.self) else { throw AppError(message: "The video could not be loaded.") }; return Media(path: movie.url.lastPathComponent, kind: "video")
        }
        guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data), let jpeg = image.jpegData(compressionQuality: 0.85) else { throw AppError(message: "The photo could not be loaded.") }
        let file = try save(jpeg, extension: "jpg"); return Media(path: file.lastPathComponent, kind: "photo")
    }
}
struct MediaPreview: View {
    var media: Media
    @State private var player: AVPlayer?
    @State private var playing = false
    var body: some View {
        Group {
            if media.kind == "photo", let image = UIImage(contentsOfFile: MediaFiles.url(media.path).path) { Image(uiImage: image).resizable().scaledToFit() }
            else if media.kind == "video" { VideoPlayer(player: player).frame(minHeight: 240) }
            else if media.kind == "voice" { Button { if playing { player?.pause() } else { player?.seek(to: .zero); player?.play() }; playing.toggle() } label: { Label(playing ? "Pause voice note" : "Play voice note", systemImage: playing ? "pause.circle.fill" : "play.circle.fill").font(.headline).padding(16) } }
            else { ContentUnavailableView("Media unavailable", systemImage: "photo") }
        }.clipShape(RoundedRectangle(cornerRadius: 16))
            .onAppear { if media.kind != "photo" { player = AVPlayer(url: MediaFiles.url(media.path)) } }
            .onDisappear { player?.pause(); playing = false }
    }
}
struct MediaChooser: View {
    @EnvironmentObject var store: Store
    @Binding var media: Media?
    var photosOnly = false
    @State private var item: PhotosPickerItem?
    @State private var camera = false
    @State private var busy = false
    var body: some View { VStack(spacing: 14) {
        if let media { MediaPreview(media: media).frame(maxHeight: 300) }
        PhotosPicker(selection: $item, matching: photosOnly ? .images : .any(of: [.images, .videos])) { Label(busy ? "Loading…" : media == nil ? (photosOnly ? "Choose photo" : "Choose photo or video") : "Change media", systemImage: "photo.on.rectangle") }.disabled(busy)
        if UIImagePickerController.isSourceTypeAvailable(.camera) { Button("Take a photo") { camera = true } }
        else { Text("Camera capture is available on a physical iPhone. Add photos to the simulator to choose from its library.").font(.caption).foregroundStyle(.secondary) }
    }.onChange(of: item) { _, value in guard let value else { return }; busy = true; Task { do { media = try await MediaFiles.load(value) } catch { store.error = error.localizedDescription }; busy = false } }
        .sheet(isPresented: $camera) { CameraCapture { result in switch result { case .success(let value): media = value; case .failure(let error): store.error = error.localizedDescription }; camera = false } }
    }
}
struct CameraCapture: UIViewControllerRepresentable {
    var completion: (Result<Media, Error>) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }
    func makeUIViewController(context: Context) -> UIImagePickerController { let picker = UIImagePickerController(); picker.sourceType = .camera; picker.delegate = context.coordinator; return picker }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        var completion: (Result<Media, Error>) -> Void
        init(completion: @escaping (Result<Media, Error>) -> Void) { self.completion = completion }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { picker.dismiss(animated: true) }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey:Any]) {
            do { guard let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.85) else { throw AppError(message: "Could not capture the photo.") }; let url = try MediaFiles.save(data, extension: "jpg"); completion(.success(Media(path: url.lastPathComponent, kind: "photo"))) } catch { completion(.failure(error)) }
        }
    }
}
@MainActor final class VoiceRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published var recording = false
    private var recorder: AVAudioRecorder?
    func start() async throws {
        let permission = await AVAudioApplication.requestRecordPermission()
        guard permission else { throw AppError(message: "Allow microphone access in Settings to record voice notes.") }
        let session = AVAudioSession.sharedInstance(); try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker]); try session.setActive(true)
        try FileManager.default.createDirectory(at: MediaFiles.directory, withIntermediateDirectories: true)
        let url = MediaFiles.directory.appendingPathComponent(UUID().uuidString).appendingPathExtension("m4a")
        recorder = try AVAudioRecorder(url: url, settings: [AVFormatIDKey: Int(kAudioFormatMPEG4AAC), AVSampleRateKey: 44100, AVNumberOfChannelsKey: 1, AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue])
        guard recorder?.record() == true else { throw AppError(message: "Recording could not start.") }; recording = true
    }
    func stop() -> Media? { recorder?.stop(); recording = false; try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation); return recorder.map { Media(path: $0.url.lastPathComponent, kind: "voice") } }
    func cancel() { _ = stop(); recorder?.deleteRecording() }
}
@MainActor final class LocationService: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    weak var store: Store?
    override init() { super.init(); manager.delegate = self; manager.desiredAccuracy = kCLLocationAccuracyKilometer }
    func request(store: Store) { self.store = store; if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() } else if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways { manager.requestLocation() } else { store.setSharing(location: false); store.error = "Location permission is off. You can enable it in iOS Settings." } }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways { manager.requestLocation() } else if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted { store?.setSharing(location: false) } }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) { guard let store, let id = store.db.currentUser, store.db.sharing[id]?.location == true, let location = locations.last else { return }; store.db.sharing[id]?.latitude = location.coordinate.latitude; store.db.sharing[id]?.longitude = location.coordinate.longitude; store.db.sharing[id]?.updated = location.timestamp
        CLGeocoder().reverseGeocodeLocation(location) { [weak store] places, _ in Task { @MainActor in guard let store, let place = places?.first, store.db.sharing[id]?.location == true else { return }; store.db.sharing[id]?.country = place.country; store.db.sharing[id]?.countryCode = place.isoCountryCode } } }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { store?.error = "Could not get your current location: \(error.localizedDescription)" }
}
enum Reminders {
    static func update(prefs: Preferences) async throws {
        let center = UNUserNotificationCenter.current(); center.removePendingNotificationRequests(withIdentifiers: ["together-daily"])
        if !prefs.notifications { center.removeAllPendingNotificationRequests(); return }
        guard prefs.dailyReminder else { return }
        guard try await center.requestAuthorization(options: [.alert, .sound, .badge]) else { throw AppError(message: "Notifications are disabled in iOS Settings.") }
        let parts = prefs.reminderTime.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return }
        let minutes = parts[0] * 60 + parts[1]
        func minute(_ value: String) -> Int { let parts = value.split(separator: ":").compactMap { Int($0) }; return parts.count == 2 ? parts[0] * 60 + parts[1] : 0 }
        let start = minute(prefs.quietStart), end = minute(prefs.quietEnd)
        let quiet = start == end ? false : start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
        guard !quiet else { return }
        let content = UNMutableNotificationContent(); content.title = "A little closer, every day"; content.body = "Share your daily moment in Together."; if prefs.sound { content.sound = .default }
        let trigger = UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: parts[0], minute: parts[1]), repeats: true)
        try await center.add(UNNotificationRequest(identifier: "together-daily", content: content, trigger: trigger))
    }
}

extension Reminders {
    static func schedule(event: Event, zone: String, prefs: Preferences) async throws {
        let center = UNUserNotificationCenter.current(); center.removePendingNotificationRequests(withIdentifiers: ["event-" + event.id])
        guard prefs.notifications && prefs.meetingAlerts && event.reminderDays >= 0 else { return }
        guard try await center.requestAuthorization(options: [.alert, .sound]) else { throw AppError(message: "Notification permission is off.") }
        let content = UNMutableNotificationContent(); content.title = event.title; content.body = event.destination.isEmpty ? "A little time together is coming." : event.destination; if prefs.sound { content.sound = .default }
        let day = Day.add(event.day, -event.reminderDays); let parts = (event.allDay ? prefs.reminderTime : event.time).split(separator: ":").compactMap { Int($0) }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: zone) ?? .gmt
        var components = calendar.dateComponents([.year, .month, .day], from: Day.date(day, zone: zone)); components.timeZone = calendar.timeZone; components.hour = parts.first ?? 9; components.minute = parts.last ?? 0
        if event.annual { components.year = nil }
        else if let date = calendar.date(from: components), date <= Date() { return }
        try await center.add(UNNotificationRequest(identifier: "event-" + event.id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: event.annual)))
    }
}
