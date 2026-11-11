import SwiftUI

// MARK: - Bubble Shape

struct MessageBubble: Shape {
    var mine: Bool
    func path(in rect: CGRect) -> Path {
        let r: CGFloat = 18
        let tail: CGFloat = 6
        var p = Path()
        if mine {
            p.move(to: CGPoint(x: rect.minX, y: rect.minY + r))
            p.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.minY), tangent2End: CGPoint(x: rect.minX + r, y: rect.minY), radius: r)
            p.addLine(to: CGPoint(x: rect.maxX - r - tail, y: rect.minY))
            p.addArc(tangent1End: CGPoint(x: rect.maxX - tail, y: rect.minY), tangent2End: CGPoint(x: rect.maxX - tail, y: rect.minY + r), radius: r)
            p.addLine(to: CGPoint(x: rect.maxX - tail, y: rect.maxY - r))
            p.addArc(tangent1End: CGPoint(x: rect.maxX - tail, y: rect.maxY), tangent2End: CGPoint(x: rect.maxX - tail - r, y: rect.maxY), radius: r)
            p.addLine(to: CGPoint(x: rect.maxX - tail, y: rect.maxY))
            p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.maxY + 4), control: CGPoint(x: rect.maxX - 2, y: rect.maxY))
            p.addQuadCurve(to: CGPoint(x: rect.maxX - tail - 8, y: rect.maxY), control: CGPoint(x: rect.maxX - tail + 2, y: rect.maxY + 4))
            p.addLine(to: CGPoint(x: rect.minX + r, y: rect.maxY))
            p.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.maxY - r), radius: r)
            p.closeSubpath()
        } else {
            p.move(to: CGPoint(x: rect.maxX, y: rect.minY + r))
            p.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.minY), tangent2End: CGPoint(x: rect.maxX - r, y: rect.minY), radius: r)
            p.addLine(to: CGPoint(x: rect.minX + r + tail, y: rect.minY))
            p.addArc(tangent1End: CGPoint(x: rect.minX + tail, y: rect.minY), tangent2End: CGPoint(x: rect.minX + tail, y: rect.minY + r), radius: r)
            p.addLine(to: CGPoint(x: rect.minX + tail, y: rect.maxY - r))
            p.addArc(tangent1End: CGPoint(x: rect.minX + tail, y: rect.maxY), tangent2End: CGPoint(x: rect.minX + tail + r, y: rect.maxY), radius: r)
            p.addLine(to: CGPoint(x: rect.minX + tail, y: rect.maxY))
            p.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY + 4), control: CGPoint(x: rect.minX + 2, y: rect.maxY))
            p.addQuadCurve(to: CGPoint(x: rect.minX + tail + 8, y: rect.maxY), control: CGPoint(x: rect.minX + tail - 2, y: rect.maxY + 4))
            p.addLine(to: CGPoint(x: rect.maxX - r, y: rect.maxY))
            p.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.maxY), tangent2End: CGPoint(x: rect.maxX, y: rect.maxY - r), radius: r)
            p.closeSubpath()
        }
        return p
    }
}

// MARK: - Time Grouping

private func shouldShowTimestamp(_ messages: [Note], at index: Int) -> Bool {
    guard index > 0 else { return true }
    return messages[index].created.timeIntervalSince(messages[index - 1].created) > 300
}

private func shouldShowTail(_ messages: [Note], at index: Int) -> Bool {
    guard index < messages.count - 1 else { return true }
    let current = messages[index]
    let next = messages[index + 1]
    return current.sender != next.sender || next.created.timeIntervalSince(current.created) > 300
}

// MARK: - Message Row

struct MessageRow: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    let note: Note
    let isMine: Bool
    let showTail: Bool
    let partnerName: String

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            if isMine { Spacer(minLength: 60) }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 2) {
                if let media = note.media { MediaPreview(media: media) }
                if !note.text.isEmpty {
                    if note.kind == "affection" {
                        Text(note.text).font(.system(size: 42))
                            .padding(.horizontal, 4).padding(.vertical, 2)
                    } else {
                        Text(note.text)
                            .font(.body)
                            .foregroundStyle(isMine ? .white : p.text)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(isMine ? p.primary : p.surface, in: showTail ? MessageBubble(mine: isMine) : MessageBubble(mine: isMine))
                    }
                }
                if !note.reactions.isEmpty {
                    Text(note.reactions.values.sorted().joined())
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.ultraThinMaterial, in: Capsule())
                        .offset(y: -4)
                }
            }
            if !isMine { Spacer(minLength: 60) }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, showTail ? 4 : 1)
        .onTapGesture(count: 2) { store.reactMessage(note.id) }
        .contextMenu {
            Button("React ❤️") { store.reactMessage(note.id) }
        }
    }
}

// MARK: - Messages View

struct MessagesView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @StateObject private var recorder = VoiceRecorder()
    @State private var text = ""
    @State private var voice: Media?

    private var partnerName: String { store.partner?.name ?? tr("Partner") }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if store.partner?.simulated == true {
                        InfoBanner(text: tr("Alex is simulated. No message reaches a real person."))
                            .padding(.horizontal, 16).padding(.top, 8)
                    }
                    if store.messages.isEmpty {
                        ContentUnavailableView("Say something sweet", systemImage: "envelope", description: Text("Send a note, a kiss, or a little piece of your voice."))
                            .padding(.top, 60)
                    }
                    ForEach(Array(store.messages.enumerated()), id: \.element.id) { index, note in
                        let isMine = note.sender == store.db.currentUser
                        let showTime = shouldShowTimestamp(store.messages, at: index)
                        let showTail = shouldShowTail(store.messages, at: index)

                        if showTime {
                            Text(note.created, style: .relative)
                                .font(.caption2).fontWeight(.medium)
                                .foregroundStyle(.secondary)
                                .padding(.vertical, 8)
                        }

                        MessageRow(note: note, isMine: isMine, showTail: showTail, partnerName: partnerName)
                            .id(note.id)
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 8)
            }
            .background(p.background)
            .onChange(of: store.messages.count) { _, _ in
                if let id = store.messages.last?.id {
                    withAnimation { proxy.scrollTo(id, anchor: .bottom) }
                }
            }
            .onAppear {
                if let id = store.messages.last?.id {
                    proxy.scrollTo(id, anchor: .bottom)
                }
            }
        }
        .safeAreaInset(edge: .bottom) { inputBar }
        .navigationTitle(partnerName + (store.partner?.simulated == true ? tr(" · simulated") : ""))
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { if recorder.recording { recorder.cancel() } }
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        VStack(spacing: 8) {
            if let voice {
                HStack {
                    MediaPreview(media: voice)
                    Spacer()
                    Button { self.voice = nil } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 16)
            }
            HStack(alignment: .bottom, spacing: 8) {
                Menu {
                    ForEach(["😘", "🤗", "💭", "🫶"], id: \.self) { emoji in
                        Button(emoji) {
                            store.perform { try store.send(emoji, kind: "affection") }
                        }
                    }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }

                Button {
                    if recorder.recording {
                        voice = recorder.stop()
                    } else {
                        Task { do { try await recorder.start() } catch { store.error = error.localizedDescription } }
                    }
                } label: {
                    Image(systemName: recorder.recording ? "stop.circle.fill" : "mic.circle.fill")
                        .font(.title2)
                        .foregroundStyle(recorder.recording ? .red : .secondary)
                }
                .accessibilityLabel(recorder.recording ? "Stop recording" : "Record voice note")

                TextField("iMessage", text: $text, axis: .vertical)
                    .lineLimit(1...5)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(p.surface, in: Capsule())

                Button {
                    store.perform {
                        try store.send(text, kind: voice == nil ? "text" : "voice", media: voice)
                        text = ""
                        voice = nil
                    }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title)
                        .foregroundStyle(canSend ? p.primary : Color.secondary.opacity(0.4))
                }
                .disabled(!canSend)
                .accessibilityLabel("Send message")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(.regularMaterial)
    }

    private var canSend: Bool {
        !recorder.recording && (!text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || voice != nil)
    }
}
