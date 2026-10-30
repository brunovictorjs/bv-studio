"use client";

import Link from "next/link";
import { useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { Chip, Field, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages, type Msg } from "@/i18n";
import { useAction, useDb } from "@/lib/client/hooks";
import type { NotifyChannel, NotifyEvent, Settings } from "@/lib/domain/types";

const M = {
  save: ["Salvar alterações", "Save changes"],
  saved: ["Notificações salvas.", "Notifications saved."],
  who: ["Quem é avisado de quê", "Who gets notified of what"],
  event: ["Evento", "Event"],
  pro: ["Profissional", "Professional"],
  desk: ["Balcão da unidade", "Location desk"],
  admin: ["Admin", "Admin"],
  email: ["Cliente · e-mail", "Client · email"],
  wa: ["Cliente · WhatsApp (IA)", "Client · WhatsApp (AI)"],
  sender: ["Remetente dos e-mails", "Email sender"],
  name: ["Nome", "Name"],
  replyTo: ["Responder para", "Reply to"],
  waHint: ["O texto e os horários dos lembretes de WhatsApp ficam em", "WhatsApp reminder text and timing live in"],
  assistant: ["Assistente IA", "AI assistant"],
  log: ["Últimos envios", "Latest deliveries"],
  test: ["Enviar teste", "Send test"],
  testSent: ["Teste enviado.", "Test sent."],
  delivered: ["Entregue", "Delivered"],
  failed: ["Falhou", "Failed"],
} satisfies Messages;

const EVENTS: [NotifyEvent, Msg, Msg?][] = [
  ["paid", ["Pedido pago ou reservado em dinheiro", "Order paid or held for cash"]],
  ["reminder", ["Lembrete 1 dia e 2 horas antes", "Reminder 1 day and 2 hours before"]],
  ["late", ["Cliente atrasou e novo horário", "Client late and new time"]],
  ["started", ["Atendimento iniciado", "Service started"]],
  ["completed", ["Pedido concluído", "Order completed"]],
  ["cancelled", ["Pedido cancelado", "Order cancelled"]],
  ["refunded", ["Estorno concluído", "Refund completed"]],
  ["review", ["Avaliação recebida", "Review received"], ["abaixo de 3 sempre avisa o admin", "below 3 always notifies the admin"]],
  ["forwarded", ["Conversa encaminhada pela IA", "Chat forwarded by the AI"], ["alerta se ninguém responder", "alert if nobody replies"]],
  ["digest", ["Resumo do dia seguinte", "Next-day summary"], ["às 20:00, por unidade", "at 8 PM, per location"]],
];
const CHANNELS: NotifyChannel[] = ["pro", "desk", "admin", "email", "whatsapp"];
const CLIENT_EVENTS: NotifyEvent[] = ["paid", "reminder", "late", "started", "completed", "cancelled", "refunded"];

export default function NotificationsPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Notifications />
    </RoleGate>
  );
}

function Notifications() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const [n, setN] = useState<Settings["notifications"] | null>(db ? structuredClone(db.settings.notifications) : null);
  const [dirty, setDirty] = useState(false);
  if (!db || !n) return null;
  const label: Record<NotifyChannel, Msg> = { pro: M.pro, desk: M.desk, admin: M.admin, email: M.email, whatsapp: M.wa };
  const toggle = (e: NotifyEvent, c: NotifyChannel, v: boolean) => {
    setN({ ...n, matrix: { ...n.matrix, [e]: { ...n.matrix[e], [c]: v } } });
    setDirty(true);
  };
  const applies = (e: NotifyEvent, c: NotifyChannel) => {
    if (c === "email" || c === "whatsapp") return CLIENT_EVENTS.includes(e);
    if (e === "forwarded" && c === "pro") return false;
    return true;
  };
  return (
    <>
      <div className="flex justify-end" data-anim>
        <Button
          disabled={busy || !dirty}
          onClick={() =>
            run("settings.save", { section: "notifications", value: { matrix: n.matrix, senderName: n.senderName, replyTo: n.replyTo } }, { success: t(M.saved) }).then(
              (r) => r && setDirty(false),
            )
          }
        >
          {t(M.save)}
        </Button>
      </div>
      <Panel title={t(M.who)}>
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t(M.event)}</TableHead>
                {CHANNELS.map((c) => (
                  <TableHead key={c} className="text-center">
                    {t(label[c])}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {EVENTS.map(([e, name, hint]) => (
                <TableRow key={e}>
                  <TableCell>
                    <span className="font-medium">{t(name)}</span>
                    {hint && <span className="block text-xs text-ink-muted">{t(hint)}</span>}
                  </TableCell>
                  {CHANNELS.map((c) => (
                    <TableCell key={c} className="text-center">
                      {applies(e, c) ? (
                        <Checkbox
                          aria-label={`${t(name)} · ${t(label[c])}`}
                          checked={!!n.matrix[e]?.[c] || (e === "review" && c === "admin")}
                          disabled={e === "review" && c === "admin"}
                          onCheckedChange={(v) => toggle(e, c, !!v)}
                        />
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t(M.sender)} bodyClassName="flex flex-col gap-4">
          <Field label={t(M.name)}>
            <Input value={n.senderName} onChange={(e) => (setN({ ...n, senderName: e.target.value }), setDirty(true))} />
          </Field>
          <Field label={t(M.replyTo)}>
            <Input type="email" value={n.replyTo} onChange={(e) => (setN({ ...n, replyTo: e.target.value }), setDirty(true))} />
          </Field>
          <p className="text-sm text-ink-muted">
            {t(M.waHint)}{" "}
            <Link href="/admin/assistant" className="text-ink underline-offset-4 hover:underline">
              {t(M.assistant)}
            </Link>
            .
          </p>
        </Panel>
        <Panel
          title={t(M.log)}
          actions={
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run("notify.test", { channel: "email" }, { success: t(M.testSent) })}>
              {t(M.test)}
            </Button>
          }
        >
          <ul className="flex flex-col divide-y divide-hairline text-sm">
            {db.settings.notifications.log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Chip active={l.ok} className={l.ok ? "" : "border-dashed border-ink text-ink"}>
                  {l.ok ? t(M.delivered) : t(M.failed)}
                </Chip>
                <span className="flex-1">
                  {l.channel === "whatsapp" ? "WhatsApp" : "E-mail"} · {tx(l.label)} · <span className="font-mono text-xs">{l.to}</span>
                  {l.error && <span className="text-ink-muted"> · {tx(l.error)}</span>}
                </span>
                <span className="text-xs text-ink-muted">{fmt.relative(l.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
