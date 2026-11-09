import SwiftUI

struct ActivitiesView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var search = ""
    @State private var category = ""
    var filtered: [Deck] { Product.shared.decks.filter { (category.isEmpty || $0.category == category) && (search.isEmpty || ($0.title + $0.description).localizedCaseInsensitiveContains(search)) } }
    var body: some View { Page {
        Card { RowLink(title: "Messages & affection", icon: "envelope", detail: "Kisses, hugs, notes and voice notes") { MessagesView() } }
        NavigationLink { GamesView() } label: { HStack(spacing: 14) { Text("🎮").font(.title2).frame(width: 48, height: 48).background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 16)); VStack(alignment: .leading, spacing: 3) { Text("Games for two").font(.headline); Text("Draw, puzzle and duel, one turn at a time").font(.caption).opacity(0.7) }; Spacer(); Text("NEW").font(.caption.bold()) }.foregroundStyle(.white).padding(16).frame(maxWidth: .infinity).background(Color(hex: "#15101A"), in: RoundedRectangle(cornerRadius: 24)) }.buttonStyle(.smooth).accessibilityLabel("Games")
        NavigationLink { DailyQuestionView() } label: { Card { Text("DAILY QUESTION").font(.caption.bold()).foregroundStyle(.tint); Text(Product.shared.daily(store.today).text).font(.title3.bold()); Text("Answer separately. Reveal together.").font(.caption).foregroundStyle(.secondary) } }.buttonStyle(.smooth)
        HStack { SectionHeading(title: "Conversation decks"); Spacer(); NavigationLink("History") { ActivityHistoryView() } }
        TextField("Search decks", text: $search).textFieldStyle(.soft)
        ScrollView(.horizontal, showsIndicators: false) { HStack { categoryButton("", label: "All"); ForEach(Product.shared.categoryMeta.keys.sorted(), id: \.self) { key in let c = Product.shared.categoryMeta[key]!; categoryButton(key, label: "\(c.emoji) \(c.label)") } } }
        ForEach(filtered) { deck in NavigationLink { DeckView(deck: deck) } label: { Card { HStack(spacing: 14) { Text(deck.emoji).font(.largeTitle); VStack(alignment: .leading, spacing: 5) { Text(deck.title).font(.headline); Text(deck.description).font(.subheadline).foregroundStyle(.secondary); Text("\(deck.questionIds.count) prompts\(deck.premium ? " · Plus" : "")").font(.caption).foregroundStyle(.tint) }; Spacer() } } }.buttonStyle(.smooth) }
        if filtered.isEmpty { ContentUnavailableView.search(text: search) }
        NavigationLink("Favorite questions") { FavoriteQuestionsView() }
    }.navigationTitle("Together") }
    func categoryButton(_ value: String, label: String) -> some View { Button(label) { category = value }.buttonStyle(.bordered).tint(category == value ? p.primary : .secondary) }
}
struct DeckView: View {
    @EnvironmentObject var store: Store
    var deck: Deck
    @State private var session: String?
    var body: some View { Page { Text(deck.emoji).font(.system(size: 60)); Text(deck.description).font(.title3).foregroundStyle(.secondary)
        if deck.premium && !store.db.prefs.premium { InfoBanner(text: "Enable the Together Plus demo switch in Profile to try this deck. There is no purchase or subscription.") }
        ForEach(deck.questionIds, id: \.self) { id in if let q = Product.shared.question(id) { Card { Text(q.text).font(.headline); HStack { Button("Answer together") { store.perform { session = try store.startActivity(question: q, deck: deck) } }; Spacer(); Button { store.favoriteQuestion(id) } label: { Image(systemName: (store.db.favorites[store.db.currentUser ?? ""] ?? []).contains(id) ? "heart.fill" : "heart") }.accessibilityLabel("Favorite question") } } } }
    }.navigationTitle(deck.title).navigationBarTitleDisplayMode(.inline).navigationDestination(item: $session) { SessionView(id: $0) } }
}
struct DailyQuestionView: View {
    @EnvironmentObject var store: Store
    @State private var session: String?
    var body: some View { Group { if let session { SessionView(id: session) } else { Page { Text(Product.shared.daily(store.today).text).font(.title.bold()); Text("Both answers stay hidden until you each submit.").foregroundStyle(.secondary); PrimaryButton(title: "Start today's question") { start() } } } }.navigationTitle("Daily question").navigationBarTitleDisplayMode(.inline).onAppear { if store.partner != nil { start() } } }
    func start() { store.perform { session = try store.startActivity(question: Product.shared.daily(store.today), deck: Product.shared.decks.first { $0.id == "deck_daily" }!, daily: true) } }
}
struct SessionView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    var id: String
    @State private var answer = ""
    @State private var comment = ""
    @State private var photo: Media?
    @State private var abandon = false
    var activity: Activity? { store.activity(id) }
    var question: Question? { activity.flatMap { Product.shared.question($0.questionID) } }
    var ownAnswer: Answer? { activity?.answers.first { $0.userID == store.db.currentUser } }
    var body: some View { Page {
        if let activity, let q = question {
            Text(q.text).font(.system(size: 28, weight: .bold, design: .rounded))
            if q.aboutPartner == true { InfoBanner(text: "Guess your partner’s answer. Quiz scores are just for fun.") }
            if activity.revealed(members: store.couple?.members ?? []) {
                InfoBanner(text: "Both answers are in. Your answers are now locked.", icon: "lock.open")
                ForEach(activity.visibleAnswers(viewer: store.db.currentUser ?? "", members: store.couple?.members ?? []), id: \.userID) { submission in Card {
                    Text(store.db.people.first { $0.id == submission.userID }.map { $0.name + ($0.simulated ? " · simulated" : "") } ?? "Partner").font(.headline)
                    if submission.skipped { Text("Skipped this question").foregroundStyle(.secondary) }
                    else if submission.text.hasPrefix("media:"), let media = decodeMedia(submission.text) { MediaPreview(media: media) }
                    else { Text(submission.text).font(.title3) }
                    if !submission.comment.isEmpty { Text(submission.comment).font(.subheadline).foregroundStyle(.secondary) }
                } }
                if q.type == "quiz" || q.type == "would_you_rather" || q.type == "guess" { Text(activity.answers.count == 2 && activity.answers[0].text.lowercased() == activity.answers[1].text.lowercased() ? "You matched! ✨" : "Two perspectives, one conversation 💕").font(.headline) }
                HStack { ForEach(["❤️", "🥰", "😂", "✨"], id: \.self) { emoji in Button(emoji) { store.reactActivity(id, emoji: emoji) }.font(.title).padding(8) } }
                if !activity.reactions.isEmpty { Text(activity.reactions.values.sorted().joined(separator: " ")).font(.title) }
            } else if ownAnswer != nil {
                Card { Image(systemName: "lock.fill").font(.largeTitle).foregroundStyle(.tint); Text("Waiting for \(store.partner?.name ?? "your partner")").font(.title2.bold()); Text("Your answer is saved. Their answer stays hidden until you have both submitted.").foregroundStyle(.secondary); Text(ownAnswer?.skipped == true ? "You skipped this question" : ownAnswer?.text.hasPrefix("media:") == true ? "Photo answer saved" : ownAnswer?.text ?? "").font(.subheadline) }
            } else {
                Card {
                    if q.type == "photo_challenge" { MediaChooser(media: $photo) }
                    else if let options = q.options { ForEach(options, id: \.self) { option in Button { answer = option } label: { HStack { Text(option); Spacer(); Image(systemName: answer == option ? "checkmark.circle.fill" : "circle") }.padding(12) }.buttonStyle(.bordered) } }
                    else { TextField("Your answer", text: $answer, axis: .vertical).lineLimit(4...12).textFieldStyle(.soft) }
                    TextField("A little context (optional)", text: $comment, axis: .vertical).textFieldStyle(.soft)
                    PrimaryButton(title: "Submit & wait for reveal") { store.perform { var text = answer; if q.type == "photo_challenge" { guard let photo else { throw AppError(message: "Choose a photo or video first.") }; text = "media:" + String(data: try JSONEncoder().encode(photo), encoding: .utf8)! }; try store.submit(id, text: text, comment: comment) } }
                    Button("Skip this question") { store.perform { try store.submit(id, text: "", skipped: true) } }
                }
            }
            HStack { Button { store.favoriteQuestion(q.id) } label: { Label("Favorite", systemImage: (store.db.favorites[store.db.currentUser ?? ""] ?? []).contains(q.id) ? "heart.fill" : "heart") }; Spacer(); if ownAnswer == nil { Button("Leave activity", role: .destructive) { abandon = true } } }
        } else { ContentUnavailableView("Activity unavailable", systemImage: "bubble.left") }
    }.navigationTitle("Your conversation").navigationBarTitleDisplayMode(.inline)
        .onAppear { answer = activity?.drafts[store.db.currentUser ?? ""] ?? "" }
        .onChange(of: answer) { _, value in store.saveDraft(id, text: value) }
        .confirmationDialog("Leave this activity?", isPresented: $abandon) { Button("Leave activity", role: .destructive) { store.abandon(id); dismiss() } }
    }
    func decodeMedia(_ value: String) -> Media? { try? JSONDecoder().decode(Media.self, from: Data(value.dropFirst(6).utf8)) }
}
struct ActivityHistoryView: View {
    @EnvironmentObject var store: Store
    var body: some View { Page { if store.activities.isEmpty { ContentUnavailableView("Your conversations live here", systemImage: "bubble.left.and.bubble.right", description: Text("Start a question together to see it here.")) }; ForEach(store.activities) { a in NavigationLink { SessionView(id: a.id) } label: { Card { Text(Product.shared.question(a.questionID)?.text ?? "Question").font(.headline); Text(a.revealed(members: store.couple?.members ?? []) ? "Revealed" : a.answers.isEmpty ? "In progress" : "Waiting for both answers").font(.caption).foregroundStyle(.secondary) } }.buttonStyle(.smooth) } }.navigationTitle("Activity history") }
}
struct FavoriteQuestionsView: View {
    @EnvironmentObject var store: Store
    var body: some View { Page { let list = store.db.favorites[store.db.currentUser ?? ""] ?? []; if list.isEmpty { ContentUnavailableView("No favorites yet", systemImage: "heart", description: Text("Save questions you want to come back to.")) }; ForEach(list, id: \.self) { id in if let q = Product.shared.question(id) { Card { Text(q.text).font(.headline); Button("Remove favorite") { store.favoriteQuestion(id) } } } } }.navigationTitle("Favorites") }
}

// MARK: - Games hub (mirrors src/app/games/index.tsx)
private let gamesHeroBackground = Color(hex: "#15101A")
struct GamesView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var selected: Set<String> = []
    @State private var search = ""
    @State private var searching = false
    @State private var notice: String?
    var tags: [String] { var seen: [String] = []; for tag in Product.shared.games.flatMap(\.tags) where !seen.contains(tag) { seen.append(tag) }; return seen }
    var filtered: [Game] { Product.shared.games.filter { game in (selected.isEmpty || !selected.isDisjoint(with: game.tags)) && (search.isEmpty || (game.title + " " + game.tagline + " " + game.tags.joined(separator: " ")).localizedCaseInsensitiveContains(search)) } }
    var partnerName: String { store.partner?.name ?? "your partner" }
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                sheet
            }.frame(maxWidth: 680).frame(maxWidth: .infinity)
        }
        .background(alignment: .top) { VStack(spacing: 0) { gamesHeroBackground.frame(height: 600); p.surface }.ignoresSafeArea() }
        .navigationTitle("Games").navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(gamesHeroBackground, for: .navigationBar).toolbarColorScheme(.dark, for: .navigationBar)
        .navigationDestination(isPresented: $openLife) { LifeGameView() }
        .navigationDestination(isPresented: $openCheckup) { CheckupGameView() }
        .alert(notice ?? "", isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } })) { Button("OK") { notice = nil } }
    }
    var hero: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) { Text("Play together").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.6)); Text("Games for two").font(.system(size: 30, weight: .heavy)).foregroundStyle(.white) }
                Spacer()
                HStack(spacing: -10) { Avatar(person: store.me, size: 30); if let partner = store.partner { Avatar(person: partner, size: 30) } }
            }.padding(.horizontal, 20)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) { ForEach(Product.shared.games) { game in heroCard(game).containerRelativeFrame(.horizontal) { width, _ in width - 40 } } }.scrollTargetLayout()
            }.contentMargins(.horizontal, 20, for: .scrollContent).scrollTargetBehavior(.viewAligned)
        }.padding(.top, 12).padding(.bottom, 48).background(gamesHeroBackground)
    }
    func heroCard(_ game: Game) -> some View {
        Button { open(game) } label: {
            ZStack(alignment: .topLeading) {
                gradient(game)
                Text(game.emoji).font(.system(size: 170)).opacity(0.35).rotationEffect(.degrees(-12)).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing).offset(x: 18, y: 10).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) { ForEach(game.tags, id: \.self) { tag in Text(tag.uppercased()).font(.system(size: 10, weight: .bold)).tracking(0.8).padding(.horizontal, 10).padding(.vertical, 5).background(.white.opacity(0.22), in: Capsule()) } }
                    Spacer()
                    if game.status == "coming_soon" { Label { Text("COMING SOON").font(.system(size: 10, weight: .bold)) } icon: { Circle().frame(width: 6, height: 6) }.padding(.horizontal, 10).padding(.vertical, 4).background(.black.opacity(0.22), in: Capsule()) }
                    Text(game.title.uppercased()).font(.system(size: 36, weight: .black)).lineLimit(2).minimumScaleFactor(0.7).frame(maxWidth: 260, alignment: .leading)
                    Text("\(game.players) · \(game.pace)").font(.subheadline.weight(.semibold)).opacity(0.85)
                }.foregroundStyle(.white).padding(24)
                Image(systemName: "play.fill").font(.title2).foregroundStyle(Color(hex: game.colors[1])).frame(width: 56, height: 56).background(.white, in: Circle()).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing).padding(24)
            }.frame(height: 320).clipShape(RoundedRectangle(cornerRadius: 28))
        }.buttonStyle(.smooth).accessibilityLabel("\(game.title). \(game.tagline). \(game.status == "coming_soon" ? "Coming soon" : "")")
    }
    var sheet: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 8) {
                Text("Explore").font(.system(size: 32, weight: .heavy))
                Spacer()
                Button { searching.toggle(); if !searching { search = "" } } label: { Image(systemName: searching ? "xmark" : "magnifyingglass").frame(width: 40, height: 40).background(p.color("surfaceTint"), in: Circle()) }.buttonStyle(.smooth).accessibilityLabel(searching ? "Close search" : "Search games")
                if !selected.isEmpty { Button { selected = [] } label: { HStack(spacing: 4) { Text("\(selected.count) selected").font(.caption.weight(.semibold)); Image(systemName: "xmark").font(.caption2) }.padding(.horizontal, 12).frame(height: 32).overlay(Capsule().stroke(p.color("border"))) }.buttonStyle(.smooth) }
            }
            if searching { TextField("Search games", text: $search).textFieldStyle(.soft).autocorrectionDisabled() }
            ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) { ForEach(tags, id: \.self) { tag in let on = selected.contains(tag); Button { if on { selected.remove(tag) } else { selected.insert(tag) } } label: { Text(tag.uppercased()).font(.system(size: 11, weight: .bold)).tracking(0.6).padding(.horizontal, 14).frame(height: 32).foregroundStyle(on ? p.color("onPrimary") : p.color("primaryStrong")).background(on ? p.primary : p.soft, in: Capsule()) }.buttonStyle(.smooth).accessibilityAddTraits(on ? .isSelected : []) } } }
            Text("Your turn").font(.headline)
            if let life = store.lifeGame, life.status != "ended" {
                Button { openLife = true } label: { HStack(spacing: 12) { Text("👶").font(.title3).frame(width: 44, height: 44).background(gradient(Product.shared.games[0])).clipShape(RoundedRectangle(cornerRadius: 14)); VStack(alignment: .leading, spacing: 2) { Text(life.name ?? "Our Little One").font(.body.weight(.semibold)); Text(lifeStatus(life)).font(.caption).foregroundStyle(p.secondary) }; Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(p.color("textMuted")) }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(p.color("backgroundAlt"), in: RoundedRectangle(cornerRadius: 22)) }.buttonStyle(.smooth)
            } else {
                HStack(spacing: 12) { Image(systemName: "hourglass").font(.title3).foregroundStyle(p.primary); VStack(alignment: .leading, spacing: 2) { Text("No games in progress").font(.body.weight(.semibold)); Text("Start Our Little One and you'll see here what \(partnerName) and your child need.").font(.caption).foregroundStyle(p.secondary) } }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(p.color("backgroundAlt"), in: RoundedRectangle(cornerRadius: 22))
            }
            Text("All games").font(.headline)
            ForEach(filtered) { game in
                Button { open(game) } label: { HStack(spacing: 12) {
                    Text(game.emoji).font(.system(size: 28)).frame(width: 64, height: 64).background(gradient(game)).clipShape(RoundedRectangle(cornerRadius: 16))
                    VStack(alignment: .leading, spacing: 2) { Text(game.title).font(.body.weight(.semibold)); Text(game.tagline).font(.caption).foregroundStyle(p.secondary).lineLimit(1); HStack(spacing: 6) { Circle().fill(game.status == "available" ? p.color("success") : p.color("warning")).frame(width: 7, height: 7); Text("\(game.status == "available" ? "Play now" : "Coming soon") · \(game.pace)").font(.caption).foregroundStyle(p.color("textMuted")) } }
                    Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(p.color("textMuted"))
                }.contentShape(Rectangle()) }.buttonStyle(.smooth)
            }
            if filtered.isEmpty { Text("No games match that search.").foregroundStyle(p.color("textMuted")).frame(maxWidth: .infinity) }
            Text("Scoreboard").font(.headline)
            HStack {
                scorePlayer(store.me, name: store.me?.name ?? "You", ring: Product.shared.games.first?.colors.last ?? "#E0306A", note: "0 wins")
                Text("vs").font(.title.bold()).foregroundStyle(p.color("textMuted"))
                scorePlayer(store.partner, name: store.partner?.name ?? "Partner", ring: Product.shared.games.last?.colors.last ?? "#4A39D6", note: store.partner?.simulated == true ? "Simulated · 0 wins" : "0 wins")
            }.padding(16).background(p.color("backgroundAlt"), in: RoundedRectangle(cornerRadius: 22))
        }
        .padding(20).padding(.top, 4).padding(.bottom, 24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(p.surface, in: UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32))
        .offset(y: -24).padding(.bottom, -24)
    }
    func scorePlayer(_ person: Person?, name: String, ring: String, note: String) -> some View {
        VStack(spacing: 4) { Avatar(person: person, size: 52).padding(3).overlay(Circle().stroke(Color(hex: ring), lineWidth: 3)); Text(name).font(.body.weight(.semibold)).lineLimit(1); Text(note).font(.caption).foregroundStyle(p.color("textMuted")) }.frame(maxWidth: .infinity)
    }
    func lifeStatus(_ life: LifeGame) -> String {
        let me = store.db.currentUser ?? ""
        if life.status == "proposed" { return life.proposedBy == me ? "Waiting for \(partnerName) to say yes" : "\(partnerName) wants a baby with you 💞" }
        if let v = life.votes.first(where: { !$0.decided }), v.picks[me] == nil { return "Your vote: \(Life.choice(v.choice).title.lowercased())" }
        if life.status == "naming" { return "Waiting for \(partnerName) to pick a name" }
        let mood = Life.mood(Life.decayed(life, at: Life.now(life)))
        return mood == "happy" ? "Happy and growing" : mood == "sad" ? "Needs you now: needs are low" : "Needs care: \(mood)"
    }
    func gradient(_ game: Game) -> LinearGradient { LinearGradient(colors: game.colors.map { Color(hex: $0) }, startPoint: .topLeading, endPoint: .bottomTrailing) }
    @State private var openLife = false
    @State private var openCheckup = false
    func open(_ game: Game) { if game.status == "coming_soon" { notice = "\(game.title) is coming soon" } else if game.id == "our_little_one" { openLife = true } else if game.id == "marriage_checkup" { openCheckup = true } }
}
