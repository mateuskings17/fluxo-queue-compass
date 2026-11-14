import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardList, Monitor, ScanLine, Settings2, TestTube2, Ticket, Bone, Building2, ArrowUpRight } from "lucide-react";
import { configQuery, type Sector } from "@/lib/queue";
import { useConfigRealtime } from "@/hooks/use-realtime";
import { UnitLogo } from "@/components/queue/Brand";
import { RouteError, RouteNotFound } from "@/components/queue/RouteError";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Menu — Gestão de Filas e Senhas" },
      { name: "description", content: "Acesse o totem, o painel público, a recepção, os setores de exames, a administração e os relatórios." },
      { property: "og:title", content: "Menu — Gestão de Filas e Senhas" },
      { property: "og:description", content: "Acesse o totem, o painel público, os setores de atendimento e a administração." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(configQuery),
  component: Index,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function sectorIcon(s: Sector) {
  const n = s.name.toLowerCase();
  if (s.kind === "reception") return ClipboardList;
  if (n.includes("raio")) return Bone;
  if (n.includes("tomo")) return ScanLine;
  if (n.includes("colet")) return TestTube2;
  return Building2;
}

function Index() {
  const { data } = useSuspenseQuery(configQuery);
  useConfigRealtime();
  const { settings } = data;
  const sectors = data.sectors.filter((s) => s.active);

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto max-w-6xl px-5 py-10 md:py-16">
        <div className="flex items-center gap-4">
          <UnitLogo settings={settings} className="h-14 w-14" />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Gestão de filas</p>
            <h1 className="text-3xl font-extrabold md:text-4xl">{settings.unit_name}</h1>
          </div>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <BigTile to="/totem" icon={Ticket} title="Totem de emissão de senha" text="Tela para o paciente retirar a senha" tone="primary" />
          <BigTile to="/painel" icon={Monitor} title="Painéis por setor" text="Mamografia, Tomografia, Recepção, Ultrassom e Endoscopia" tone="panel" />
        </section>

        <h2 className="mt-12 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Atendimento</h2>
        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sectors.map((s, i) => {
            const Icon = sectorIcon(s);
            return (
              <Link
                key={s.id}
                to="/atendimento/$sectorId"
                params={{ sectorId: s.id }}
                className="group animate-rise rounded-2xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {data.stations.filter((st) => st.sector_id === s.id && st.active).length} {s.station_label.toLowerCase()}(s)
                </p>
              </Link>
            );
          })}
          {sectors.length === 0 && (
            <p className="col-span-full rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              Nenhum setor ativo. Cadastre setores na Administração.
            </p>
          )}
        </section>

        <h2 className="mt-12 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gestão</h2>
        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <SmallTile to="/admin" icon={Settings2} title="Administração" text="Unidade, setores, guichês, senhas, voz e painel" />
          <SmallTile to="/relatorios" icon={BarChart3} title="Relatórios" text="Tempos, volumes e histórico de cada senha" />
        </section>
      </div>
    </div>
  );
}

function BigTile({ to, icon: Icon, title, text, tone }: { to: "/totem" | "/painel"; icon: typeof Ticket; title: string; text: string; tone: "primary" | "panel" }) {
  const toneCls = tone === "primary" ? "bg-primary text-primary-foreground" : "bg-panel-gradient text-panel-foreground";
  return (
    <Link to={to} className={`group relative overflow-hidden rounded-3xl p-7 shadow-lift transition-transform hover:-translate-y-0.5 ${toneCls}`}>
      <Icon className="h-9 w-9 opacity-90" />
      <h3 className="mt-8 text-2xl font-extrabold">{title}</h3>
      <p className="mt-1 opacity-80">{text}</p>
      <ArrowUpRight className="absolute right-6 top-6 h-6 w-6 opacity-70 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
    </Link>
  );
}

function SmallTile({ to, icon: Icon, title, text }: { to: "/admin" | "/relatorios"; icon: typeof Ticket; title: string; text: string }) {
  return (
    <Link to={to} className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-soft transition-all hover:shadow-lift">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-secondary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h3 className="font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
