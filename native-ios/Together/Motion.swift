import SwiftUI

/// Small, shared motion values. Visual transforms do not change layout or delay actions.
struct MotionTokens: Codable {
    var pressScale: Double
    var pressedOpacity: Double
    var pressInMs: Double
    var releaseMs: Double
    var transitionMs: Double
}
enum AppMotion {
    static func transition(reduced: Bool) -> Animation? {
        reduced ? nil : .easeInOut(duration: Product.shared.motion.transitionMs / 1000)
    }
}
struct SmoothButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduced
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        let motion = Product.shared.motion
        configuration.label
            .scaleEffect(enabled && configuration.isPressed && !reduced ? motion.pressScale : 1)
            .opacity(!enabled ? 0.5 : configuration.isPressed ? motion.pressedOpacity : 1)
            .animation(reduced ? nil : .easeOut(duration: (configuration.isPressed ? motion.pressInMs : motion.releaseMs) / 1000), value: configuration.isPressed)
    }
}
extension ButtonStyle where Self == SmoothButtonStyle {
    static var smooth: SmoothButtonStyle { SmoothButtonStyle() }
}

struct OnboardingPreparation: View {
    @Environment(\.appPalette) private var p
    @Environment(\.accessibilityReduceMotion) private var reduced
    @Environment(\.scenePhase) private var scenePhase
    @State private var start = Date()
    private func curve(_ t: Double, _ points: [(Double, Double)]) -> Double {
        guard let first = points.first, let last = points.last else { return 0 }
        if t <= first.0 { return first.1 }
        for i in 1..<points.count where t <= points[i].0 {
            let a = points[i - 1], b = points[i]
            return a.1 + (b.1 - a.1) * (t - a.0) / (b.0 - a.0)
        }
        return last.1
    }
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: reduced || scenePhase != .active)) { context in
            let t = reduced ? 0.55 : min(1, context.date.timeIntervalSince(start) / (Double(Product.shared.onboardingTransition.durationMs) / 1000))
            VStack(spacing: 24) {
                ZStack {
                    Circle().fill(p.soft.opacity(0.55)).frame(width: 180, height: 180)
                    ForEach(0..<2) { i in
                        let delay = Double(i) * 0.12
                        Circle().stroke(p.primary, lineWidth: 1).frame(width: 150, height: 150)
                            .scaleEffect(reduced ? 1 + Double(i) * 0.2 : curve(t, [(0, 0.7), (0.25 + delay, 0.7), (1, 1.65)]))
                            .opacity(reduced ? 0.15 : curve(t, [(0, 0), (0.25 + delay, 0), (0.48 + delay, 0.32), (1, 0)]))
                    }
                    ForEach([-1, 1], id: \.self) { side in
                        let x = Double(side)
                        Image(systemName: "heart.fill").font(.system(size: 64)).foregroundStyle(side < 0 ? p.primary : p.color("primaryStrong"))
                            .rotationEffect(.degrees(x * 14))
                            .scaleEffect(reduced ? 1 : curve(t, [(0, 0.7), (0.16, 0.9), (0.42, 1.08), (0.55, 0.97), (0.72, 1), (1, 1)]))
                            .offset(x: reduced ? x * 18 : x * curve(t, [(0, 58), (0.16, 58), (0.42, 15), (0.55, 20), (0.72, 18), (1, 18)]), y: x * 7)
                    }
                    ForEach(0..<4) { i in
                        Image(systemName: "sparkle").font(.system(size: i < 2 ? 21 : 14)).foregroundStyle(p.primary)
                            .scaleEffect(reduced ? 1 : curve(t, [(0, 0), (0.4, 0), (0.6, 1), (1, 0.5)]))
                            .offset(x: Double(i % 2 == 0 ? -1 : 1) * (i < 2 ? 80 : 59), y: i < 2 ? -62 : 62)
                            .opacity(reduced ? 0.4 : curve(t, [(0, 0), (0.4, 0), (0.55, 0.8), (0.88, 0)]))
                    }
                }.frame(width: 224, height: 224).accessibilityHidden(true)
                VStack(spacing: 10) {
                    Text(Product.shared.onboardingTransition.title).font(.title2.bold())
                    Text(Product.shared.onboardingTransition.message).font(.subheadline).foregroundStyle(.secondary)
                }.multilineTextAlignment(.center).frame(maxWidth: 420)
            }.opacity(reduced ? 1 : curve(t, [(0, 0), (0.08, 1), (0.9, 1), (1, 0)]))
                .padding(24).frame(maxWidth: .infinity, maxHeight: .infinity).foregroundStyle(p.text).background(p.background)
                .accessibilityElement(children: .combine)
        }
    }
}
