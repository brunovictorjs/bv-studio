"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { RoleGate, UnitPicker, useAdminUnit } from "@/components/admin/shell";
import { cleanPair, LTextInput, toPair } from "@/components/content";
import { Chip, Field, PageHeader, Panel, Row, ToggleRow } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT, type Messages } from "@/i18n";
import { useAction, useDb } from "@/lib/client/hooks";
import type { UnitAiConfig } from "@/lib/domain/types";

const M = {
  eyebrow: ["Negócio · só administradores", "Business · admins only"],
  title: ["Assistente IA", "AI assistant"],
  description: [
    "Um número de WhatsApp por unidade. Cada assistente só conhece o catálogo, a agenda e os pedidos da própria unidade.",
    "One WhatsApp number per location. Each assistant only knows its own location's catalog, agenda and orders.",
  ],
  unitLabel: ["Unidade que você está configurando", "Location you're configuring"],
  save: ["Salvar alterações", "Save changes"],
  saved: ["Assistente salvo.", "Assistant saved."],
  conn: ["Conexão do WhatsApp", "WhatsApp connection"],
  connected: ["Conectado", "Connected"],
  disconnected: ["Desconectado", "Disconnected"],
  number: ["Número", "Number"],
  provider: ["Provedor", "Provider"],
  model: ["Modelo de IA", "AI model"],
  webhook: ["Webhook de mensagens", "Message webhook"],
  receiving: ["Recebendo", "Receiving"],
  stopped: ["Parado", "Stopped"],
  connHint: [
    "Token da instância e chave da API ficam só no servidor. Se o celular desconectar, a IA para e a recepção recebe um aviso.",
    "The instance token and API key stay on the server. If the phone disconnects, the AI stops and the front desk is notified.",
  ],
  reconnect: ["Reconectar (QR)", "Reconnect (QR)"],
  disconnect: ["Desconectar", "Disconnect"],
  test: ["Enviar teste", "Send test"],
  testSent: ["Mensagem de teste enviada.", "Test message sent."],
  answers: ["O que a IA responde", "What the AI answers"],
  aOrders: ["Pedidos do cliente", "Client orders"],
  aOrdersH: ["Situação, horário, profissional, código e valor a pagar, reconhecendo o cliente pelo celular.", "Status, time, professional, code and amount due, recognizing the client by phone."],
  aCatalog: ["Serviços e produtos da unidade", "Location services and products"],
  aCatalogH: ["Preço, duração, descrição e ofertas valendo. Só o que está ativo nesta unidade.", "Price, duration, description and live offers. Only what's active here."],
  aSlots: ["Horários livres", "Open times"],
  aSlotsH: ["Sugere até 3 horários e manda o link para agendar e pagar no site.", "Suggests up to 3 times and sends the link to book and pay online."],
  aInfo: ["Endereço, horário e contato", "Address, hours and contact"],
  aInfoH: ["Vem dos dados da unidade e dos fechamentos previstos.", "Comes from the location details and planned closures."],
  forward: ["Quando chamar uma pessoa", "When to call a person"],
  fAsk: ["O cliente pede atendimento humano. Sempre ligado.", "The client asks for a person. Always on."],
  fUnknown: ["A IA não sabe responder. Sempre ligado: ela não inventa preço, horário nem regra.", "The AI doesn't know. Always on: it never makes up prices, times or rules."],
  topics: ["Assuntos que sempre vão para uma pessoa", "Topics that always go to a person"],
  newTopic: ["Novo assunto", "New topic"],
  addTopic: ["Adicionar assunto", "Add topic"],
  who: ["Quem é avisado", "Who gets notified"],
  alert: ["Alerta se ninguém responder em (min)", "Alert if nobody replies in (min)"],
  fHint: ["Ao encaminhar, a IA pausa só naquela conversa. Quem atender finaliza e religa a IA pelo painel.", "When forwarding, the AI pauses only in that chat. Whoever handles it finishes and turns the AI back on from the panel."],
  reminders: ["Lembretes do atendimento", "Appointment reminders"],
  r1: ["1º lembrete", "1st reminder"],
  r2: ["2º lembrete", "2nd reminder"],
  preview1: ["Prévia · 1º lembrete", "Preview · 1st reminder"],
  preview1Body: [
    "Oi, Helena! Amanhã, às 8h, você tem Spa dos pés com a Camila, no {unit}. Código do pedido: BV-3B8M1. Se precisar remarcar, é só responder aqui.",
    "Hi Helena! Tomorrow at 8 AM you have a Foot spa with Camila at the {unit}. Order code: BV-3B8M1. If you need to reschedule, just reply here.",
  ],
  preview2: ["Prévia · 2º lembrete", "Preview · 2nd reminder"],
  preview2Body: [
    "Oi, Helena! Daqui a pouco, às 8h, é o seu Spa dos pés. Chegue 10 minutos antes com o código BV-3B8M1. {addr}",
    "Hi Helena! Your Foot spa is coming up at 8 AM. Arrive 10 minutes early with code BV-3B8M1. {addr}",
  ],
  remHint: ["Cada lembrete sai uma vez só por pedido, mesmo se o servidor reiniciar. Pedidos cancelados não recebem.", "Each reminder goes out once per order, even if the server restarts. Cancelled orders don't get one."],
  late: ["Atraso e novo horário", "Late arrivals and new time"],
  lateToggle: ["Avisar o novo horário quando o cliente atrasa", "Tell the new time when a client is late"],
  lateH: [
    "Quando o cliente passa do horário, o sistema calcula o encaixe na próxima folga do profissional. A IA avisa o novo horário e o prazo até virar falta.",
    "When a client misses the time, the system finds the next gap in the professional's agenda. The AI tells the new time and the deadline before it's a no-show.",
  ],
  latePreview: ["Prévia · encaixe definido", "Preview · new slot set"],
  latePreviewBody: [
    "Thiago, seu horário era às 13h40 e você ainda não chegou. Seu pedido continua valendo: realoquei você para as 14h20 com o Diego, a primeira folga da agenda. Se não chegar até {deadline}, o pedido vira falta.",
    "Thiago, your time was 1:40 PM and you haven't arrived yet. Your order is still valid: I moved you to 2:20 PM with Diego, the first gap in the agenda. If you don't arrive by {deadline}, it becomes a no-show.",
  ],
  tolerance: ["Tolerância de {n} min nas regras da unidade", "{n} min tolerance in the location rules"],
  intro: ["Apresentação", "Introduction"],
  name: ["Nome do assistente", "Assistant name"],
  afterHours: ["Fora do horário", "After hours"],
  greeting: ["Primeira mensagem", "First message"],
  introHint: ["A IA sempre se apresenta como assistente virtual e segue a voz da marca: frases curtas, convite direto, sem urgência falsa.", "The AI always introduces itself as a virtual assistant and follows the brand voice: short sentences, direct invitation, no fake urgency."],
} satisfies Messages;

export default function AssistantPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Assistant />
    </RoleGate>
  );
}

function Assistant() {
  const [unitId] = useAdminUnit({ allowAll: false });
  return <AssistantForm key={unitId} unitId={unitId} />;
}

function AssistantForm({ unitId }: { unitId: string }) {
  const { t, tx } = useT();
  const db = useDb();
  const unit = db?.units.find((u) => u.id === unitId);
  const { run, busy } = useAction("staff");
  const [ai, setAi] = useState<UnitAiConfig | null>(unit ? structuredClone(unit.ai) : null);
  const [dirty, setDirty] = useState(false);
  if (!db || !unit || !ai) return null;
  const patch = (p: Partial<UnitAiConfig>) => {
    setAi({ ...ai, ...p });
    setDirty(true);
  };
  const unitName = tx(unit.name);
  const deadline = `${Math.floor((13 * 60 + 40 + unit.lateToleranceMin) / 60)}h${String((13 * 60 + 40 + unit.lateToleranceMin) % 60).padStart(2, "0")}`;
  const save = () =>
    run(
      "ai.save",
      {
        unitId,
        ai: {
          ...ai,
          assistantName: cleanPair(toPair(ai.assistantName)),
          greeting: cleanPair(toPair(ai.greeting)),
          afterHours: cleanPair(toPair(ai.afterHours)),
          notifyWho: cleanPair(toPair(ai.notifyWho)),
          forwardTopics: ai.forwardTopics.map((x) => cleanPair(toPair(x))).filter((x) => x.pt),
        },
      },
      { success: t(M.saved) },
    ).then((r) => r && setDirty(false));

  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        description={t(M.description)}
        actions={
          <>
            <UnitPicker allowAll={false} label={t(M.unitLabel)} />
            <Button className="self-end" disabled={busy || !dirty} onClick={save}>
              {t(M.save)}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t(M.conn)}>
          <Chip active={unit.whatsappConnected} className="mb-3">
            ● {unit.whatsappConnected ? t(M.connected) : t(M.disconnected)}
          </Chip>
          <div className="flex flex-col divide-y divide-hairline text-sm">
            <Row label={t(M.number)} value={<span className="font-mono">{unit.whatsapp}</span>} />
            <Row label={t(M.provider)} value={<span className="font-mono">Z-API · {unit.whatsappInstance}</span>} />
            <Row label={t(M.model)} value="Claude (Anthropic)" />
            <Row label={t(M.webhook)} value={unit.whatsappConnected ? t(M.receiving) : t(M.stopped)} />
          </div>
          <p className="my-3 text-xs text-ink-muted">{t(M.connHint)}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => run("unit.whatsapp", { unitId, connected: !unit.whatsappConnected })}>
              {unit.whatsappConnected ? t(M.disconnect) : t(M.reconnect)}
            </Button>
            <Button variant="outline" size="sm" disabled={busy || !unit.whatsappConnected} onClick={() => run("notify.test", { channel: "whatsapp" }, { success: t(M.testSent) })}>
              {t(M.test)}
            </Button>
          </div>
        </Panel>
        <Panel title={t(M.answers)}>
          <ToggleRow title={t(M.aOrders)} description={t(M.aOrdersH)} checked={ai.answers.orders} onChange={(v) => patch({ answers: { ...ai.answers, orders: v } })} />
          <ToggleRow title={t(M.aCatalog)} description={t(M.aCatalogH)} checked={ai.answers.catalog} onChange={(v) => patch({ answers: { ...ai.answers, catalog: v } })} />
          <ToggleRow title={t(M.aSlots)} description={t(M.aSlotsH)} checked={ai.answers.slots} onChange={(v) => patch({ answers: { ...ai.answers, slots: v } })} />
          <ToggleRow title={t(M.aInfo)} description={t(M.aInfoH)} checked={ai.answers.info} onChange={(v) => patch({ answers: { ...ai.answers, info: v } })} />
        </Panel>
        <Panel title={t(M.forward)} bodyClassName="flex flex-col gap-4">
          <ul className="bv-slash-list text-sm">
            <li>{t(M.fAsk)}</li>
            <li>{t(M.fUnknown)}</li>
          </ul>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t(M.topics)}</span>
            <div className="flex flex-wrap gap-2">
              {ai.forwardTopics.map((topic, i) => (
                <span key={i} className="flex items-center gap-1 rounded-sm border border-hairline pl-3 text-sm">
                  <input
                    className="w-40 bg-transparent py-1.5 outline-none"
                    value={tx(topic)}
                    aria-label={t(M.topics)}
                    onChange={(e) => patch({ forwardTopics: ai.forwardTopics.map((x, k) => (k === i ? e.target.value : x)) })}
                  />
                  <button type="button" aria-label="×" className="p-2 text-ink-muted hover:text-ink" onClick={() => patch({ forwardTopics: ai.forwardTopics.filter((_, k) => k !== i) })}>
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <Button variant="outline" size="sm" onClick={() => patch({ forwardTopics: [...ai.forwardTopics, t(M.newTopic)] })}>
                <Plus /> {t(M.addTopic)}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t(M.who)}>
              <LTextInput value={ai.notifyWho} onChange={(v) => patch({ notifyWho: v })} />
            </Field>
            <Field label={t(M.alert)}>
              <Input type="number" min={1} className="mt-7" value={ai.alertAfterMin} onChange={(e) => patch({ alertAfterMin: Math.max(1, Number(e.target.value)) })} />
            </Field>
          </div>
          <p className="text-xs text-ink-muted">{t(M.fHint)}</p>
        </Panel>
        <Panel title={t(M.reminders)} bodyClassName="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t(M.r1)}>
              <LTextInput value={ai.reminder1} onChange={(v) => patch({ reminder1: v })} />
            </Field>
            <Field label={t(M.r2)}>
              <LTextInput value={ai.reminder2} onChange={(v) => patch({ reminder2: v })} />
            </Field>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-md bg-muted p-3 text-sm">
              <span className="bv-label">{t(M.preview1)}</span>
              <p className="mt-1">{t(M.preview1Body, { unit: unitName })}</p>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <span className="bv-label">{t(M.preview2)}</span>
              <p className="mt-1">{t(M.preview2Body, { addr: unit.address })}</p>
            </div>
          </div>
          <p className="text-xs text-ink-muted">{t(M.remHint)}</p>
        </Panel>
        <Panel title={t(M.late)} bodyClassName="flex flex-col gap-3">
          <ToggleRow title={t(M.lateToggle)} description={t(M.lateH)} checked={ai.lateNotice} onChange={(v) => patch({ lateNotice: v })} />
          <div className="rounded-md bg-muted p-3 text-sm">
            <span className="bv-label">{t(M.latePreview)}</span>
            <p className="mt-1">{t(M.latePreviewBody, { deadline })}</p>
          </div>
          <p className="text-xs text-ink-muted">{t(M.tolerance, { n: unit.lateToleranceMin })}</p>
        </Panel>
        <Panel title={t(M.intro)} bodyClassName="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t(M.name)}>
              <LTextInput value={ai.assistantName} onChange={(v) => patch({ assistantName: v })} />
            </Field>
            <Field label={t(M.afterHours)}>
              <LTextInput value={ai.afterHours} onChange={(v) => patch({ afterHours: v })} />
            </Field>
          </div>
          <Field label={t(M.greeting)}>
            <LTextInput multiline rows={3} value={ai.greeting} onChange={(v) => patch({ greeting: v })} />
          </Field>
          <p className="text-xs text-ink-muted">{t(M.introHint)}</p>
        </Panel>
      </div>
    </>
  );
}
