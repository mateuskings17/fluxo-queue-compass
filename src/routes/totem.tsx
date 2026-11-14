import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Printer, Star } from "lucide-react";
import { configQuery, issueTicket, type Ticket } from "@/lib/queue";
import { useConfigRealtime } from "@/hooks/use-realtime";
import { UnitLogo } from "@/components/queue/Brand";
import { Button } from "@/components/ui/button";
import { Clock } from "@/components/queue/Clock";
import { RouteError, RouteNotFound } from "@/components/queue/RouteError";

export const Route = createFileRoute("/totem")({
  head: () => ({
    meta: [
      { title: "Totem de senhas" },
      { name: "description", content: "Retire sua senha de atendimento." },
      { property: "og:title", content: "Totem de senhas" },
      { property: "og:description", content: "Retire sua senha de atendimento." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(configQuery),
  component: Totem,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const AUTO_CLOSE_SECONDS = 8;

function Totem() {
  const { data } = useSuspenseQuery(configQuery);
  useConfigRealtime();
  const { settings } = data;
  const types = data.ticketTypes.filter((t) => t.active);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<Ticket | null>(null);
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);

  useEffect(() => {
    if (!issued) return;
    setCountdown(AUTO_CLOSE_SECONDS);
    const i = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(i);
  }, [issued]);

  useEffect(() => {
    if (issued && countdown <= 0) setIssued(null);
  }, [countdown, issued]);

  async function handleIssue(typeId: string) {
    if (busy) return;
    setBusy(typeId);
    try {
      const t = await issueTicket(typeId);
      setIssued(t);
    } catch (e) {
      toast.error("Não foi possível emitir a senha", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <header className="flex items-center gap-4 px-6 py-5 md:px-10">
        <UnitLogo settings={settings} className="h-12 w-12" />
        <div className="text-xl font-bold md:text-2xl">{settings.unit_name}</div>
        <div className="ml-auto text-right">
          <Clock className="text-2xl font-bold tabular-nums" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-10">
        <h1 className="text-center text-4xl font-extrabold md:text-6xl">{settings.totem_title}</h1>
        <p className="mt-3 text-center text-lg text-muted-foreground md:text-2xl">{settings.totem_message}</p>

        <div className={`mt-10 grid gap-5 ${types.length > 3 ? "md:grid-cols-2" : ""}`}>
          {types.map((t, i) => (
            <button
              key={t.id}
              onClick={() => handleIssue(t.id)}
              disabled={!!busy}
              className={`group animate-rise flex items-center gap-6 rounded-3xl border-2 p-6 text-left shadow-soft transition-all active:scale-[0.99] disabled:opacity-60 md:p-8 ${
                t.priority
                  ? "border-priority/30 bg-priority-soft hover:border-priority"
                  : "border-primary/15 bg-card hover:border-primary"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-2xl font-extrabold md:h-24 md:w-24 ${
                  t.priority ? "bg-priority text-priority-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                {t.priority ? <Star className="h-10 w-10" /> : <span className="ticket-code">{t.prefix || "#"}</span>}
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-extrabold md:text-3xl">{t.name}</div>
                {t.description && <div className="mt-1 text-base text-muted-foreground md:text-lg">{t.description}</div>}
              </div>
              <div className="ml-auto hidden text-lg font-semibold text-primary md:block">
                {busy === t.id ? "Emitindo…" : "Tocar"}
              </div>
            </button>
          ))}
          {types.length === 0 && (
            <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              Nenhum tipo de senha ativo. Configure na Administração.
            </p>
          )}
        </div>
      </main>

      <footer className="flex justify-start px-6 pb-4">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> menu
        </Link>
      </footer>

      {issued && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-6 backdrop-blur-sm" onClick={() => setIssued(null)}>
          <div className="animate-rise w-full max-w-lg rounded-3xl bg-card p-10 text-center shadow-lift" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-medium text-muted-foreground">Sua senha é</p>
            <div className="ticket-code mt-3 text-8xl text-primary md:text-9xl">{issued.code}</div>
            <p className="mt-4 text-xl font-semibold">{issued.type_name}</p>
            <p className="mt-1 text-muted-foreground">
              {new Date(issued.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
            <p className="mt-6 text-lg">Aguarde a chamada no painel.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" size="xl" className="flex-1" onClick={() => window.print()}>
                <Printer /> Imprimir
              </Button>
              <Button size="xl" className="flex-1" onClick={() => setIssued(null)}>
                Concluir ({Math.max(countdown, 0)})
              </Button>
            </div>
          </div>
          <div className="print-ticket hidden">
            <div style={{ width: "72mm", height: "50mm", boxSizing: "border-box", paddingTop: "3mm", overflow: "hidden", textAlign: "center", fontFamily: "sans-serif" }}>
              <div style={{ fontSize: "11pt", fontWeight: 700, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{settings.unit_name}</div>
              <div style={{ fontSize: "8pt", marginTop: "2mm" }}>SENHA</div>
              <div style={{ fontSize: "36pt", fontWeight: 800, lineHeight: 1 }}>{issued.code}</div>
              <div style={{ fontSize: "10pt", marginTop: "1.5mm", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{issued.type_name}</div>
              <div style={{ fontSize: "8pt", marginTop: "1.5mm" }}>
                {new Date(issued.created_at).toLocaleString("pt-BR")}
              </div>
              <div style={{ fontSize: "8pt", marginTop: "1mm" }}>Aguarde a chamada no painel</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
