import { useState } from "react";
import { ImageUp, Trash2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildAnnouncement, type Settings } from "@/lib/queue";
import { playChime, speak, unlockAudio } from "@/lib/voice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { UnitLogo } from "@/components/queue/Brand";
import { Field, Section, useConfigMutation } from "./shared";

async function resizeImage(file: File, max = 360): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function UnitSettings({ settings }: { settings: Settings }) {
  const [form, setForm] = useState({
    unit_name: settings.unit_name,
    totem_title: settings.totem_title,
    totem_message: settings.totem_message,
  });
  const { mutate, saving } = useConfigMutation();

  async function onLogo(file?: File) {
    if (!file) return;
    const dataUrl = await resizeImage(file);
    await mutate(() => supabase.from("settings").update({ logo_url: dataUrl, updated_at: new Date().toISOString() }).eq("id", 1), "Logotipo atualizado");
  }

  return (
    <div className="space-y-6">
      <Section title="Unidade" description="Nome e identidade visual exibidos no menu, totem e painel.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nome da unidade">
            <Input value={form.unit_name} onChange={(e) => setForm({ ...form, unit_name: e.target.value })} />
          </Field>
          <Field label="Logotipo" hint="PNG ou JPG. A imagem é reduzida automaticamente.">
            <div className="flex items-center gap-3">
              <UnitLogo settings={settings} className="h-12 w-12" />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary">
                <ImageUp className="h-4 w-4" /> Enviar imagem
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              </label>
              {settings.logo_url && (
                <Button variant="ghost" size="sm" onClick={() => mutate(() => supabase.from("settings").update({ logo_url: null }).eq("id", 1), "Logotipo removido")}>
                  <Trash2 /> Remover
                </Button>
              )}
            </div>
          </Field>
          <Field label="Título do totem">
            <Input value={form.totem_title} onChange={(e) => setForm({ ...form, totem_title: e.target.value })} />
          </Field>
          <Field label="Mensagem do totem">
            <Input value={form.totem_message} onChange={(e) => setForm({ ...form, totem_message: e.target.value })} />
          </Field>
        </div>
        <Button className="mt-6" disabled={saving} onClick={() => mutate(() => supabase.from("settings").update({ ...form, updated_at: new Date().toISOString() }).eq("id", 1))}>
          Salvar
        </Button>
      </Section>
    </div>
  );
}

export function PanelVoiceSettings({ settings }: { settings: Settings }) {
  const [form, setForm] = useState({
    panel_title: settings.panel_title,
    panel_message: settings.panel_message,
    panel_history_count: settings.panel_history_count,
    voice_enabled: settings.voice_enabled,
    chime_enabled: settings.chime_enabled,
    voice_volume: Number(settings.voice_volume),
    voice_rate: Number(settings.voice_rate),
    voice_repeat: settings.voice_repeat,
    voice_template: settings.voice_template,
  });
  const { mutate, saving } = useConfigMutation();
  const sample = { code: "A001", call_phrase: "ao Raio-X", sector_name: "Raio-X", station_name: "Sala 02" };

  async function test() {
    unlockAudio();
    if (form.chime_enabled) await playChime(form.voice_volume);
    await speak(buildAnnouncement(form.voice_template, sample, true), { volume: form.voice_volume, rate: form.voice_rate });
  }

  return (
    <div className="space-y-6">
      <Section title="Textos do painel">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Título do painel">
            <Input value={form.panel_title} onChange={(e) => setForm({ ...form, panel_title: e.target.value })} />
          </Field>
          <Field label="Quantidade de chamadas anteriores">
            <Input type="number" min={1} max={12} value={form.panel_history_count} onChange={(e) => setForm({ ...form, panel_history_count: Number(e.target.value) || 1 })} />
          </Field>
          <Field label="Mensagem rolante (rodapé)" className="md:col-span-2">
            <Textarea rows={2} value={form.panel_message} onChange={(e) => setForm({ ...form, panel_message: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Voz e som" description="Anúncio falado no painel público quando uma senha é chamada.">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border p-4">
            <span className="font-medium">Anunciar por voz</span>
            <Switch checked={form.voice_enabled} onCheckedChange={(v) => setForm({ ...form, voice_enabled: v })} />
          </label>
          <label className="flex items-center justify-between rounded-xl border p-4">
            <span className="font-medium">Tocar aviso sonoro antes</span>
            <Switch checked={form.chime_enabled} onCheckedChange={(v) => setForm({ ...form, chime_enabled: v })} />
          </label>
          <Field label={`Volume: ${Math.round(form.voice_volume * 100)}%`}>
            <Slider min={0} max={1} step={0.05} value={[form.voice_volume]} onValueChange={([v]) => setForm({ ...form, voice_volume: v ?? form.voice_volume })} />
          </Field>
          <Field label={`Velocidade da voz: ${form.voice_rate.toFixed(2)}x`}>
            <Slider min={0.5} max={1.5} step={0.05} value={[form.voice_rate]} onValueChange={([v]) => setForm({ ...form, voice_rate: v ?? form.voice_rate })} />
          </Field>
          <Field label="Repetir anúncio (vezes)">
            <Input type="number" min={1} max={3} value={form.voice_repeat} onChange={(e) => setForm({ ...form, voice_repeat: Math.min(3, Math.max(1, Number(e.target.value) || 1)) })} />
          </Field>
          <Field
            label="Texto do anúncio"
            hint={<>Use {"{senha}"}, {"{setor}"} (ex.: “ao Raio-X”), {"{nome_setor}"} e {"{local}"} (guichê/sala).</>}
          >
            <Input value={form.voice_template} onChange={(e) => setForm({ ...form, voice_template: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 rounded-xl bg-muted px-4 py-3 text-sm">
          Exemplo: <strong>{buildAnnouncement(form.voice_template, sample, false)}</strong>
        </div>
      </Section>

      <div className="flex gap-2">
        <Button disabled={saving} onClick={() => mutate(() => supabase.from("settings").update({ ...form, updated_at: new Date().toISOString() }).eq("id", 1))}>
          Salvar
        </Button>
        <Button variant="outline" onClick={test}>
          <Volume2 /> Testar voz
        </Button>
      </div>
    </div>
  );
}
