import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Maximize, Volume2, Monitor } from "lucide-react";
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
import { callsForSector } from "@/lib/panel-calls";
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
  validateSearch: z.object({ setor: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ sectorId: search.setor }),
  head: () => ({
    meta: [
      { title: "Painéis por setor — Gestão de Filas" },
      { name: "description", content: "Painel público com as senhas chamadas e o local de atendimento." },
      { property: "og:title", content: "Painéis por setor — Gestão de Filas" },
      { property: "og:description", content: "Painel público com as senhas chamadas e o local de atendimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, deps }) => {
    const config = await context.queryClient.ensureQueryData(configQuery);
    const sector = config.sectors.find((s) => s.id === deps.sectorId && s.active);
    if (deps.sectorId && !sector) throw notFound();
    if (sector) await context.queryClient.ensureQueryData(recentCallsQuery(CALLS_LIMIT, sector.id));
    return { sectorName: sector?.name };
  },
  component: PanelEntry,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function PanelEntry() {
  const { setor } = Route.useSearch();
  const { data: config } = useSuspenseQuery(configQuery);
  useConfigRealtime();
  if (setor) return <Panel key={setor} sectorId={setor} />;
  return (
    <div className="min-h-screen bg-hero px-5 py-10">
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" asChild><Link to="/"><ArrowLeft /> Menu</Link></Button>
        <h1 className="mt-6 text-3xl font-bold">Painéis por setor</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {config.sectors.filter((s) => s.active).map((s) => (
            <Button key={s.id} variant="outline" asChild className="h-auto justify-start gap-3 whitespace-normal p-6 text-left text-lg">
              <Link to="/painel" search={{ setor: s.id }}><Monitor className="shrink-0" />{s.name}</Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Panel({ sectorId }: { sectorId: string }) {
  const { data: config } = useSuspenseQuery(configQuery);
  const { data: fetchedCalls, dataUpdatedAt } = useSuspenseQuery(recentCallsQuery(CALLS_LIMIT, sectorId));
  const calls = callsForSector(fetchedCalls, sectorId);
  const sector = config.sectors.find((s) => s.id === sectorId);
  const voiceKey = `${VOICE_KEY}:${sectorId}`;
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
  const activePanelRef = useRef(true);

  useEffect(() => {
    activePanelRef.current = true;
    return () => {
      activePanelRef.current = false;
      announcerRef.current = null;
      if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  useRealtimeInvalidate(["calls"], [["calls"]], 8000);

  async function reportVoice(manual: boolean) {
    const choice = await prepareVoice();
    if (!choice) {
      setVoiceStatus({ tone: "warn", text: "Nenhuma voz em português instalada nesta TV. Instale o pacote de voz pt-BR nas configurações da TV." });
    } else if (manual && choice.brazilian && choice.female) {
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
      remembered = window.localStorage.getItem(voiceKey) === "1";
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
        if (!activePanelRef.current) return;
        setFlashKey(call.id);
        const s = settingsRef.current;
        const volume = Number(s.voice_volume);
        if (s.chime_enabled) await playChime(volume);
        if (s.voice_enabled && activePanelRef.current) {
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

  // Rows must never clip their text: measure the list, drop the oldest calls that
  // would not fit legibly, and size every line of text to the height each row gets.
  const listRef = useRef<HTMLUListElement>(null);
  const [listH, setListH] = useState(0);
  useEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    const measure = () => setListH(ul.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    return () => ro.disconnect();
  }, []);

  const ROW_GAP = 8;
  const MIN_ROW = 46;
  const visible =
    listH > 0
      ? Math.max(1, Math.min(history.length, Math.floor((listH + ROW_GAP) / (MIN_ROW + ROW_GAP))))
      : history.length;
  const shown = history.slice(0, visible);
  const rowH = visible > 0 ? Math.max(MIN_ROW, (listH - (visible - 1) * ROW_GAP) / visible) : MIN_ROW;

  function goFullscreen() {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement) return;
    try {
      const r = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.();
      if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => {});
    } catch {
      /* fullscreen not allowed */
    }
  }

  // Browsers only allow fullscreen after a touch/click/key, so enter it on the first interaction.
  useEffect(() => {
    const onFirst = () => goFullscreen();
    window.addEventListener("pointerdown", onFirst);
    window.addEventListener("keydown", onFirst);
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, []);

  function enableSound() {
    if (activatingRef.current) return;
    activatingRef.current = true;
    goFullscreen();
    if (!isSpeechSynthesisSupported()) {
      setSpeechAvailable(false);
      setSoundOn(true);
      setVoiceStatus({ tone: "warn", text: "Este navegador não suporta voz (SpeechSynthesis). O painel funciona sem anúncios falados." });
      window.alert("Este navegador não oferece suporte à síntese de voz (SpeechSynthesis). O painel continuará funcionando sem anúncios falados.");
      return;
    }
    unlockAudio();
    try {
      window.localStorage.setItem(voiceKey, "1");
    } catch {
      /* storage unavailable */
    }
    setSoundOn(true);
    void reportVoice(true);
    // Short spoken confirmation so whoever sets up the TV hears that its speakers work.
    announcerRef.current?.(async () => {
      if (!activePanelRef.current) return;
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
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-panel-gradient text-panel-foreground">
      <header className="flex items-center gap-5 border-b border-panel-border px-6 py-3">
        <UnitLogo settings={settings} className="h-12 w-12" />
        <div>
          <div className="text-2xl font-bold">{settings.unit_name}</div>
          <div className="text-sm uppercase tracking-[0.2em] text-panel-muted">{settings.panel_title} · {sector?.name}</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Clock withDate className="text-3xl font-bold tabular-nums" />
          <Button variant="panel" size="icon" onClick={goFullscreen} title="Tela cheia">
            <Maximize />
          </Button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[1.6fr_1fr] gap-4 overflow-hidden p-4 lg:gap-6 lg:p-6">
        <section
          key={flashKey ?? current?.id ?? "none"}
          className={`flex flex-col items-center justify-center min-h-0 rounded-[2rem] border border-panel-border bg-panel-raised p-6 text-center ${
            flashKey && current && flashKey === current.id ? "animate-call-flash" : ""
          }`}
        >
          {current ? (
            <>
              <div className="text-2xl font-semibold uppercase tracking-[0.3em] text-panel-muted">Senha</div>
              <div className="ticket-code mt-4 text-[clamp(4rem,min(15vw,26vh),16rem)] text-call">{current.code}</div>
              {current.priority && (
                <div className="mt-2 rounded-full bg-priority px-4 py-1 text-lg font-semibold text-priority-foreground">Preferencial</div>
              )}
              <div className="mt-4 text-[clamp(1.5rem,min(3.4vw,6vh),3.6rem)] font-bold leading-tight">{current.sector_name}</div>
              <div className="mt-2 text-[clamp(1.25rem,min(2.8vw,5vh),3rem)] font-semibold text-call">{current.station_name}</div>
            </>
          ) : (
            <div className="text-3xl text-panel-muted">Aguardando chamadas…</div>
          )}
        </section>

        <section className="flex min-h-0 flex-col rounded-[2rem] border border-panel-border bg-panel-raised/60 p-6">
          <h2 className="text-lg font-semibold uppercase tracking-[0.2em] text-panel-muted">Últimas chamadas</h2>
          <ul ref={listRef} className="mt-3 grid min-h-0 flex-1 auto-rows-fr gap-2 overflow-hidden">
            {shown.map((c) => (
              <li key={c.id} className="animate-rise flex min-h-0 items-center gap-3 rounded-2xl border border-panel-border bg-panel px-3 py-1">
                <span className="ticket-code shrink-0 leading-none" style={{ fontSize: rowH * 0.42 }}>
                  {c.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="leading-tight font-semibold" style={{ fontSize: rowH * 0.23 }}>
                    {c.sector_name}
                  </div>
                  <div className="leading-tight text-call" style={{ fontSize: rowH * 0.2 }}>
                    {c.station_name}
                  </div>
                </div>
                <span className="shrink-0 text-panel-muted tabular-nums" style={{ fontSize: rowH * 0.16 }}>
                  {formatTime(c.created_at)}
                </span>
              </li>
            ))}
            {shown.length === 0 && <li className="text-panel-muted">Sem chamadas anteriores.</li>}
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
