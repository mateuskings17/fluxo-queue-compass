import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Maximize, Volume2 } from "lucide-react";
import { buildAnnouncement, configQuery, recentCallsQuery, formatTime, type Call } from "@/lib/queue";
import {
  createAnnouncer,
  isSpeechSynthesisSupported,
  playChime,
  prepareVoice,
  speak,
  tryRestoreAudio,
  unlockAudio,
} from "@/lib/voice";
import { pickCallsToAnnounce } from "@/lib/announce";
import { useConfigRealtime, useRealtimeInvalidate } from "@/hooks/use-realtime";
import { UnitLogo } from "@/components/queue/Brand";
import { Clock } from "@/components/queue/Clock";
import { Button } from "@/components/ui/button";
import { RouteError, RouteNotFound } from "@/components/queue/RouteError";

const CALLS_LIMIT = 13;
/** Remembers on this TV that the voice was activated, so a restart re-enables it. */
const VOICE_KEY = "painel.voz.ativada";

type VoiceStatus = { tone: "ok" | "warn"; text: string } | null;

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel de chamadas" },
      { name: "description", content: "Painel público com as senhas chamadas e o local de atendimento." },
      { property: "og:title", content: "Painel de chamadas" },
      { property: "og:description", content: "Painel público com as senhas chamadas e o local de atendimento." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(configQuery),
      context.queryClient.ensureQueryData(recentCallsQuery(CALLS_LIMIT)),
    ]);
  },
  component: Panel,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function Panel() {
  const { data: config } = useSuspenseQuery(configQuery);
  const { data: calls, dataUpdatedAt } = useSuspenseQuery(recentCallsQuery(CALLS_LIMIT));
  useConfigRealtime();
  const { settings } = config;
  const [soundOn, setSoundOn] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const seenCallIdsRef = useRef<Set<string>>(new Set(calls.map((call) => call.id)));
  const lastUpdateRef = useRef(dataUpdatedAt);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const announcerRef = useRef<ReturnType<typeof createAnnouncer> | null>(null);
  const activatingRef = useRef(false);

  useRealtimeInvalidate(["calls"], [["calls"]], 8000);

  async function reportVoice(manual: boolean) {
    const choice = await prepareVoice();
    if (!choice) {
      setVoiceStatus({ tone: "warn", text: "Nenhuma voz em português instalada nesta TV. Instale o pacote de voz pt-BR nas configurações da TV." });
    } else if (!choice.brazilian || !choice.female) {
      setVoiceStatus({ tone: "warn", text: `Voz em uso: ${choice.voice.name}. Voz feminina pt-BR não encontrada nesta TV.` });
    } else if (manual) {
      setVoiceStatus({ tone: "ok", text: `Voz ativada: ${choice.voice.name}` });
    }
  }

  useEffect(() => {
    const supported = isSpeechSynthesisSupported();
    setSpeechAvailable(supported);
    announcerRef.current = createAnnouncer();
    if (!supported) return;
    void prepareVoice();
    // After a TV restart, re-enable voice automatically when the browser allows it.
    let remembered = false;
    try {
      remembered = window.localStorage.getItem(VOICE_KEY) === "1";
    } catch {
      /* storage unavailable */
    }
    if (!remembered) return;
    setRestoring(true);
    let cancelled = false;
    void tryRestoreAudio().then((ok) => {
      if (cancelled) return;
      setRestoring(false);
      if (ok) {
        setSoundOn(true);
        void reportVoice(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Announce each new call once, oldest first; old calls (before activation, or missed while the TV slept) stay silent.
  useEffect(() => {
    const gapMs = dataUpdatedAt - lastUpdateRef.current;
    lastUpdateRef.current = dataUpdatedAt;
    const fresh = pickCallsToAnnounce(calls, seenCallIdsRef.current, { soundOn: soundRef.current, gapMs });
    fresh.forEach((call: Call) => {
      announcerRef.current?.(async () => {
        setFlashKey(call.id);
        const s = settingsRef.current;
        const volume = Number(s.voice_volume);
        if (s.chime_enabled) await playChime(volume);
        if (s.voice_enabled) {
          const text = buildAnnouncement(s.voice_template, call, true);
          await speak(text, { volume, rate: Number(s.voice_rate) });
        }
        await new Promise((r) => setTimeout(r, 600));
      });
    });
  }, [calls, dataUpdatedAt]);

  useEffect(() => {
    if (voiceStatus?.tone !== "ok") return;
    const t = setTimeout(() => setVoiceStatus(null), 10000);
    return () => clearTimeout(t);
  }, [voiceStatus]);

  const current = calls[0];
  const history = calls.slice(1, 1 + Math.max(1, settings.panel_history_count));

  function enableSound() {
    if (activatingRef.current) return;
    activatingRef.current = true;
    if (!isSpeechSynthesisSupported()) {
      setSpeechAvailable(false);
      setSoundOn(true);
      setVoiceStatus({ tone: "warn", text: "Este navegador não suporta voz (SpeechSynthesis). O painel funciona sem anúncios falados." });
      window.alert("Este navegador não oferece suporte à síntese de voz (SpeechSynthesis). O painel continuará funcionando sem anúncios falados.");
      return;
    }
    unlockAudio();
    try {
      window.localStorage.setItem(VOICE_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    setSoundOn(true);
    void reportVoice(true);
    // Short spoken confirmation so whoever sets up the TV hears that its speakers work.
    announcerRef.current?.(async () => {
      const s = settingsRef.current;
      await speak("Voz ativada.", { volume: Number(s.voice_volume), rate: Number(s.voice_rate) });
    });
  }

  // TV remotes: any key (OK, Enter, arrows) activates the voice while the prompt is showing.
  const enableRef = useRef(enableSound);
  enableRef.current = enableSound;
  useEffect(() => {
    if (soundOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return;
      e.preventDefault();
      enableRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [soundOn]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-panel-gradient text-panel-foreground">
      <header className="flex items-center gap-5 border-b border-panel-border px-8 py-4">
        <UnitLogo settings={settings} className="h-12 w-12" />
        <div>
          <div className="text-2xl font-bold">{settings.unit_name}</div>
          <div className="text-sm uppercase tracking-[0.2em] text-panel-muted">{settings.panel_title}</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Clock withDate className="text-3xl font-bold tabular-nums" />
          <Button variant="panel" size="icon" onClick={() => document.documentElement.requestFullscreen?.()} title="Tela cheia">
            <Maximize />
          </Button>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[1.6fr_1fr] lg:p-8">
        <section
          key={flashKey ?? current?.id ?? "none"}
          className={`flex flex-col items-center justify-center rounded-[2rem] border border-panel-border bg-panel-raised p-8 text-center ${
            flashKey && current && flashKey === current.id ? "animate-call-flash" : ""
          }`}
        >
          {current ? (
            <>
              <div className="text-2xl font-semibold uppercase tracking-[0.3em] text-panel-muted">Senha</div>
              <div className="ticket-code mt-4 text-[clamp(6rem,17vw,16rem)] text-call">{current.code}</div>
              {current.priority && (
                <div className="mt-2 rounded-full bg-priority px-4 py-1 text-lg font-semibold text-priority-foreground">Preferencial</div>
              )}
              <div className="mt-8 text-[clamp(1.8rem,3.6vw,3.6rem)] font-bold leading-tight">{current.sector_name}</div>
              <div className="mt-2 text-[clamp(1.5rem,3vw,3rem)] font-semibold text-call">{current.station_name}</div>
            </>
          ) : (
            <div className="text-3xl text-panel-muted">Aguardando chamadas…</div>
          )}
        </section>

        <section className="flex min-h-0 flex-col rounded-[2rem] border border-panel-border bg-panel-raised/60 p-6">
          <h2 className="text-lg font-semibold uppercase tracking-[0.2em] text-panel-muted">Últimas chamadas</h2>
          <ul className="mt-4 flex-1 space-y-3 overflow-hidden">
            {history.map((c) => (
              <li key={c.id} className="animate-rise flex items-center gap-4 rounded-2xl border border-panel-border bg-panel px-5 py-3">
                <span className="ticket-code w-36 shrink-0 text-5xl">{c.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xl font-semibold">{c.sector_name}</div>
                  <div className="truncate text-lg text-call">{c.station_name}</div>
                </div>
                <span className="text-sm text-panel-muted tabular-nums">{formatTime(c.created_at)}</span>
              </li>
            ))}
            {history.length === 0 && <li className="text-panel-muted">Sem chamadas anteriores.</li>}
          </ul>
        </section>
      </main>

      <footer className="flex items-center overflow-hidden border-t border-panel-border bg-panel">
        <Link to="/" className="flex items-center gap-1 px-4 py-4 text-xs text-panel-muted/60 hover:text-panel-muted">
          <ArrowLeft className="h-3 w-3" />
        </Link>
        <div className="relative flex-1 overflow-hidden py-4">
          <div className="flex w-max animate-ticker gap-24 whitespace-nowrap text-xl font-medium">
            <span>{settings.panel_message}</span>
            <span aria-hidden>{settings.panel_message}</span>
            <span>{settings.panel_message}</span>
            <span aria-hidden>{settings.panel_message}</span>
          </div>
        </div>
      </footer>

      {voiceStatus && (
        <div
          role="status"
          className={`fixed bottom-20 right-6 z-40 max-w-md rounded-2xl border px-5 py-3 text-base shadow-lg ${
            voiceStatus.tone === "ok"
              ? "border-panel-border bg-panel-raised text-panel-foreground"
              : "border-priority bg-panel-raised text-panel-foreground"
          }`}
        >
          {voiceStatus.text}
        </div>
      )}

      {!soundOn && !restoring && (
        <button
          autoFocus
          onClick={enableSound}
          className="fixed inset-0 z-50 grid place-items-center bg-panel/80 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-panel-border bg-panel-raised px-12 py-10">
            <Volume2 className="h-14 w-14 text-call" />
            <div className="text-3xl font-bold">ATIVAR VOZ</div>
            <div className="text-panel-muted">
              {speechAvailable
                ? "Toque ou pressione OK no controle remoto para liberar os anúncios pelos alto-falantes da TV."
                : "Este navegador não oferece suporte à síntese de voz. O painel continuará funcionando sem anúncios falados."}
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
