import SwiftUI
import PhotosUI

struct OnboardingView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @State private var preparingQuestions = false
    @State private var step = 0
    @State private var name = ""
    @State private var stage = "dating"
    @State private var start = Date()
    @State private var hasStart = false
    @State private var distance = "long_distance"
    @State private var auth = false
    @State private var authMode = "Sign in"
    @State private var photo: Media?
    @State private var photoItem: PhotosPickerItem?
    @FocusState private var editingName: Bool
    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                let compact = geometry.size.height < 670
                VStack(alignment: .leading, spacing: compact ? 12 : 20) {
                    if step != 4 {
                        HStack { Text("corasis").font(.headline); Spacer(); Text("\(step + 1) / 6").font(.caption).foregroundStyle(.secondary) }
                        ProgressView(value: Double(step + 1), total: 6)
                    }
                    if step == 0 {
                        heading("Choose your colors", subtitle: "A little space that feels like you.", compact: compact)
                        VStack(spacing: compact ? 6 : 10) {
                            ForEach(["pink", "purple", "red", "blue"], id: \.self) { theme in
                                let palette = Product.shared.palettes[theme]!
                                Button { store.db.prefs.theme = theme } label: {
                                    HStack(spacing: 14) { Circle().fill(Color(hex: palette.light["primary"]!)).frame(width: 30, height: 30); Text(palette.label).font(.headline); Spacer(); Image(systemName: store.db.prefs.theme == theme ? "checkmark.circle.fill" : "circle").foregroundStyle(p.primary) }.padding(.horizontal, 16).frame(minHeight: compact ? 48 : 64).background(p.surface, in: RoundedRectangle(cornerRadius: 18))
                                }.buttonStyle(.smooth)
                            }
                        }
                    } else if step == 1 {
                        heading(LocalizedStringKey(tr("A little closer,\nevery day.")), subtitle: "Small moments. More connection.", compact: compact)
                        VStack(spacing: 12) {
                            intro("flame.fill", title: "Share your day", caption: "A photo. A little moment.")
                            intro("bubble.left.and.bubble.right", title: "Talk & play", caption: "Discover each other.")
                            intro("heart.fill", title: "Keep your memories", caption: "Your favorite moments, together.")
                        }
                        Text("Personal answers stay private to you.").font(.caption).foregroundStyle(.secondary)
                    } else if step == 2 {
                        heading("What should we call you?", subtitle: editingName ? "" : "Just your first name.", compact: compact)
                        VStack(spacing: 10) {
                            PhotosPicker(selection: $photoItem, matching: .images) {
                                ZStack(alignment: .bottomTrailing) {
                                    Group {
                                        if let emoji = PresetAvatar.emoji(photo?.path) { Text(emoji).font(.system(size: editingName ? 34 : 56)) }
                                        else if let photo, let image = UIImage(contentsOfFile: MediaFiles.url(photo.path).path) { Image(uiImage: image).resizable().scaledToFill() }
                                        else { Image(systemName: "camera.fill").font(.system(size: editingName ? 22 : 32)).foregroundStyle(p.primary) }
                                    }
                                    .frame(width: editingName ? 64 : 104, height: editingName ? 64 : 104).background(p.soft).clipShape(Circle())
                                    .overlay(Circle().strokeBorder(p.primary, style: StrokeStyle(lineWidth: 2, dash: [6, 5])).opacity(photo == nil ? 1 : 0))
                                    Image(systemName: photo == nil ? "plus" : "pencil").font(.system(size: 13, weight: .heavy)).foregroundStyle(p.color("onPrimary")).frame(width: 30, height: 30).background(p.primary, in: Circle()).overlay(Circle().stroke(p.surface, lineWidth: 2))
                                }
                            }.buttonStyle(.smooth).accessibilityLabel(photo == nil ? "Add a profile photo" : "Change your photo")
                            if !editingName { PhotosPicker(selection: $photoItem, matching: .images) { Text(photo != nil && PresetAvatar.emoji(photo?.path) == nil ? "Change photo" : "Add your photo").font(.headline).foregroundStyle(p.primary) } }
                        }.frame(maxWidth: .infinity)
                        if !editingName {
                            Text("Or pick an avatar").font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                            LazyVGrid(columns: Array(repeating: GridItem(.fixed(48), spacing: 10), count: 6), spacing: 10) {
                                ForEach(PresetAvatar.all, id: \.self) { emoji in
                                    let value = "avatar:\(emoji)"; let on = photo?.path == value
                                    Button { photo = on ? nil : Media(path: value, kind: "photo") } label: {
                                        Text(emoji).font(.system(size: 26)).frame(width: 48, height: 48).background(p.soft, in: Circle()).overlay(Circle().stroke(on ? p.primary : .clear, lineWidth: 2))
                                    }.buttonStyle(.smooth).accessibilityLabel("Avatar \(emoji)").accessibilityAddTraits(on ? .isSelected : [])
                                }
                            }.frame(maxWidth: .infinity)
                        }
                        TextField("Your first name", text: $name).textContentType(.givenName).textFieldStyle(.soft).focused($editingName).submitLabel(.next).onSubmit { next() }
                    } else if step == 3 {
                        heading("The two of you", subtitle: "Optional. Edit these anytime.", compact: compact)
                        Card {
                            Picker("Relationship", selection: $stage) { ForEach(["dating", "committed", "engaged", "married", "other"], id: \.self) { Text($0.capitalized).tag($0) } }
                            Picker("Living", selection: $distance) { Text("Long distance").tag("long_distance"); Text("Nearby").tag("nearby") }
                            Toggle("Add your start date", isOn: $hasStart)
                            if hasStart { DatePicker("Together since", selection: $start, in: ...Date(), displayedComponents: .date).datePickerStyle(.compact) }
                        }
                    } else if step == 4 {
                        ConnectionQuestionsView(initial: store.db.connectionDraft?.answers ?? [:], finishTitle: "Continue", fitScreen: true, onDraft: { answers in store.perform { try store.saveConnectionDraft(answers) } }, onPrevious: { step = 3 }) { answers in
                            try store.saveConnectionDraft(answers, completed: true); authMode = tr("Sign up"); auth = true
                        }
                    } else {
                        heading("Ready, \(name.isEmpty ? "you" : name)?", subtitle: "Keep your preferences with an account.", compact: compact)
                        if let suggestion = store.db.connectionDraft?.suggestion {
                            Card { Text("\(suggestion.deck.emoji) \(suggestion.deck.title)").font(.headline); Text(suggestion.duration).font(.caption).foregroundStyle(.secondary) }
                        }
                        Text("Demo answers stay on this device.").font(.caption).foregroundStyle(.secondary)
                    }
                    if step != 4 {
                        Spacer(minLength: 0)
                        VStack(spacing: 6) {
                            Button { if step < 5 { next() } else { authMode = tr("Sign up"); auth = true } } label: {
                                Text(step < 5 ? "Continue" : "Continue with email").font(.headline).frame(maxWidth: .infinity, minHeight: compact ? 44 : 50).foregroundStyle(p.color("onPrimary")).background(p.primary, in: Capsule())
                            }.buttonStyle(.smooth)
                            if step == 5 { Button("Explore a demo") { exploreDemo() }.frame(maxWidth: .infinity, minHeight: 44) }
                            HStack {
                                if step > 0 { Button("Back") { editingName = false; step -= 1 }.frame(maxWidth: .infinity, minHeight: 44) }
                                if step == 0 { Button("Sign in") { authMode = "Sign in"; auth = true }.frame(maxWidth: .infinity, minHeight: 44) }
                            }
                            if step == 5 { Text("Answers sync after account verification.").font(.caption2).foregroundStyle(.secondary) }
                        }
                    }
                }.animation(AppMotion.transition(reduced: reducedMotion), value: step).animation(AppMotion.transition(reduced: reducedMotion), value: photo).animation(reducedMotion ? nil : .easeOut(duration: 0.25), value: editingName).padding(.horizontal, 20).padding(.vertical, compact ? 12 : 20).frame(maxWidth: 640, maxHeight: .infinity).frame(maxWidth: .infinity).foregroundStyle(p.text)
            }.disabled(preparingQuestions).accessibilityHidden(preparingQuestions)
                .overlay {
                    if preparingQuestions {
                        OnboardingPreparation()
                            .task {
                                do { try await Task.sleep(for: .milliseconds(Product.shared.onboardingTransition.durationMs)) } catch { return }
                                guard !Task.isCancelled else { return }
                                step = 4; preparingQuestions = false
                            }
                    }
                }.background(p.background).toolbar(.hidden, for: .navigationBar)
                .fullScreenCover(isPresented: $auth) { AuthView(initialName: name, initialAvatar: photo?.path, initialMode: authMode) }
                .onChange(of: photoItem) { _, item in guard let item else { return }; Task { do { photo = try await MediaFiles.load(item) } catch { store.error = error.localizedDescription } } }
        }
    }
    func heading(_ title: LocalizedStringKey, subtitle: LocalizedStringKey?, compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) { Text(title).font(.system(size: compact ? 26 : 32, weight: .bold, design: .rounded)).fixedSize(horizontal: false, vertical: true); if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(.secondary) } }
    }
    func intro(_ icon: String, title: LocalizedStringKey, caption: LocalizedStringKey) -> some View {
        HStack(spacing: 14) { Image(systemName: icon).font(.title2).foregroundStyle(p.primary).frame(width: 40); VStack(alignment: .leading, spacing: 2) { Text(title).font(.headline); Text(caption).font(.caption).foregroundStyle(.secondary) }; Spacer() }.padding(14).background(p.surface, in: RoundedRectangle(cornerRadius: 18))
    }
    func next() { guard step != 2 || !name.trimmingCharacters(in: .whitespaces).isEmpty else { store.error = tr("Enter your first name."); return }; editingName = false; guard !preparingQuestions else { return }; if step == 3 { preparingQuestions = true } else { step += 1 } }
    func exploreDemo() {
        store.demo(name: name)
        if let photo, let i = store.db.people.firstIndex(where: { $0.id == "demo-me" }) { store.db.people[i].avatar = photo.path }
        if var c = store.couple { c.stage = stage; c.distance = distance; if hasStart { c.start = Day.key(start, zone: c.timezone) }; store.saveCouple(c) }
    }
}
/// Passwordless email flow for sign-in and sign-up: email → 6-digit code from InsForge → signed in.
struct AuthView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    var initialName = ""
    var initialAvatar: String?
    var initialMode = "Sign in"
    @Environment(\.appPalette) private var p
    @State private var mode = "Sign in"
    @State private var email = ""
    @State private var code = ""
    @State private var sentTo: String?
    @State private var demoCode: String?
    @State private var busy = false
    @State private var notice = ""
    @State private var socialBusy: String?
    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        if let sentTo { codeStep(sentTo) } else { emailStep }
                        PrivacyFold(note: Product.shared.accountCreation.privacyNote)
                    }.padding(24).background(p.surface, in: RoundedRectangle(cornerRadius: 30)).shadow(color: p.primary.opacity(0.12), radius: 22, y: 12)
                        .frame(maxWidth: 480).padding(20).frame(maxWidth: .infinity, minHeight: geometry.size.height)
                }.background(p.soft).foregroundStyle(p.text)
            }
            .scrollDismissesKeyboard(.interactively)
            .animation(.easeOut(duration: 0.2), value: sentTo)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .onAppear { mode = initialMode }
        }
    }
    @ViewBuilder var emailStep: some View {
        let si = Product.shared.signIn
        VStack(alignment: .leading, spacing: 8) {
            Text(si.title).font(.system(size: 28, weight: .bold, design: .rounded))
            Text(si.subtitle).foregroundStyle(.secondary)
        }
        PillField(icon: "envelope", placeholder: si.emailPlaceholder, text: $email, content: .emailAddress).submitLabel(.next).onSubmit { send() }
        if !notice.isEmpty { Text(notice).font(.caption).foregroundStyle(p.color("danger")) }
        PrimaryButton(title: busy ? "Please wait…" : si.action) { send() }.disabled(busy || email.trimmingCharacters(in: .whitespaces).isEmpty)
        SocialButtons(busy: socialBusy) { social($0) }
    }
    @ViewBuilder func codeStep(_ address: String) -> some View {
        let c = Product.shared.emailCode
        VStack(alignment: .leading, spacing: 8) {
            Text(c.title).font(.system(size: 28, weight: .bold, design: .rounded))
            Text(c.subtitle.replacingOccurrences(of: "{email}", with: address)).foregroundStyle(.secondary)
        }
        if let demoCode { InfoBanner(text: c.demo.replacingOccurrences(of: "{code}", with: demoCode)) }
        PillField(icon: "number", placeholder: c.placeholder, text: $code, content: .oneTimeCode).keyboardType(.numberPad).submitLabel(.go).onSubmit { verify() }
            .onChange(of: code) { _, v in let digits = String(v.filter(\.isNumber).prefix(6)); if digits != v { code = digits; return }; notice = ""; if digits.count == 6 { verify() } }
        if !notice.isEmpty { Text(notice).font(.caption).foregroundStyle(p.color("danger")) }
        PrimaryButton(title: busy ? "Please wait…" : c.action) { verify() }.disabled(busy || code.count < 6)
        HStack {
            Button(c.change) { sentTo = nil; code = ""; notice = "" }.frame(minHeight: 44)
            Spacer()
            Button(c.resend) { send(again: true) }.frame(minHeight: 44)
        }.font(.subheadline.weight(.semibold)).foregroundStyle(p.primary)
    }
    func send(again: Bool = false) {
        guard !busy else { return }; notice = ""; busy = true
        let target = again ? (sentTo ?? email) : email
        Task {
            do { demoCode = try await store.sendEmailCode(target); sentTo = target.trimmingCharacters(in: .whitespaces).lowercased(); if again { notice = "" } }
            catch { notice = error.localizedDescription }
            busy = false
        }
    }
    func verify() {
        guard !busy, let sentTo else { return }; notice = ""; busy = true
        Task {
            do { try await store.verifyEmailCode(email: sentTo, code: code, name: initialName, avatar: initialAvatar); dismiss() }
            catch { notice = error.localizedDescription }
            busy = false
        }
    }
    func social(_ provider: String) {
        guard socialBusy == nil else { return }; notice = ""; socialBusy = provider
        Task {
            do { if try await store.logIn(provider: provider) { store.db.onboarded = true; dismiss() } }
            catch { notice = error.localizedDescription }
            socialBusy = nil
        }
    }
}
struct PillField: View {
    @Environment(\.appPalette) private var p
    @FocusState private var focused: Bool
    var icon: String; var placeholder: String; @Binding var text: String; var content: UITextContentType; var secure = false
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(.secondary).frame(width: 20)
            Group { if secure { SecureField(placeholder, text: $text) } else { TextField(placeholder, text: $text).keyboardType(content == .emailAddress ? .emailAddress : .default).textInputAutocapitalization(.never).autocorrectionDisabled() } }
                .textContentType(content).font(.system(size: 17)).tint(p.primary).focused($focused)
        }.padding(.horizontal, 18).frame(minHeight: 56).background(p.surface, in: Capsule())
            .overlay(Capsule().stroke(focused ? p.primary : p.color("border"), lineWidth: focused ? 2 : 1.5))
            .contentShape(Capsule()).onTapGesture { focused = true }
    }
}
struct AuthSwitchLine: View {
    @Environment(\.appPalette) private var p
    var prompt: String; var action: String; var onTap: () -> Void
    var body: some View {
        Button(action: onTap) { (Text(prompt + " ").foregroundStyle(.secondary) + Text(action).bold().foregroundStyle(p.text)).frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.smooth)
    }
}
struct SocialButtons: View {
    @Environment(\.appPalette) private var p
    var busy: String? = nil
    var onTap: (String) -> Void
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) { Rectangle().fill(p.color("border")).frame(height: 1); Text("or continue with").foregroundStyle(.secondary).fixedSize(); Rectangle().fill(p.color("border")).frame(height: 1) }.padding(.vertical, 4)
            pill("Google", dark: false) { Text("G").font(.system(size: 20, weight: .heavy, design: .rounded)).foregroundStyle(Color(red: 0.92, green: 0.26, blue: 0.21)) }
            pill("Apple", dark: true) { Image(systemName: "apple.logo").font(.system(size: 20)).foregroundStyle(.white) }
        }
    }
    func pill<Icon: View>(_ name: String, dark: Bool, tint: Color? = nil, @ViewBuilder icon: () -> Icon) -> some View {
        Button { onTap(name) } label: {
            HStack(spacing: 10) { if busy == name { ProgressView().tint(dark ? .white : .secondary) } else { icon() }; Text(name).font(.system(size: 17, weight: .bold)).foregroundStyle(dark ? .white : tint ?? p.text) }
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(dark ? Color.black : p.surface, in: Capsule())
                .overlay(Capsule().stroke(dark ? .clear : p.color("border"), lineWidth: 1.5))
        }.buttonStyle(.smooth).disabled(busy != nil).accessibilityLabel("Continue with \(name)")
    }
}
struct PrivacyFold: View {
    @Environment(\.appPalette) private var p
    var note: String
    @State private var open = false
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider()
            Button { withAnimation(.easeOut(duration: 0.2)) { open.toggle() } } label: {
                HStack { Text("Privacy & Terms").font(.subheadline.bold()); Spacer(); Image(systemName: "chevron.down").font(.caption).rotationEffect(.degrees(open ? 180 : 0)) }.frame(minHeight: 44).contentShape(Rectangle())
            }.foregroundStyle(.secondary).accessibilityValue(open ? "Expanded" : "Collapsed")
            Text(note).font(.caption).foregroundStyle(.secondary)
            if open { NavigationLink("Read the full Privacy & Terms") { PrivacyView() }.font(.caption.weight(.semibold)).foregroundStyle(p.primary).frame(minHeight: 44) }
        }
    }
}
/// Shown once after sign-in, before home: invite a partner or enter their code. Skippable.
struct PartnerStepView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) private var p
    var body: some View {
        NavigationStack {
            PartnerSettings()
                .navigationTitle("Connect your partner")
                .safeAreaInset(edge: .bottom) {
                    Button("I'll invite them later") { store.db.partnerStepDone = true }
                        .font(.headline).foregroundStyle(p.primary).frame(maxWidth: .infinity, minHeight: 50)
                        .background(p.background.opacity(0.95))
                }
        }
    }
}
struct VerificationView: View {
    @EnvironmentObject var store: Store
    @State private var code = ""
    var body: some View { NavigationStack { Page { Text("Check your code").font(.largeTitle.bold()); InfoBanner(text: store.isRemoteAccount ? "We emailed a 6-digit code to \(store.db.accounts.first { $0.id == store.db.currentUser }?.email ?? "your address")." : "Local preview: no email is sent. Your verification code is \(store.db.accounts.first { $0.id == store.db.currentUser }?.code ?? "")."); TextField("Six digit code", text: $code).keyboardType(.numberPad).textFieldStyle(.soft); PrimaryButton(title: tr("Verify account")) { Task { await store.performAsync { try await store.verifyAccount(code); store.db.onboarded = true } } }; Button(store.isRemoteAccount ? "Resend the code" : "Generate a new code") { Task { await store.performAsync { try await store.resendVerification() } } }; Button("Sign out") { store.signOut() } } } }
}
