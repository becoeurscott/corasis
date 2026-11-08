import SwiftUI
import UIKit

/// Full-screen flame when both partners have sent today's moment.
/// Plays once per day per phone, whether the day was completed here or by the partner's moment arriving.
struct FlameCelebration: View {
    @EnvironmentObject var store: Store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showing = false
    @State private var count = 0
    @Environment(\.scenePhase) private var phase

    private var completedToday: Bool { store.couple != nil && store.streak.days.contains(store.today) }
    private var seenKey: String { "flame-celebrated-\(store.couple?.id ?? "")-\(store.today)" }

    var body: some View {
        ZStack {
            // Invisible base so this view always exists (an empty view never appears) and never blocks taps.
            Color.clear.allowsHitTesting(false)
            if showing { FlameBurst(days: count, reduceMotion: reduceMotion) { showing = false }.transition(.opacity) }
        }
        .animation(.easeOut(duration: 0.3), value: showing)
        .onChange(of: completedToday) { _, done in celebrateIfNeeded(done) }
        .onChange(of: phase) { _, p in if p == .active { celebrateIfNeeded(completedToday) } }
        .onAppear { celebrateIfNeeded(completedToday) }
    }

    private func celebrateIfNeeded(_ done: Bool) {
        guard done, !showing, phase == .active, !UserDefaults.standard.bool(forKey: seenKey) else { return }
        let key = seenKey
        // Give the screen a moment to appear (cold launch) before the flame plays.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            guard phase == .active, !UserDefaults.standard.bool(forKey: key) else { return }
            UserDefaults.standard.set(true, forKey: key)
            count = store.streak.current
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            showing = true
        }
    }
}

private struct FlameBurst: View {
    let days: Int; let reduceMotion: Bool; let done: () -> Void
    struct Ember: Identifiable { let id = UUID(); let x: CGFloat; let delay: Double; let size: CGFloat; let drift: CGFloat; let duration: Double }
    @State private var embers: [Ember] = []
    @State private var lit = false
    @State private var rise = false
    @State private var flicker = false

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.opacity(lit ? 0.72 : 0).ignoresSafeArea()
                RadialGradient(colors: [Color.orange.opacity(0.55), Color.red.opacity(0.25), .clear], center: .center, startRadius: 10, endRadius: geo.size.width * 0.8)
                    .scaleEffect(lit ? 1 : 0.2).opacity(lit ? 1 : 0).ignoresSafeArea()
                if !reduceMotion {
                    ForEach(embers) { e in
                        Text("🔥").font(.system(size: e.size))
                            .position(x: e.x + (rise ? e.drift : 0), y: rise ? -40 : geo.size.height + 40)
                            .opacity(rise ? 0 : 0.9)
                            .animation(.easeOut(duration: e.duration).delay(e.delay), value: rise)
                    }
                }
                VStack(spacing: 14) {
                    Text("🔥").font(.system(size: 150))
                        .scaleEffect(lit ? (flicker ? 1.06 : 0.98) : 0.1)
                        .rotationEffect(.degrees(flicker ? 2 : -2))
                        .shadow(color: .orange.opacity(0.9), radius: lit ? 40 : 0)
                    Text(days == 1 ? "Day 1 🔥" : "Day \(days) 🔥").font(.system(size: 40, weight: .heavy, design: .rounded)).foregroundStyle(.white)
                    Text("You both sent today’s moment").font(.headline).foregroundStyle(.white.opacity(0.9))
                }
                .padding(.horizontal, 28).padding(.vertical, 18)
                .background(Color.black.opacity(0.35), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                .opacity(lit ? 1 : 0)
                .offset(y: lit ? 0 : 60)
            }
            .contentShape(Rectangle())
            .onTapGesture { done() }
            .onAppear {
                embers = (0..<24).map { _ in Ember(x: .random(in: 20...(max(21, geo.size.width - 20))), delay: .random(in: 0...1.2), size: .random(in: 18...42), drift: .random(in: -50...50), duration: .random(in: 1.8...3.0)) }
                withAnimation(.spring(response: 0.55, dampingFraction: 0.55)) { lit = true }
                rise = true
                if !reduceMotion { withAnimation(.easeInOut(duration: 0.35).repeatForever(autoreverses: true)) { flicker = true } }
                DispatchQueue.main.asyncAfter(deadline: .now() + 4.2) { done() }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Flame day \(days). You both sent today's moment.")
        .accessibilityAddTraits(.isModal)
    }
}
