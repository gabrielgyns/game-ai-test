/**
 * Áudio 100% sintetizado com Web Audio: sem arquivos, sem licenças, combina com o voxel.
 * Pense num chip de som de console antigo: osciladores, ruído e envelopes curtos.
 */

type SfxName =
  | "swing" | "hit" | "hurt" | "enemyDeath" | "playerDeath" | "step" | "roll" | "dodge"
  | "pickupCommon" | "pickupRare" | "potion" | "levelUp" | "questAccept" | "questComplete"
  | "whirlwind" | "charge" | "warcry" | "secondWind" | "windup" | "bossRoar" | "bossPhase" | "drop" | "ui";

const VOL_KEY = "vale.audio";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private musicTimer = 0;
  private nextBeat = 0;
  private beat = 0;
  private bossMode = false;
  private lastStep = 0;
  volumes = { master: 0.8, sfx: 0.9, music: 0.5 };

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(VOL_KEY) ?? "null") as Partial<typeof this.volumes> | null;
      if (saved) this.volumes = { ...this.volumes, ...saved };
    } catch {
      /* padrão */
    }
  }

  /** Precisa de um gesto do usuário; chamado no primeiro clique. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();

    // Buffer de ruído branco reutilizado por passos, whoosh e impactos.
    const seconds = 1;
    this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.startMusic();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  /** Nível RMS do que está saindo agora (0 = silêncio). Útil para diagnóstico. */
  measureLevel(): Promise<number> {
    if (!this.ctx) return Promise.resolve(0);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 2048;
    this.master.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    return new Promise((resolve) => {
      let peak = 0;
      let samples = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += v * v;
        peak = Math.max(peak, Math.sqrt(sum / data.length));
        if (++samples < 30) requestAnimationFrame(tick);
        else {
          this.master.disconnect(analyser);
          resolve(peak);
        }
      };
      tick();
    });
  }

  setVolumes(v: Partial<typeof this.volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    try {
      localStorage.setItem(VOL_KEY, JSON.stringify(this.volumes));
    } catch {
      /* ignora */
    }
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.musicBus.gain.value = this.volumes.music * (this.bossMode ? 0.9 : 0.6);
  }

  setBossMode(on: boolean): void {
    if (this.bossMode === on) return;
    this.bossMode = on;
    this.applyVolumes();
  }

  // ---------- Efeitos ----------

  /**
   * Toca um efeito. `pan` em [-1, 1] e `distance` em metros para atenuação simples:
   * sons longe do herói ficam baixos, sons do próprio herói ficam cheios.
   */
  play(name: SfxName, opts: { pan?: number; distance?: number; pitch?: number } = {}): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const distance = opts.distance ?? 0;
    const att = 1 / (1 + (distance / 9) ** 2);
    if (att < 0.04) return;
    const out = ctx.createGain();
    out.gain.value = att;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0)) * 0.7;
    out.connect(panner).connect(this.sfxBus);
    const t = ctx.currentTime;
    const p = opts.pitch ?? 1;

    switch (name) {
      case "swing":
        this.noise(out, t, 0.14, { from: 1800 * p, to: 500, type: "bandpass", q: 1.2, gain: 0.35 });
        break;
      case "hit":
        this.noise(out, t, 0.09, { from: 900, to: 200, type: "lowpass", gain: 0.6 });
        this.tone(out, t, "square", 220 * p, 90, 0.08, 0.25);
        break;
      case "hurt":
        this.tone(out, t, "sawtooth", 180, 70, 0.18, 0.35);
        this.noise(out, t, 0.12, { from: 1200, to: 300, type: "lowpass", gain: 0.3 });
        break;
      case "enemyDeath":
        this.tone(out, t, "square", 300 * p, 60, 0.35, 0.3);
        this.noise(out, t + 0.05, 0.25, { from: 600, to: 120, type: "lowpass", gain: 0.4 });
        break;
      case "playerDeath":
        for (let i = 0; i < 4; i++) this.tone(out, t + i * 0.18, "triangle", 330 / (1 + i * 0.3), 100, 0.3, 0.3);
        break;
      case "step":
        this.noise(out, t, 0.06, { from: 500 * p, to: 200, type: "lowpass", gain: 0.18 });
        break;
      case "roll":
        this.noise(out, t, 0.3, { from: 400, to: 2200, type: "bandpass", q: 0.8, gain: 0.3 });
        break;
      case "dodge":
        this.tone(out, t, "sine", 1200, 1800, 0.12, 0.2);
        break;
      case "pickupCommon":
        this.tone(out, t, "triangle", 880, 880, 0.08, 0.25);
        this.tone(out, t + 0.07, "triangle", 1320, 1320, 0.12, 0.25);
        break;
      case "pickupRare":
        [660, 880, 1100, 1320].forEach((f, i) => this.tone(out, t + i * 0.07, "triangle", f * p, f * p, 0.18, 0.25));
        break;
      case "potion":
        this.tone(out, t, "sine", 300, 600, 0.12, 0.25);
        this.tone(out, t + 0.12, "sine", 400, 700, 0.12, 0.25);
        this.tone(out, t + 0.26, "triangle", 900, 1200, 0.2, 0.2);
        break;
      case "levelUp":
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(out, t + i * 0.09, "square", f, f, 0.25, 0.18));
        this.tone(out, t + 0.45, "triangle", 1568, 1568, 0.6, 0.2);
        break;
      case "questAccept":
        this.tone(out, t, "triangle", 587, 587, 0.12, 0.25);
        this.tone(out, t + 0.1, "triangle", 880, 880, 0.2, 0.25);
        break;
      case "questComplete":
        [392, 494, 587, 784].forEach((f, i) => this.tone(out, t + i * 0.12, "square", f, f, 0.3, 0.16));
        [784, 988, 1175].forEach((f, i) => this.tone(out, t + 0.5 + i * 0.1, "triangle", f, f, 0.5, 0.2));
        break;
      case "whirlwind":
        this.noise(out, t, 0.45, { from: 300, to: 2500, type: "bandpass", q: 1.5, gain: 0.4 });
        this.tone(out, t, "sawtooth", 110, 220, 0.4, 0.15);
        break;
      case "charge":
        this.noise(out, t, 0.35, { from: 200, to: 1800, type: "bandpass", q: 1, gain: 0.45 });
        this.tone(out, t, "square", 80, 160, 0.3, 0.2);
        break;
      case "warcry":
        this.tone(out, t, "sawtooth", 150, 320, 0.5, 0.3);
        this.tone(out, t + 0.05, "sawtooth", 152, 324, 0.5, 0.2);
        this.noise(out, t, 0.4, { from: 400, to: 1200, type: "bandpass", q: 2, gain: 0.2 });
        break;
      case "secondWind":
        [440, 554, 659, 880].forEach((f, i) => this.tone(out, t + i * 0.08, "sine", f, f * 1.01, 0.35, 0.2));
        break;
      case "windup":
        this.tone(out, t, "square", 220 * p, 220 * p, 0.08, 0.12);
        break;
      case "bossRoar":
        this.tone(out, t, "sawtooth", 70, 45, 0.9, 0.45);
        this.tone(out, t, "square", 110, 60, 0.9, 0.2);
        this.noise(out, t, 0.8, { from: 300, to: 100, type: "lowpass", gain: 0.5 });
        break;
      case "bossPhase":
        this.tone(out, t, "sawtooth", 90, 180, 0.5, 0.4);
        this.noise(out, t, 0.5, { from: 2000, to: 200, type: "lowpass", gain: 0.5 });
        break;
      case "drop":
        this.noise(out, t, 0.08, { from: 700, to: 250, type: "lowpass", gain: 0.25 });
        break;
      case "ui":
        this.tone(out, t, "sine", 700, 700, 0.05, 0.15);
        break;
    }
  }

  /** Passos do herói: chama a cada frame enquanto anda; o próprio método espaça os sons. */
  footstep(now: number, running: boolean): void {
    const interval = running ? 0.27 : 0.38;
    if (now - this.lastStep < interval) return;
    this.lastStep = now;
    this.play("step", { pitch: 0.9 + Math.random() * 0.3 });
  }

  private tone(out: GainNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(out: GainNode, t: number, dur: number, o: { from: number; to: number; type: BiquadFilterType; q?: number; gain: number }): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type;
    filter.Q.value = o.q ?? 0.7;
    filter.frequency.setValueAtTime(o.from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---------- Música generativa ----------

  /**
   * Trilha ambiente: um pad de acordes (Am, F, C, G) com notas de melodia pentatônica sorteadas.
   * No chefe entra um baixo pulsante e percussão de ruído em 130 bpm.
   */
  private startMusic(): void {
    const ctx = this.ctx!;
    this.nextBeat = ctx.currentTime + 0.1;
    this.beat = 0;
    const lookahead = 0.25;
    const schedule = () => {
      if (!this.ctx) return;
      while (this.nextBeat < ctx.currentTime + lookahead) {
        this.scheduleBeat(this.nextBeat, this.beat);
        const bpm = this.bossMode ? 130 : 84;
        this.nextBeat += 60 / bpm;
        this.beat++;
      }
    };
    schedule();
    this.musicTimer = window.setInterval(schedule, 100);
  }

  private scheduleBeat(t: number, beat: number): void {
    const ctx = this.ctx!;
    const CHORDS = [
      [220, 261.6, 329.6], // Am
      [174.6, 220, 261.6], // F
      [261.6, 329.6, 392], // C
      [196, 246.9, 293.7], // G
    ];
    const BOSS_CHORDS = [
      [220, 261.6, 329.6], // Am
      [207.7, 261.6, 311.1], // Ab dim-ish
      [220, 261.6, 329.6],
      [233.1, 277.2, 349.2], // Bb
    ];
    const barLen = 8;
    const chordIndex = Math.floor(beat / barLen) % 4;
    const chord = (this.bossMode ? BOSS_CHORDS : CHORDS)[chordIndex]!;

    // Pad no início de cada compasso.
    if (beat % barLen === 0) {
      const dur = (60 / (this.bossMode ? 130 : 84)) * barLen;
      for (const f of chord) {
        for (const detune of [-6, 6]) {
          const osc = ctx.createOscillator();
          osc.type = this.bossMode ? "sawtooth" : "triangle";
          osc.frequency.value = f / 2;
          osc.detune.value = detune;
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = this.bossMode ? 900 : 600;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.045, t + 0.8);
          g.gain.setValueAtTime(0.045, t + dur - 0.8);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.connect(filter).connect(g).connect(this.musicBus);
          osc.start(t);
          osc.stop(t + dur + 0.05);
        }
      }
    }

    // Melodia: nota pentatônica ocasional, suave.
    const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
    if (!this.bossMode && Math.random() < 0.3) {
      const f = chord[0]! * 2 * PENTA[Math.floor(Math.random() * PENTA.length)]!;
      this.pluck(f, t, 1.2, 0.05);
    }

    // Chefe: baixo pulsante e percussão.
    if (this.bossMode) {
      this.pluck(chord[0]! / 2, t, 0.25, 0.12, "square");
      if (beat % 2 === 0) this.drum(t, 110, 0.12);
      if (beat % 4 === 2) this.hat(t);
      if (Math.random() < 0.5) this.pluck(chord[Math.floor(Math.random() * 3)]! * 2, t + 0.5 * (60 / 130), 0.3, 0.05, "sawtooth");
    }
  }

  private pluck(f: number, t: number, dur: number, gain: number, type: OscillatorType = "triangle"): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private drum(t: number, f: number, gain: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private hat(t: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(filter).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.08);
  }

  dispose(): void {
    window.clearInterval(this.musicTimer);
    void this.ctx?.close();
    this.ctx = null;
  }
}
