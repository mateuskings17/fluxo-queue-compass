/** Browser speech + chime for the public panel. Call only from effects/handlers. */

let audioCtx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  void audioCtx.resume();
  // Warm up speech engine (some browsers need a user gesture)
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
}

export function playChime(volume = 1): Promise<void> {
  return new Promise((resolve) => {
    if (!audioCtx) return resolve();
    const ctx = audioCtx;
    const notes = [880, 1174.66, 1567.98];
    const start = ctx.currentTime + 0.02;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = start + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35 * volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
    setTimeout(resolve, 950);
  });
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const brazilian = voices.filter((voice) => voice.lang.toLowerCase() === "pt-br");
  const female = brazilian.find((voice) =>
    /female|feminina|francisca|luciana|camila|fernanda|maria|helena|brasil.*fem/i.test(voice.name),
  );

  return (
    female ||
    brazilian.find((voice) => /google|natural|online/i.test(voice.name)) ||
    brazilian[0] ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("pt"))
  );
}

export function speak(text: string, opts: { volume: number; rate: number }): Promise<void> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    const v = pickVoice();
    if (v) u.voice = v;
    u.volume = Math.min(1, Math.max(0, opts.volume));
    u.rate = Math.min(2, Math.max(0.5, opts.rate));
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    const timeout = setTimeout(() => {
      window.speechSynthesis.cancel();
      finish();
    }, 30000);
    window.speechSynthesis.speak(u);
  });
}

/** Sequential announcement queue so overlapping calls never talk over each other. */
export function createAnnouncer() {
  let chain: Promise<void> = Promise.resolve();
  return (job: () => Promise<void>) => {
    chain = chain.then(job).catch(() => undefined);
    return chain;
  };
}
