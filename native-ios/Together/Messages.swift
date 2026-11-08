import SwiftUI

struct MessagesView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @StateObject private var recorder = VoiceRecorder()
    @State private var text = ""
    @State private var voice: Media?
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView { LazyVStack(spacing: 16) {
                if store.partner?.simulated == true { InfoBanner(text: "Alex is simulated. No message reaches a real person.") }
                if store.messages.isEmpty { ContentUnavailableView("Say something sweet", systemImage: "envelope", description: Text("Send a note, a kiss, or a little piece of your voice.")) }
                ForEach(store.messages) { note in
                    HStack { if note.sender == store.db.currentUser { Spacer(minLength: 40) }
                        VStack(alignment: .leading, spacing: 8) {
                            Text(note.sender == store.db.currentUser ? "You" : (store.partner?.name ?? "Partner") + (store.partner?.simulated == true ? " · simulated" : "")).font(.caption.bold()).foregroundStyle(.secondary)
                            if let media = note.media { MediaPreview(media: media) }
                            if !note.text.isEmpty { Text(note.text).font(note.kind == "affection" ? .largeTitle : .body) }
                            HStack { Text(note.created.formatted(date: .omitted, time: .shortened)).font(.caption2).foregroundStyle(.secondary); Spacer(); Text("Local").font(.caption2).foregroundStyle(.secondary); if !note.reactions.isEmpty { Text(note.reactions.values.sorted().joined()) } }
                        }.padding(16).frame(maxWidth: 310, alignment: .leading).background(note.sender == store.db.currentUser ? p.soft : p.surface, in: RoundedRectangle(cornerRadius: 20)).onTapGesture(count: 2) { store.reactMessage(note.id) }.contextMenu { Button("React ❤️") { store.reactMessage(note.id) } }
                        if note.sender != store.db.currentUser { Spacer(minLength: 40) }
                    }.id(note.id)
                }
            }.padding(20) }.background(p.background)
                .onChange(of: store.messages.count) { _, _ in if let id = store.messages.last?.id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } } }
                .onAppear { if let id = store.messages.last?.id { proxy.scrollTo(id, anchor: .bottom) } }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 12) {
                if let voice { HStack { MediaPreview(media: voice); Button("Remove") { self.voice = nil } } }
                HStack { ForEach(["😘", "🤗", "💭", "🫶"], id: \.self) { emoji in Button(emoji) { store.perform { try store.send(emoji, kind: "affection") } }.font(.title2).frame(maxWidth: .infinity) } }
                HStack(alignment: .bottom) {
                    Button { if recorder.recording { voice = recorder.stop() } else { Task { do { try await recorder.start() } catch { store.error = error.localizedDescription } } } } label: { Image(systemName: recorder.recording ? "stop.circle.fill" : "mic.circle").font(.title).foregroundStyle(recorder.recording ? .red : p.primary) }.accessibilityLabel(recorder.recording ? "Stop recording" : "Record voice note")
                    TextField(recorder.recording ? "Recording…" : "A little note…", text: $text, axis: .vertical).lineLimit(1...5).textFieldStyle(.soft)
                    Button { store.perform { try store.send(text, kind: voice == nil ? "text" : "voice", media: voice); text = ""; voice = nil } } label: { Image(systemName: "arrow.up.circle.fill").font(.title) }.accessibilityLabel("Send message").disabled(recorder.recording || (text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && voice == nil))
                }
            }.padding(16).background(.regularMaterial)
        }.navigationTitle("Messages").navigationBarTitleDisplayMode(.inline).onDisappear { if recorder.recording { recorder.cancel() } }
    }
}
