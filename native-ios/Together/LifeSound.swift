import AVFoundation

/// The game's small mixer, mirroring src/components/game/sound.ts (audio-design skill):
/// sfx/ui/music buses in dB, a separate music duck stage, ±pitch/±volume variation on every effect
/// from a pool of engine voices, and a day theme that crossfades to a lullaby when the lights go off.
/// Sounds are original, synthesized by scripts/make-sounds.py into shared/sounds.
@MainActor final class LifeSound {
    static let shared = LifeSound()
    enum Bus { case sfx, ui }
    var muted = false { didSet { applyMusic(fade: 0.2) } }

    private let busDb: [String: Double] = ["sfx": -2, "ui": -8, "music": -14]
    private let engine = AVAudioEngine()
    private var voices: [(AVAudioPlayerNode, AVAudioUnitVarispeed)] = []
    private var nextVoice = 0
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    private var music: [String: AVAudioPlayer] = [:]
    private var current: String?
    private var duckDb = 0.0
    private var duckWork: DispatchWorkItem?

    private init() {
        // Ambient: respects the silent switch and mixes with the person's own music.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
    }

    private func gain(_ db: Double) -> Float { Float(pow(10, db / 20)) }

    private func buffer(_ name: String) -> AVAudioPCMBuffer? {
        if let b = buffers[name] { return b }
        guard let url = Bundle.main.url(forResource: name, withExtension: "wav"), let file = try? AVAudioFile(forReading: url),
              let b = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else { return nil }
        try? file.read(into: b)
        buffers[name] = b
        return b
    }

    private func ensureEngine(_ format: AVAudioFormat) -> Bool {
        if voices.isEmpty {
            for _ in 0..<8 {
                let node = AVAudioPlayerNode(), vs = AVAudioUnitVarispeed()
                engine.attach(node); engine.attach(vs)
                engine.connect(node, to: vs, format: format)
                engine.connect(vs, to: engine.mainMixerNode, format: format)
                voices.append((node, vs))
            }
        }
        if !engine.isRunning { try? engine.start() }
        return engine.isRunning
    }

    /// Plays one effect (or a random one of several) with ±`vary` semitones and ±2 dB of variation.
    func play(_ names: [String], bus: Bus = .sfx, db: Double = 0, vary: Double = 1) {
        guard !muted, let name = names.randomElement(), let buf = buffer(name), ensureEngine(buf.format) else { return }
        let (node, vs) = voices[nextVoice % voices.count]; nextVoice += 1
        let semis = Double.random(in: -1...1) * vary
        node.stop()
        vs.rate = Float(pow(2, semis / 12))
        node.volume = min(1, gain((busDb[bus == .ui ? "ui" : "sfx"] ?? 0) + db + Double.random(in: -2...2) * min(1, vary)))
        node.scheduleBuffer(buf, at: nil)
        node.play()
    }
    func play(_ name: String, bus: Bus = .sfx, db: Double = 0, vary: Double = 1) { play([name], bus: bus, db: db, vary: vary) }

    private func applyMusic(fade: TimeInterval) {
        for (key, p) in music {
            let on = key == current && !muted
            let target = on ? gain((busDb["music"] ?? -14) + duckDb) : 0
            if on && !p.isPlaying { p.volume = 0; p.play() }
            p.setVolume(target, fadeDuration: fade)
            if !on { DispatchQueue.main.asyncAfter(deadline: .now() + fade + 0.05) { [weak self] in if self?.current != key || self?.muted == true { p.pause() } } }
        }
    }

    /// Crossfades to "day", "night" or silence (nil).
    func setMusic(_ next: String?, fade: TimeInterval = 0.9) {
        guard next != current else { return }
        current = next
        for key in ["day", "night"] where music[key] == nil {
            if let url = Bundle.main.url(forResource: "music_\(key)", withExtension: "wav"), let p = try? AVAudioPlayer(contentsOf: url) { p.numberOfLoops = -1; p.volume = 0; p.prepareToPlay(); music[key] = p }
        }
        applyMusic(fade: fade)
    }

    /// Dips the music under a big moment, then lets it recover.
    func duck(_ db: Double = -10, hold: TimeInterval = 1.4) {
        duckDb = db; applyMusic(fade: 0.08)
        duckWork?.cancel()
        let w = DispatchWorkItem { [weak self] in self?.duckDb = 0; self?.applyMusic(fade: 0.5) }
        duckWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + hold, execute: w)
    }
}
