import SwiftUI

struct MemoriesView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var search = ""
    @State private var filter = "All"
    @State private var create = false
    @State private var selectedDate = Date()
    @State private var calendar = false
    var items: [Memory] { store.memories.filter { memory in
        let kind = memory.media?.kind ?? "letter"
        return (filter == "All" || filter == "Favorites" && memory.favorites.contains(store.db.currentUser ?? "") || filter.lowercased() == kind) && (search.isEmpty || (memory.title + memory.body).localizedCaseInsensitiveContains(search)) && (!calendar || memory.day == Day.key(selectedDate, zone: store.couple?.timezone ?? "UTC"))
    } }
    var body: some View { Page {
        HStack { Text("Little things, kept.").font(.title2.bold()); Spacer(); Button { create = true } label: { Image(systemName: "plus.circle.fill").font(.title) }.accessibilityLabel("Add memory") }
        TextField("Search memories", text: $search).textFieldStyle(.soft)
        ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(["All", "Favorites", "Photo", "Video", "Voice", "Letter"], id: \.self) { value in Button(LocalizedStringKey(value)) { filter = value }.buttonStyle(.bordered).tint(filter == value ? p.primary : .secondary) } } }
        Toggle("Browse by date", isOn: $calendar)
        if calendar { DatePicker("Date", selection: $selectedDate, displayedComponents: .date).datePickerStyle(.graphical) }
        if items.isEmpty { ContentUnavailableView("Make a memory", systemImage: "photo.on.rectangle.angled", description: Text("Keep a photo, a video, a voice note, or a letter in your private album.")) }
        ForEach(items) { memory in NavigationLink { MemoryDetail(id: memory.id) } label: { Card {
            if let media = memory.media, media.kind == "photo", let image = UIImage(contentsOfFile: MediaFiles.url(media.path).path) { Image(uiImage: image).resizable().scaledToFill().frame(height: 200).clipped().clipShape(RoundedRectangle(cornerRadius: 14)) }
            HStack { VStack(alignment: .leading, spacing: 4) { Text(memory.title.isEmpty ? tr("A little moment") : memory.title).font(.headline); Text(Day.label(memory.day)).font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: memory.media?.kind == "video" ? "play.circle" : memory.media?.kind == "voice" ? "waveform" : memory.media == nil ? "envelope" : "photo").foregroundStyle(.tint); if memory.favorites.contains(store.db.currentUser ?? "") { Image(systemName: "heart.fill").foregroundStyle(.tint) } }
            if memory.media == nil { Text(memory.body).font(.subheadline).foregroundStyle(.secondary).lineLimit(3) }
        } }.buttonStyle(.smooth) }
    }.navigationTitle("Memories").sheet(isPresented: $create) { NavigationStack { MemoryEditor() } } }
}
struct MemoryDetail: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    var id: String
    @State private var editing = false
    @State private var deleting = false
    var memory: Memory? { store.memories.first { $0.id == id } }
    var body: some View { Page {
        if let memory { Text(memory.title.isEmpty ? tr("A little moment") : memory.title).font(.largeTitle.bold()); Text(Day.label(memory.day)).foregroundStyle(.secondary); if let media = memory.media { MediaPreview(media: media) }; if !memory.body.isEmpty { Card { Text(memory.body).font(.body).lineSpacing(6) } }; Text("By \(store.db.people.first { $0.id == memory.owner }.map { $0.name + ($0.simulated ? " · simulated" : "") } ?? "you")").font(.caption).foregroundStyle(.secondary)
            Button { store.favoriteMemory(id) } label: { Label(memory.favorites.contains(store.db.currentUser ?? "") ? "Remove favorite" : "Favorite", systemImage: memory.favorites.contains(store.db.currentUser ?? "") ? "heart.fill" : "heart") }
            if let media = memory.media { ShareLink(item: MediaFiles.url(media.path)) { Label("Share media", systemImage: "square.and.arrow.up") } }
            if memory.owner == store.db.currentUser { Button("Edit memory") { editing = true }; Button("Delete memory", role: .destructive) { deleting = true } }
        } else { ContentUnavailableView("Memory unavailable", systemImage: "photo") }
    }.navigationTitle("Memory").navigationBarTitleDisplayMode(.inline).sheet(isPresented: $editing) { NavigationStack { MemoryEditor(existing: memory) } }
        .confirmationDialog("Delete this memory? A linked daily moment will also be removed and may change your flame.", isPresented: $deleting, titleVisibility: .visible) { Button("Delete memory", role: .destructive) { store.deleteMemory(id); dismiss() } }
    }
}
struct MemoryEditor: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @StateObject private var recorder = VoiceRecorder()
    var existing: Memory?
    @State private var kind = "Letter"
    @State private var title = ""
    @State private var bodyText = ""
    @State private var date = Date()
    @State private var media: Media?
    var body: some View { Page {
        Picker("Memory type", selection: $kind) { Text("Letter").tag("Letter"); Text("Photo / video").tag(tr("Media")); Text("Voice").tag("Voice") }.pickerStyle(.segmented).disabled(existing?.momentID != nil)
        Card { TextField("Title", text: $title).textFieldStyle(.soft); DatePicker("Taken on", selection: $date, displayedComponents: .date)
            if kind == "Media" { MediaChooser(media: $media) }
            else if kind == "Voice" { if let media { MediaPreview(media: media) }; Button(recorder.recording ? "Stop recording" : "Record voice note") { if recorder.recording { media = recorder.stop() } else { Task { do { try await recorder.start() } catch { store.error = error.localizedDescription } } } } }
            TextField(kind == "Letter" ? "Write your letter…" : "Caption", text: $bodyText, axis: .vertical).lineLimit(5...16).textFieldStyle(.soft)
        }
        PrimaryButton(title: tr("Save memory")) { store.perform {
            let c = try store.requireCouple(); guard let user = store.db.currentUser else { return }
            if kind == "Letter" && bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { throw AppError(message: "Write something in your letter.") }
            if kind != "Letter" && media == nil { throw AppError(message: "Choose or record media first.") }
            var memory = existing ?? Memory(coupleID: c.id, owner: user, title: "", body: "", day: store.today)
            memory.title = title; memory.body = bodyText; memory.day = Day.key(date, zone: c.timezone); memory.media = kind == "Letter" ? nil : media
            try store.saveMemory(memory); dismiss()
        } }.disabled(recorder.recording)
    }.navigationTitle(existing == nil ? "New memory" : "Edit memory").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }.onAppear { if let existing { title = existing.title; bodyText = existing.body; date = Day.date(existing.day, zone: store.couple?.timezone ?? "UTC"); media = existing.media; kind = existing.media?.kind == "voice" ? "Voice" : existing.media == nil ? "Letter" : tr("Media") } }.onDisappear { if recorder.recording { recorder.cancel() } } }
}
