import { useState } from "react";
import { Plus, RotateCcw, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  closeOpenTicketsFn, createSectorFn, updateSectorFn, deleteSectorFn, createStationFn, updateStationFn, deleteStationFn, createRoutingRuleFn, createTicketTypeFn, deleteRoutingRuleFn, deleteTicketTypeFn,
  resetTicketNumberingFn, updateRoutingRuleFn, updateTicketTypeFn,
} from "@/lib/queue.functions";
import { CALL_MODE_LABEL, nextTicketCode, todayISO, type AppConfig, type RoutingRule, type Sector, type Station, type TicketType } from "@/lib/queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, NativeSelect, Section, useConfigMutation } from "./shared";
import { cn } from "@/lib/utils";

/* ------------------------------ Sectors ------------------------------ */

export function SectorsAdmin({ config }: { config: AppConfig }) {
  const { mutate, saving } = useConfigMutation();
  return (
    <Section
      title="Setores"
      description="Cada setor tem sua própria fila e tela de atendimento. O setor do tipo Recepção recebe as senhas do totem por padrão."
      actions={
        <Button
          disabled={saving}
          onClick={() =>
            mutate(() => createSectorFn({ data: { sort_order: config.sectors.length + 1 } }), "Setor criado")
          }
        >
          <Plus /> Novo setor
        </Button>
      }
    >
      <div className="space-y-3">
        {config.sectors.map((s) => (
          <SectorRow key={s.id + s.name + s.call_phrase + s.active + s.kind + s.station_label + s.sort_order} sector={s} />
        ))}
      </div>
    </Section>
  );
}

function SectorRow({ sector }: { sector: Sector }) {
  const [f, setF] = useState({
    name: sector.name, kind: sector.kind, call_phrase: sector.call_phrase, station_label: sector.station_label, sort_order: sector.sort_order, active: sector.active,
  });
  const { mutate, saving } = useConfigMutation();
  return (
    <div className="grid items-end gap-3 rounded-xl border p-4 md:grid-cols-[1.3fr_1fr_1.3fr_0.9fr_0.5fr_auto_auto]">
      <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Tipo">
        <NativeSelect value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="reception">Recepção</option>
          <option value="service">Atendimento / exame</option>
        </NativeSelect>
      </Field>
      <Field label="Chamada por voz"><Input value={f.call_phrase} placeholder="ex.: ao Raio-X" onChange={(e) => setF({ ...f, call_phrase: e.target.value })} /></Field>
      <Field label="Nome das posições"><Input value={f.station_label} placeholder="Guichê, Sala…" onChange={(e) => setF({ ...f, station_label: e.target.value })} /></Field>
      <Field label="Ordem"><Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></Field>
      <Field label="Ativo"><div className="flex h-9 items-center"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></div></Field>
      <div className="flex gap-1">
        <Button disabled={saving} onClick={() => mutate(() => updateSectorFn({ data: { id: sector.id, values: f as never } }))}>Salvar</Button>
        <Button
          variant="ghost"
          size="icon"
          title="Excluir"
          onClick={() => {
            if (window.confirm(`Excluir o setor ${sector.name}? As salas/guichês dele também serão removidos. O histórico é mantido.`)) {
              void mutate(() => deleteSectorFn({ data: { id: sector.id } }), "Setor excluído");
            }
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ Stations ------------------------------ */

export function StationsAdmin({ config }: { config: AppConfig }) {
  const { mutate, saving } = useConfigMutation();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {config.sectors.map((sector) => {
        const list = config.stations.filter((s) => s.sector_id === sector.id);
        const nextName = `${sector.station_label} ${String(list.length + 1).padStart(2, "0")}`;
        return (
          <Section
            key={sector.id}
            title={sector.name}
            description={`${list.length} ${sector.station_label.toLowerCase()}(s)`}
            actions={
              <Button variant="outline" size="sm" disabled={saving} onClick={() => mutate(() => createStationFn({ data: { sector_id: sector.id, name: nextName, sort_order: list.length + 1 } }), `${nextName} criado(a)`)}>
                <Plus /> {sector.station_label}
              </Button>
            }
          >
            <div className="space-y-2">
              {list.map((st) => <StationRow key={st.id + st.name + st.active} station={st} />)}
              {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma posição cadastrada.</p>}
            </div>
          </Section>
        );
      })}
    </div>
  );
}

function StationRow({ station }: { station: Station }) {
  const [name, setName] = useState(station.name);
  const { mutate, saving } = useConfigMutation();
  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <Switch checked={station.active} onCheckedChange={(v) => mutate(() => updateStationFn({ data: { id: station.id, values: { active: v } } }), v ? "Ativado" : "Desativado")} />
      <Button variant="outline" size="sm" disabled={saving || name === station.name} onClick={() => mutate(() => updateStationFn({ data: { id: station.id, values: { name } } }))}>Salvar</Button>
      <Button variant="ghost" size="icon" onClick={() => window.confirm(`Excluir ${station.name}?`) && mutate(() => deleteStationFn({ data: { id: station.id } }), "Excluído")}>
        <Trash2 />
      </Button>
    </div>
  );
}

/* ------------------------------ Ticket types ------------------------------ */

export function TicketTypesAdmin({ config }: { config: AppConfig }) {
  const { mutate, saving } = useConfigMutation();
  const today = todayISO(config.settings.timezone);
  return (
    <Section
      title="Tipos de senha e numeração"
      description="Defina o formato de cada senha: prefixo + número com zeros à esquerda. Exemplos: 001, A001, RX001, COL001."
      actions={
        <Button disabled={saving} onClick={() => mutate(() => createTicketTypeFn({ data: { sort_order: config.ticketTypes.length + 1 } }), "Tipo criado")}>
          <Plus /> Novo tipo
        </Button>
      }
    >
      <div className="space-y-4">
        {config.ticketTypes.map((t) => (
          <TicketTypeRow key={JSON.stringify({ ...t, current_number: 0, last_reset_date: null })} type={t} sectors={config.sectors} today={today} />
        ))}
      </div>
    </Section>
  );
}

function TicketTypeRow({ type, sectors, today }: { type: TicketType; sectors: Sector[]; today: string }) {
  const [f, setF] = useState({
    name: type.name, description: type.description, prefix: type.prefix, digits: type.digits, start_number: type.start_number,
    priority: type.priority, target_sector_id: type.target_sector_id ?? "", reset_daily: type.reset_daily, active: type.active, sort_order: type.sort_order,
  });
  const { mutate, saving } = useConfigMutation();
  const preview = nextTicketCode({ ...type, prefix: f.prefix, digits: f.digits, start_number: f.start_number, reset_daily: f.reset_daily }, today);

  return (
    <div className="rounded-xl border p-4">
      <div className="grid gap-3 md:grid-cols-6">
        <Field label="Nome" className="md:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Descrição (totem)" className="md:col-span-4"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Prefixo" hint="Pode ficar vazio"><Input value={f.prefix} maxLength={6} onChange={(e) => setF({ ...f, prefix: e.target.value.toUpperCase().replace(/\s/g, "") })} /></Field>
        <Field label="Dígitos"><Input type="number" min={1} max={6} value={f.digits} onChange={(e) => setF({ ...f, digits: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })} /></Field>
        <Field label="Começar em"><Input type="number" min={0} value={f.start_number} onChange={(e) => setF({ ...f, start_number: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Primeira fila" className="md:col-span-2">
          <NativeSelect value={f.target_sector_id} onChange={(e) => setF({ ...f, target_sector_id: e.target.value })}>
            <option value="">Recepção (padrão)</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Ordem"><Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={f.priority} onCheckedChange={(v) => setF({ ...f, priority: v })} /> Preferencial</label>
        <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={f.reset_daily} onCheckedChange={(v) => setF({ ...f, reset_daily: v })} /> Reiniciar numeração todo dia</label>
        <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Ativo no totem</label>
        <div className="text-sm">
          Última: <strong>{type.current_number > 0 ? type.prefix + String(type.current_number).padStart(type.digits, "0") : "—"}</strong> · Próxima: <strong className="ticket-code text-base text-primary">{preview}</strong>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.confirm(`Reiniciar a numeração de "${type.name}"? A próxima senha será ${f.prefix}${String(f.start_number).padStart(f.digits, "0")}.`) &&
              mutate(() => resetTicketNumberingFn({ data: { id: type.id, today } }), "Numeração reiniciada")
            }
          >
            <RotateCcw /> Zerar numeração
          </Button>
          <Button size="sm" disabled={saving} onClick={() => mutate(() => updateTicketTypeFn({ data: { id: type.id, values: { ...f, target_sector_id: f.target_sector_id || null } } }))}>Salvar</Button>
          <Button variant="ghost" size="icon" onClick={() => window.confirm(`Excluir o tipo ${type.name}?`) && mutate(() => deleteTicketTypeFn({ data: { id: type.id } }), "Excluído")}>
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Routing rules ------------------------------ */

export function RoutingAdmin({ config }: { config: AppConfig }) {
  const { mutate, saving } = useConfigMutation();
  return (
    <div className="space-y-6">
      <Section
        title="Rotas de encaminhamento"
        description="Rotas prontas aparecem como atalhos na hora de encaminhar o paciente. A ordem dos setores define a sequência das filas."
        actions={
          <Button disabled={saving} onClick={() => mutate(() => createRoutingRuleFn({ data: { sort_order: config.routingRules.length + 1 } }), "Rota criada")}>
            <Plus /> Nova rota
          </Button>
        }
      >
        <div className="space-y-3">
          {config.routingRules.map((r) => <RuleRow key={JSON.stringify(r)} rule={r} sectors={config.sectors} />)}
          {config.routingRules.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma rota cadastrada.</p>}
        </div>
      </Section>
      <AutoNextAdmin config={config} />
    </div>
  );
}

function RuleRow({ rule, sectors }: { rule: RoutingRule; sectors: Sector[] }) {
  const [name, setName] = useState(rule.name);
  const [ids, setIds] = useState<string[]>(rule.sector_ids);
  const [active, setActive] = useState(rule.active);
  const { mutate, saving } = useConfigMutation();
  const toggle = (id: string) => setIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nome da rota" className="min-w-56 flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <label className="flex h-9 items-center gap-2 text-sm font-medium"><Switch checked={active} onCheckedChange={setActive} /> Ativa</label>
        <Button disabled={saving} onClick={() => mutate(() => updateRoutingRuleFn({ data: { id: rule.id, name, sector_ids: ids, active } }))}>Salvar</Button>
        <Button variant="ghost" size="icon" onClick={() => window.confirm(`Excluir a rota ${rule.name}?`) && mutate(() => deleteRoutingRuleFn({ data: { id: rule.id } }), "Excluída")}>
          <Trash2 />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sectors.map((s) => {
          const idx = ids.indexOf(s.id);
          return (
            <button key={s.id} onClick={() => toggle(s.id)} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium", idx >= 0 ? "border-primary bg-primary-soft" : "hover:border-primary/50")}>
              <span className={cn("grid h-5 w-5 place-items-center rounded-full text-xs", idx >= 0 ? "bg-primary text-primary-foreground" : "bg-secondary")}>{idx >= 0 ? idx + 1 : "+"}</span>
              {s.name}
            </button>
          );
        })}
      </div>
      {ids.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {ids.map((id, i) => (
            <span key={id} className="inline-flex items-center gap-1">{i > 0 && <ChevronRight className="h-3 w-3" />}{sectors.find((s) => s.id === id)?.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function AutoNextAdmin({ config }: { config: AppConfig }) {
  const { mutate } = useConfigMutation();
  return (
    <Section title="Encaminhamento automático" description="Ao concluir o atendimento em um setor sem próximas etapas, o paciente pode ir automaticamente para outro setor.">
      <div className="grid gap-3 md:grid-cols-2">
        {config.sectors.map((s) => (
          <Field key={s.id} label={`Depois de ${s.name}`}>
            <NativeSelect
              value={s.auto_next_sector_id ?? ""}
              onChange={(e) => mutate(() => updateSectorFn({ data: { id: s.id, values: { auto_next_sector_id: e.target.value || null } } }))}
            >
              <option value="">Finalizar atendimento</option>
              {config.sectors.filter((o) => o.id !== s.id).map((o) => <option key={o.id} value={o.id}>Enviar para {o.name}</option>)}
            </NativeSelect>
          </Field>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------ Queue settings ------------------------------ */

export function QueuesAdmin({ config }: { config: AppConfig }) {
  const qc = useQueryClient();
  return (
    <div className="space-y-6">
      <Section title="Regras de chamada" description="Como o botão “Chamar próxima senha” escolhe o próximo paciente em cada setor.">
        <div className="space-y-3">
          {config.sectors.map((s) => <QueueRow key={s.id + s.call_mode + s.priority_ratio} sector={s} />)}
        </div>
      </Section>
      <Section title="Encerrar o dia" description="Cancela todas as senhas que ainda estão em andamento (por exemplo, ao fechar a unidade). O histórico é mantido.">
        <Button
          variant="destructive"
          onClick={async () => {
            if (!window.confirm("Encerrar todas as senhas em aberto?")) return;
            try {
              const count = await closeOpenTicketsFn();
              toast.success(`${count} senha(s) encerrada(s)`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro ao encerrar");
              return;
            }
            void qc.invalidateQueries({ queryKey: ["queue"] });
          }}
        >
          Encerrar senhas em aberto
        </Button>
      </Section>
    </div>
  );
}

function QueueRow({ sector }: { sector: Sector }) {
  const [mode, setMode] = useState(sector.call_mode);
  const [ratio, setRatio] = useState(sector.priority_ratio);
  const { mutate, saving } = useConfigMutation();
  return (
    <div className="grid items-end gap-3 rounded-xl border p-4 md:grid-cols-[1fr_1.5fr_1fr_auto]">
      <div className="pb-2 font-semibold">{sector.name}</div>
      <Field label="Modo de chamada">
        <NativeSelect value={mode} onChange={(e) => setMode(e.target.value)}>
          {Object.entries(CALL_MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Normais entre preferenciais" hint={mode === "alternate" ? `1 preferencial a cada ${ratio} normais` : "Usado no modo intercalar"}>
        <Input type="number" min={1} max={10} disabled={mode !== "alternate"} value={ratio} onChange={(e) => setRatio(Math.max(1, Number(e.target.value) || 1))} />
      </Field>
      <Button disabled={saving} onClick={() => mutate(() => updateSectorFn({ data: { id: sector.id, values: { call_mode: mode, priority_ratio: ratio } } }))}>Salvar</Button>
    </div>
  );
}
