import SwiftUI
import Photos

struct WidgetsView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var message = ""
    var body: some View { Page {
        InfoBanner(text: "These are in-app widget previews. Home Screen and Lock Screen installation requires a WidgetKit extension and App Group, which are not configured in this preview.")
        Card { Text("PARTNER MESSAGE").font(.caption.bold()).foregroundStyle(p.primary); Text(store.db.widgetMessages[store.couple?.id ?? ""] ?? "A little closer, every day 💕").font(.title2.bold()); Text(store.me?.name ?? "You").font(.caption).foregroundStyle(.secondary) }
        Card { HStack { VStack(alignment: .leading) { Text("🔥 Daily flame").font(.headline); Text("\(store.streak.current) days").font(.largeTitle.bold()) }; Spacer(); if let event = store.nextEvent { VStack { Text("\(Day.distance(store.today, event.day))").font(.largeTitle.bold()); Text("days to go").font(.caption) } } } }
        Card { Text("A note for your shared space").font(.headline); TextField("A little message (120 characters)", text: $message, axis: .vertical).lineLimit(2...4).textFieldStyle(.soft); PrimaryButton(title: "Save widget message") { store.perform { let c = try store.requireCouple(); guard message.count <= 120, !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw AppError(message: "Write a message of 1–120 characters.") }; store.db.widgetMessages[c.id] = message } } }
        Card { RowLink(title: "Create a wallpaper", icon: "photo.artframe", detail: "Your names, your colors, your little world") { WallpaperView() } }
    }.navigationTitle("Widgets & wallpaper").navigationBarTitleDisplayMode(.inline).onAppear { message = store.db.widgetMessages[store.couple?.id ?? ""] ?? "" } }
}
struct WallpaperView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @Environment(\.displayScale) var displayScale
    @State private var style = "Gradient"
    @State private var names = true
    @State private var date = true
    @State private var quote = ""
    @State private var photo: Media?
    @State private var exported: URL?
    @State private var notice = ""
    var body: some View { Page {
        wallpaper.frame(width: 260, height: 540).clipShape(RoundedRectangle(cornerRadius: 32)).frame(maxWidth: .infinity)
        Card {
            Picker("Style", selection: $style) { Text("Gradient").tag("Gradient"); Text("Photo").tag("Photo"); Text("Minimal").tag("Minimal") }.pickerStyle(.segmented)
            if style == "Photo" { MediaChooser(media: $photo, photosOnly: true) }
            Toggle("Show names", isOn: $names); Toggle("Show relationship date", isOn: $date)
            TextField("Quote (up to 80 characters)", text: $quote).textFieldStyle(.soft).onChange(of: quote) { _, value in if value.count > 80 { quote = String(value.prefix(80)) } }
        }
        PrimaryButton(title: "Export wallpaper") { export() }
        if let exported { ShareLink(item: exported) { Label("Share image", systemImage: "square.and.arrow.up") }; Button("Save to Photos") { saveToPhotos(exported) } }
        if !notice.isEmpty { InfoBanner(text: notice) }
        Text("After saving, choose the image in iOS Settings → Wallpaper. Apps cannot set your wallpaper directly.").font(.caption).foregroundStyle(.secondary)
    }.navigationTitle("Wallpaper").navigationBarTitleDisplayMode(.inline) }
    var wallpaper: some View {
        ZStack {
            if style == "Photo", let photo, let image = UIImage(contentsOfFile: MediaFiles.url(photo.path).path) { Image(uiImage: image).resizable().scaledToFill(); Color.black.opacity(0.3) }
            else if style == "Minimal" { p.background }
            else { p.gradient }
            VStack(spacing: 12) {
                Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day())).font(.system(size: 12, weight: .medium)).padding(.top, 62)
                Text("09:41").font(.system(size: 64, weight: .light, design: .rounded))
                Spacer(); Image(systemName: "heart.fill").font(.system(size: 36)).opacity(0.85); Spacer()
                VStack(spacing: 8) { if names { Text("\(store.me?.name ?? "You") & \(store.partner?.name ?? "Partner")").font(.system(size: 22, weight: .bold, design: .rounded)) }; if date, let start = store.couple?.start { Text("\(Day.distance(start, store.today)) days together").font(.system(size: 12)) }; if !quote.isEmpty { Text("“\(quote)”").font(.system(size: 14, design: .serif)).italic().multilineTextAlignment(.center) } }.padding(20).frame(maxWidth: .infinity).background((style == "Minimal" ? p.soft : Color.black.opacity(0.22)), in: RoundedRectangle(cornerRadius: 18)).padding(18).padding(.bottom, 28)
            }
        }.foregroundStyle(style == "Minimal" ? p.text : .white).clipped()
    }
    func export() { store.perform { let renderer = ImageRenderer(content: wallpaper.frame(width: 390, height: 844)); renderer.scale = 3; guard let image = renderer.uiImage, let data = image.pngData() else { throw AppError(message: "The wallpaper could not be rendered.") }; let url = FileManager.default.temporaryDirectory.appendingPathComponent("together-wallpaper.png"); try data.write(to: url); exported = url; notice = "Your wallpaper is ready to share or save." } }
    func saveToPhotos(_ url: URL) { Task { guard await PermissionGate.shared.ask(.photos) else { return }; let permission = await PHPhotoLibrary.requestAuthorization(for: .addOnly); guard permission == .authorized || permission == .limited else { store.error = "Photo library access is disabled. Use Share image to save another way."; return }; do { try await PHPhotoLibrary.shared().performChanges { PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: url) }; notice = "Saved to Photos. Choose it in Settings → Wallpaper." } catch { store.error = error.localizedDescription } } }
}
