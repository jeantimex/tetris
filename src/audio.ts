/**
 * NES-style audio: Korobeiniki (public-domain melody) as a square/triangle-wave
 * chiptune, plus synthesized sound effects. No audio assets, all Web Audio API.
 */

type Note = [midi: number, beats: number]; // midi 0 = rest

const A4 = 69;
const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - A4) / 12);

/** Korobeiniki A-theme (what NES "Music-A" plays). */
const MELODY: Note[] = [
  [76, 1], [71, 0.5], [72, 0.5], [74, 1], [72, 0.5], [71, 0.5], // E5 B4 C5 D5 C5 B4
  [69, 1], [69, 0.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5], // A4 A4 C5 E5 D5 C5
  [71, 1.5], [72, 0.5], [74, 1], [76, 1], // B4. C5 D5 E5
  [72, 1], [69, 1], [69, 1], [0, 1], // C5 A4 A4 rest
  [74, 1.5], [77, 0.5], [81, 1], [79, 0.5], [77, 0.5], // D5. F5 A5 G5 F5
  [76, 1.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5], // E5. C5 E5 D5 C5
  [71, 1.5], [72, 0.5], [74, 1], [76, 1], // B4. C5 D5 E5
  [72, 1], [69, 1], [69, 1], [0, 1], // C5 A4 A4 rest
];

/** Simple root/fifth bass line, one note per beat (8 bars of 4). */
const BASS_LINE: number[] = [
  45, 45, 52, 45, // Am
  45, 45, 52, 45, // Am
  40, 40, 47, 40, // E
  45, 45, 52, 45, // Am
  41, 41, 48, 41, // F
  48, 48, 43, 48, // C
  40, 40, 47, 40, // E
  45, 45, 52, 45, // Am
];

const BPM = 150;
const TOTAL_BEATS = 32;

type Voice = 'lead' | 'bass' | 'perc';

interface MusicEvent {
  beat: number;
  voice: Voice;
  midi: number;
  durBeats: number;
}

function buildEvents(): MusicEvent[] {
  const events: MusicEvent[] = [];
  let beat = 0;
  for (const [midi, beats] of MELODY) {
    if (midi > 0) events.push({ beat, voice: 'lead', midi, durBeats: beats * 0.92 });
    beat += beats;
  }
  BASS_LINE.forEach((midi, i) => {
    events.push({ beat: i, voice: 'bass', midi, durBeats: 0.85 });
  });
  for (let b = 0; b < TOTAL_BEATS; b += 0.5) {
    events.push({ beat: b, voice: 'perc', midi: 0, durBeats: 0 });
  }
  return events.sort((a, b) => a.beat - b.beat);
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private events = buildEvents();
  private evIdx = 0;
  private loopCount = 0;
  private startAt = 0;
  private schedTimer: number | null = null;
  private muted = false;

  /** Create/resume the context. Must be called from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.12;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.45;
      this.sfxBus.connect(this.master);

      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.25, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  startMusic(): void {
    if (!this.ctx || !this.musicBus) return;
    this.stopMusic(0);
    const now = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(0.12, now);
    this.evIdx = 0;
    this.loopCount = 0;
    this.startAt = now + 0.06;
    this.schedTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(fade = 0.25): void {
    if (!this.ctx || !this.musicBus) return;
    if (this.schedTimer !== null) {
      window.clearInterval(this.schedTimer);
      this.schedTimer = null;
    }
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.linearRampToValueAtTime(0, t + fade);
  }

  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }

  /* ---------- music sequencer ---------- */

  private schedule(): void {
    if (!this.ctx) return;
    const secPerBeat = 60 / BPM;
    const horizon = this.ctx.currentTime + 0.15;
    for (;;) {
      const ev = this.events[this.evIdx];
      const t = this.startAt + (this.loopCount * TOTAL_BEATS + ev.beat) * secPerBeat;
      if (t > horizon) break;
      this.playEvent(ev, t, secPerBeat);
      this.evIdx += 1;
      if (this.evIdx >= this.events.length) {
        this.evIdx = 0;
        this.loopCount += 1;
      }
    }
  }

  private playEvent(ev: MusicEvent, t: number, secPerBeat: number): void {
    if (!this.ctx || !this.musicBus || !this.noiseBuf) return;
    const ctx = this.ctx;

    if (ev.voice === 'perc') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      const g = ctx.createGain();
      const accent = ev.beat % 1 === 0;
      g.gain.setValueAtTime(accent ? 0.22 : 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.musicBus);
      src.start(t);
      src.stop(t + 0.05);
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = ev.voice === 'lead' ? 'square' : 'triangle';
    osc.frequency.value = midiToFreq(ev.midi);
    const g = ctx.createGain();
    const dur = ev.durBeats * secPerBeat;
    const peak = ev.voice === 'lead' ? 0.5 : 0.7;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.setValueAtTime(peak, Math.max(t + 0.008, t + dur - 0.03));
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /* ---------- sound effects ---------- */

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType = 'square',
    vol = 0.4,
    sweepTo?: number,
    when = 0,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  sfxMove(): void {
    this.blip(200, 0.05, 'square', 0.5);
  }

  sfxRotate(): void {
    this.blip(320, 0.07, 'square', 0.5);
  }

  sfxLock(): void {
    this.blip(130, 0.1, 'triangle', 0.8);
  }

  sfxHardDrop(): void {
    this.noiseBurst(0.08, 0.5);
    this.blip(90, 0.12, 'triangle', 0.9);
  }

  /** Short filtered noise hit (hard drop slam). */
  private noiseBurst(dur: number, vol: number): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  sfxClear(lines: number): void {
    if (lines >= 4) {
      this.blip(300, 0.18, 'square', 0.55, 1200);
      this.blip(420, 0.26, 'square', 0.55, 1700, 0.13);
    } else {
      this.blip(320, 0.18, 'square', 0.5, 900);
    }
  }

  sfxLevelUp(): void {
    [72, 76, 79, 84].forEach((m, i) => {
      this.blip(midiToFreq(m), 0.09, 'square', 0.4, undefined, i * 0.08);
    });
  }

  sfxWin(): void {
    [72, 76, 79, 84, 88, 91].forEach((m, i) => {
      this.blip(midiToFreq(m), 0.11, 'square', 0.4, undefined, i * 0.09);
    });
  }

  sfxGameOver(): void {
    this.blip(380, 0.9, 'square', 0.45, 55);
  }
}
