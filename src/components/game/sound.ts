import { AudioPlayer, createAudioPlayer } from 'expo-audio';

/**
 * The game's small mixer, following the audio-design skill:
 * - every sound plays into a bus (sfx, ui, music) under a master gain; gains are in dB;
 * - music has its own duck stage, so ducking never overwrites the music volume;
 * - repeated effects get small random pitch and volume offsets and come from a pool of players;
 * - music crossfades between a day theme and a lullaby when the lights go off.
 * The sounds are original and synthesized by scripts/make-sounds.py.
 */
const files = {
  pop: require('../../../shared/sounds/pop.wav'),
  pickup: require('../../../shared/sounds/pickup.wav'),
  hover: require('../../../shared/sounds/hover.wav'),
  land: require('../../../shared/sounds/land.wav'),
  click: require('../../../shared/sounds/click.wav'),
  chew1: require('../../../shared/sounds/chew1.wav'),
  chew2: require('../../../shared/sounds/chew2.wav'),
  splash: require('../../../shared/sounds/splash.wav'),
  bubble: require('../../../shared/sounds/bubble.wav'),
  giggle1: require('../../../shared/sounds/giggle1.wav'),
  giggle2: require('../../../shared/sounds/giggle2.wav'),
  sparkle: require('../../../shared/sounds/sparkle.wav'),
  ding: require('../../../shared/sounds/ding.wav'),
  boing: require('../../../shared/sounds/boing.wav'),
  fanfare: require('../../../shared/sounds/fanfare.wav'),
  music_day: require('../../../shared/sounds/music_day.wav'),
  music_night: require('../../../shared/sounds/music_night.wav'),
} as const;

export type SoundName = Exclude<keyof typeof files, 'music_day' | 'music_night'>;
export type Bus = 'sfx' | 'ui';
export type Music = 'day' | 'night' | null;

const dbToGain = (db: number) => Math.pow(10, db / 20);
/** Bus levels in dB. UI sits under SFX; music sits well under both. */
const busDb = { master: 0, sfx: -2, ui: -8, music: -14 };
const POLYPHONY = 3;

let muted = false;
let duckDb = 0;
let duckTimer: ReturnType<typeof setTimeout> | null = null;
const pools = new Map<string, { players: AudioPlayer[]; next: number }>();
const music: Partial<Record<'day' | 'night', AudioPlayer>> = {};
const musicLevel = { day: 0, night: 0 };
let current: Music = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function player(name: SoundName) {
  let pool = pools.get(name);
  if (!pool) {
    pool = { players: [], next: 0 };
    pools.set(name, pool);
  }
  if (pool.players.length < POLYPHONY) {
    const p = createAudioPlayer(files[name]);
    p.shouldCorrectPitch = false; // so playback rate shifts pitch, which is the variation we want
    pool.players.push(p);
    return p;
  }
  const p = pool.players[pool.next % pool.players.length];
  pool.next += 1;
  return p;
}

/** Plays one effect (or a random one of several) with ±pitch semitones and ±volume dB of variation. */
export function play(name: SoundName | SoundName[], opts: { bus?: Bus; db?: number; pitch?: number; vary?: number } = {}) {
  if (muted) return;
  const list = Array.isArray(name) ? name : [name];
  const pick = list[Math.floor(Math.random() * list.length)];
  const vary = opts.vary ?? 1;
  try {
    const p = player(pick);
    const semis = (opts.pitch ?? 0) + (Math.random() * 2 - 1) * vary;
    const db = busDb.master + busDb[opts.bus ?? 'sfx'] + (opts.db ?? 0) + (Math.random() * 2 - 1) * 2 * Math.min(1, vary);
    p.volume = Math.min(1, dbToGain(db));
    p.setPlaybackRate(Math.pow(2, semis / 12));
    p.seekTo(0).catch(() => undefined);
    p.play();
  } catch {
    // Sound is decoration: never let it break the game.
  }
}

function applyMusic() {
  for (const k of ['day', 'night'] as const) {
    const p = music[k];
    if (!p) continue;
    const gain = muted ? 0 : dbToGain(busDb.master + busDb.music + duckDb) * musicLevel[k];
    p.volume = Math.min(1, gain);
    if (musicLevel[k] <= 0.001 && p.playing) p.pause();
    else if (musicLevel[k] > 0.001 && !p.playing && !muted) p.play();
  }
}

/** Crossfades to the day theme, the lullaby, or silence. Call after a user gesture (web autoplay rules). */
export function setMusic(next: Music, fadeMs = 900) {
  if (next === current) return;
  current = next;
  try {
    for (const k of ['day', 'night'] as const) {
      if (!music[k]) {
        const p = createAudioPlayer(files[k === 'day' ? 'music_day' : 'music_night']);
        p.loop = true;
        p.volume = 0;
        music[k] = p;
      }
    }
  } catch {
    return;
  }
  if (fadeTimer) clearInterval(fadeTimer);
  const from = { ...musicLevel };
  const started = Date.now();
  fadeTimer = setInterval(() => {
    const t = Math.min(1, (Date.now() - started) / fadeMs);
    musicLevel.day = from.day + ((next === 'day' ? 1 : 0) - from.day) * t;
    musicLevel.night = from.night + ((next === 'night' ? 1 : 0) - from.night) * t;
    applyMusic();
    if (t >= 1 && fadeTimer) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }, 50);
}

/** Dips the music under a big moment, then lets it recover. */
export function duck(db = -10, holdMs = 1400) {
  duckDb = db;
  applyMusic();
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    duckDb = 0;
    applyMusic();
  }, holdMs);
}

export function setMuted(value: boolean) {
  muted = value;
  applyMusic();
}
export const isMuted = () => muted;

/** Stops the music when leaving the room. Effect players stay pooled for next time. */
export function stopMusic() {
  setMusic(null, 400);
}
