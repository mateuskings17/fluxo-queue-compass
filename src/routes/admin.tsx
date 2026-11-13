import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { configQuery } from "@/lib/queue";
import { useConfigRealtime } from "@/hooks/use-realtime";
import { PageHeader } from "@/components/queue/PageHeader";
import { RouteError, RouteNotFound } from "@/components/queue/RouteError";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelVoiceSettings, UnitSettings } from "@/components/admin/UnitSettings";
import { QueuesAdmin, RoutingAdmin, SectorsAdmin, StationsAdmin, TicketTypesAdmin } from "@/components/admin/StructureAdmin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Gestão de Filas" },
      { name: "description", content: "Configure unidade, setores, guichês, salas, tipos de senha, voz e painel." },
      { property: "og:title", content: "Administração — Gestão de Filas" },
      { property: "og:description", content: "Configure unidade, setores, guichês, salas, tipos de senha, voz e painel." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(configQuery),
  component: Admin,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const TABS = [
  ["unidade", "Unidade"],
  ["painel", "Painel e voz"],
  ["setores", "Setores"],
  ["posicoes", "Guichês e salas"],
  ["senhas", "Tipos de senha"],
  ["encaminhamento", "Encaminhamento"],
  ["filas", "Filas"],
] as const;

function Admin() {
  const { data: config } = useSuspenseQuery(configQuery);
  useConfigRealtime();
  return (
    <div className="min-h-screen">
      <PageHeader settings={config.settings} title="Administração" />
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <Tabs defaultValue="unidade">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-secondary p-1">
            {TABS.map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="px-4 py-2">{l}</TabsTrigger>
            ))}
          </TabsList>
          <div className="mt-6">
            <TabsContent value="unidade"><UnitSettings key={config.settings.updated_at} settings={config.settings} /></TabsContent>
            <TabsContent value="painel"><PanelVoiceSettings key={config.settings.updated_at} settings={config.settings} /></TabsContent>
            <TabsContent value="setores"><SectorsAdmin config={config} /></TabsContent>
            <TabsContent value="posicoes"><StationsAdmin config={config} /></TabsContent>
            <TabsContent value="senhas"><TicketTypesAdmin config={config} /></TabsContent>
            <TabsContent value="encaminhamento"><RoutingAdmin config={config} /></TabsContent>
            <TabsContent value="filas"><QueuesAdmin config={config} /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
