import SwiftUI

// Our Garden: a shared garden that grows from what you already share — flame days,
// answered questions, voice notes, games — and wilts a little when the flame goes quiet.
// It is computed from synced data, so both phones always show the same garden.

struct GardenPlant: Identifiable { var id: Int; var emoji: String; var source: LocalizedStringKey }

extension Store {
    var gardenGrowth: (flame: Int, answers: Int, voices: Int, games: Int) {
        let members = couple?.members ?? []
        let answers = activities.filter { $0.revealed(members: members) }.count
        let voices = messages.filter { $0.kind == "voice" }.count
        let games = (db.plays ?? []).filter { $0.coupleID == couple?.id && $0.seq == 0 }.count + (db.truths ?? []).filter { $0.coupleID == couple?.id }.count / 2 + (db.checkups ?? []).filter { $0.coupleID == couple?.id }.count / 2
        return (streak.days.count, answers, voices, games)
    }
    /// Days since the flame last burned (both shared a moment). 0 = today or yesterday.
    var gardenThirst: Int {
        guard let last = streak.days.last else { return 99 }
        return max(0, Day.distance(last, today) - 1)
    }
}

struct GardenView: View {
    @EnvironmentObject var store: Store
    @Environment(\.appPalette) var p
    @State private var sway = false

    var plants: [GardenPlant] {
        let g = store.gardenGrowth
        var out: [GardenPlant] = []
        let flowers = ["🌷", "🌸", "🌼", "🌻", "🌺", "🪷", "💐", "🌹"]
        for i in 0..<g.flame { out.append(GardenPlant(id: out.count, emoji: flowers[i % flowers.count], source: "A flame day")) }
        for _ in 0..<g.answers { out.append(GardenPlant(id: out.count, emoji: "🌿", source: "A question you both answered")) }
        for _ in 0..<g.voices { out.append(GardenPlant(id: out.count, emoji: "🍄", source: "A voice note")) }
        for _ in 0..<g.games { out.append(GardenPlant(id: out.count, emoji: "🌳", source: "A game played together")) }
        return out
    }
    var mood: (title: LocalizedStringKey, text: LocalizedStringKey, sky: [String]) {
        switch store.gardenThirst {
        case 0: ("Your garden is blooming", "Keep the flame alive and it keeps growing.", ["#BFE9FF", "#E9FFF2"])
        case 1...2: ("Your garden is a little thirsty", "Share today's moment, both of you, to water it.", ["#FFE7B8", "#FFF6E3"])
        default: ("Your garden is wilting", "It's been quiet. One moment each brings it back to life.", ["#D9D2C5", "#EFEAE0"])
        }
    }

    var body: some View {
        Page {
            let all = plants, m = mood, wilt = store.gardenThirst > 2
            ZStack(alignment: .bottom) {
                LinearGradient(colors: m.sky.map { Color(hex: $0) }, startPoint: .top, endPoint: .bottom)
                VStack {
                    HStack { Text(wilt ? "☁️" : "☀️").font(.system(size: 44)); Spacer(); Text(wilt ? "🌧️" : "🦋").font(.system(size: 30)).offset(y: sway ? -6 : 6) }.padding(18)
                    Spacer()
                }
                Rectangle().fill(LinearGradient(colors: [Color(hex: wilt ? "#9C8B6E" : "#7BC67E"), Color(hex: wilt ? "#7A6A50" : "#4E9A55")], startPoint: .top, endPoint: .bottom)).frame(height: 90)
                if all.isEmpty {
                    Text("🌱").font(.system(size: 54)).padding(.bottom, 50)
                } else {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 8), spacing: 2) {
                        ForEach(all.suffix(48)) { pl in
                            Text(pl.emoji).font(.system(size: 26))
                                .rotationEffect(.degrees(wilt ? 25 : sway ? -4 : 4), anchor: .bottom)
                                .saturation(wilt ? 0.25 : 1)
                        }
                    }.padding(.horizontal, 12).padding(.bottom, 26)
                }
            }
            .frame(height: 320).clipShape(RoundedRectangle(cornerRadius: 28))
            .onAppear { withAnimation(.easeInOut(duration: 2.2).repeatForever()) { sway = true } }

            VStack(alignment: .leading, spacing: 6) { Text(m.title).font(.title2.bold()); Text(m.text).foregroundStyle(.secondary) }
            let g = store.gardenGrowth
            Card {
                Text("What made it grow").font(.headline)
                row("🌷", "Flame days", g.flame)
                row("🌿", "Questions you both answered", g.answers)
                row("🍄", "Voice notes", g.voices)
                row("🌳", "Games played together", g.games)
            }
            InfoBanner(text: "Your garden is the same on both phones. Everything you share together helps it grow.", icon: "leaf")
        }
        .navigationTitle("Our Garden").navigationBarTitleDisplayMode(.inline)
    }
    func row(_ e: String, _ label: LocalizedStringKey, _ n: Int) -> some View {
        HStack { Text(e); Text(label); Spacer(); Text(verbatim: "\(n)").font(.headline.monospacedDigit()) }
    }
}
