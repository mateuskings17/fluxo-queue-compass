/** Browser speech + chime for the public panel. Call only from effects/handlers. */

let audioCtx: AudioContext | null = null;
let selectedVoice: SpeechSynthesisVoice | null = null;
// Keep a reference to the utterance being spoken: some browsers drop events of garbage-collected utterances.
let currentUtterance: SpeechSynthesisUtterance | null = null;

export type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang">;
export type VoiceChoice<V extends VoiceLike = VoiceLike> = { voice: V; female: boolean; brazilian: boolean };

const FEMALE_HINT =
  /\b(female|feminin[ao]|mulher)\b|francisca|thalita|luciana|camila|vit[oó]ria|fernanda|maria|helena|leila|let[ií]cia|manuela|yara|brenda|giovanna|elza|raquel|joana|pt-br-x-afs|pt-br-x-pte|google portugu[eê]s do brasil/i;
const MALE_HINT =
  /\b(male|masculin[oa]|homem)\b|daniel|ant[oô]nio|felipe|ricardo|donato|f[aá]bio|j[uú]lio|humberto|nicolau|val[eé]rio|pt-br-x-ptd/i;
const QUALITY_HINT = /natural|neural|online|premium|enhanced|google/i;

function normLang(lang: string) {
  return lang.replace("_", "-").toLowerCase();
}

/** Picks the best Portuguese voice, preferring a female Brazilian (pt-BR) voice. Pure, for testing. */
export function chooseFemalePtBrVoice<V extends VoiceLike>(voices: readonly V[]): VoiceChoice<V> | null {
  let best: { v: V; score: number; female: boolean; brazilian: boolean } | null = null;
  for (const v of voices) {
    const lang = normLang(v.lang);
    if (!lang.startsWith("pt")) continue;
    const brazilian = lang === "pt-br";
    const label = `${v.name} ${v.lang}`;
    const female = FEMALE_HINT.test(label);
    const male = !female && MALE_HINT.test(label);
    let score = brazilian ? 100 : 40;
    if (female) score += 50;
    if (male) score -= 60;
    if (QUALITY_HINT.test(v.name)) score += 10;
    if (!best || score > best.score) best = { v, score, female, brazilian };
  }
  return best ? { voice: best.v, female: best.female, brazilian: best.brazilian } : null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
}

/** Voices load asynchronously on most browsers (and slowly on TVs); wait for them briefly. */
function loadVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.("voiceschanged", onChange);
      clearInterval(poll);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const onChange = () => { if (synth.getVoices().length) finish(); };
    synth.addEventListener?.("voiceschanged", onChange);
    const poll = setInterval(onChange, 250);
    const timer = setTimeout(finish, timeoutMs);
  });
}

/** Resolves the female pt-BR voice once and caches it for every announcement. */
export async function prepareVoice(): Promise<VoiceChoice<SpeechSynthesisVoice> | null> {
  if (!isSpeechSynthesisSupported()) return null;
  const choice = chooseFemalePtBrVoice(await loadVoices());
  selectedVoice = choice?.voice ?? null;
  return choice;
}

function getAudioContext() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Must run inside a user gesture (click / remote OK key): unlocks audio output and the speech engine. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  if (ctx) void ctx.resume();
  if (isSpeechSynthesisSupported()) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
}

/**
 * After the TV restarts, tries to re-enable sound without a click.
 * Resolves true only when the browser lets the page speak; otherwise the panel asks for one press of OK.
 */
export async function tryRestoreAudio(): Promise<boolean> {
  if (!isSpeechSynthesisSupported()) return false;
  const ctx = getAudioContext();
  if (ctx) {
    await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 800))]);
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(".");
    u.volume = 0;
    u.lang = "pt-BR";
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    u.onstart = () => finish(true);
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    // No event at all means the engine is silently blocked or broken: ask for a press instead of guessing.
    const timer = setTimeout(() => {
      window.speechSynthesis.cancel();
      finish(false);
    }, 2000);
    currentUtterance = u;
    window.speechSynthesis.speak(u);
  });
}

export function playChime(volume = 1): Promise<void> {
  return new Promise((resolve) => {
    if (!audioCtx || audioCtx.state !== "running") return resolve();
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

export function speak(text: string, opts: { volume: number; rate: number }): Promise<void> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) return resolve();
    const synth = window.speechSynthesis;
    if (!selectedVoice) selectedVoice = chooseFemalePtBrVoice(synth.getVoices())?.voice ?? null;
    // Clear anything stuck from a previous utterance; the announcer guarantees ours has finished.
    if (synth.speaking || synth.pending) synth.cancel();
    synth.resume();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    if (selectedVoice) u.voice = selectedVoice;
    u.volume = Math.min(1, Math.max(0, opts.volume));
    u.rate = Math.min(2, Math.max(0.5, opts.rate));
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (currentUtterance === u) currentUtterance = null;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    // Some TV engines never fire "end": release the queue after a generous estimate of the speaking time.
    const timeout = setTimeout(() => {
      synth.cancel();
      finish();
    }, Math.max(8000, (text.length * 160) / u.rate) + 4000);
    currentUtterance = u;
    synth.speak(u);
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
