import { z } from "zod";
import { orderTotal, servicePriceAt, unitHoursOn } from "@/lib/domain/rules";
import { formatMoney, L, normalize, tx } from "@/lib/domain/text";
import { addDays, datePart, durationLabel } from "@/lib/domain/time";
import type { ChatMessage, Conversation, DB, LText, Locale, RequestCtx, Unit, User } from "@/lib/domain/types";
import { actor, fail, fullName, getUnit, must, requireUnitStaff, type ActionFn } from "../core";
import { uid } from "../ids";
import { daySlots } from "../scheduling";

const msg = (who: ChatMessage["who"], text: LText, ctx: RequestCtx, by?: string | null): ChatMessage => ({
  id: uid("m"),
  who,
  text,
  at: ctx.now,
  by: by ?? null,
  tag: null,
});

export const chatTakeOver: ActionFn = (db, raw, ctx) => {
  const input = z.object({ id: z.string() }).parse(raw);
  const c = must(db.conversations.find((x) => x.id === input.id));
  const me = requireUnitStaff(db, ctx, c.unitId);
  if (c.status === "human") return { ok: true };
  c.status = "human";
  c.messages.push(msg("system", L(`${me.firstName} assumiu a conversa · IA pausada aqui`, `${me.firstName} took over · assistant paused here`), ctx));
  c.updatedAt = ctx.now;
  return { ok: true };
};

export const chatSend: ActionFn = (db, raw, ctx) => {
  const input = z.object({ id: z.string(), text: z.string().trim().min(1).max(1000) }).parse(raw);
  const c = must(db.conversations.find((x) => x.id === input.id));
  const me = requireUnitStaff(db, ctx, c.unitId);
  if (c.status !== "human") fail("take_over_first");
  c.messages.push(msg("staff", input.text, ctx, me.id));
  c.updatedAt = ctx.now;
  return { ok: true };
};

export const chatFinish: ActionFn = (db, raw, ctx) => {
  const input = z.object({ id: z.string() }).parse(raw);
  const c = must(db.conversations.find((x) => x.id === input.id));
  requireUnitStaff(db, ctx, c.unitId);
  c.status = "closed";
  c.messages.push(msg("system", L("Atendimento finalizado · IA religada nesta conversa", "Chat finished · assistant back on in this conversation"), ctx));
  c.updatedAt = ctx.now;
  return { ok: true };
};

// ------------------------------------------------------------------ the simulated assistant

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

function nextOrderOf(db: DB, client: User, unitId: string, ctx: RequestCtx) {
  return db.orders
    .filter((o) => o.clientId === client.id && o.unitId === unitId && o.start && ["paid", "awaiting_payment"].includes(o.status) && o.start >= ctx.now.slice(0, 10))
    .sort((a, b) => a.start!.localeCompare(b.start!))[0];
}

/**
 * Rule-based stand-in for the WhatsApp AI. It only knows the unit's own data
 * and forwards to a person when the client asks or the topic is sensitive.
 */
export function assistantReply(db: DB, unit: Unit, client: User, text: string, ctx: RequestCtx): { reply: LText; forward?: { reason: LText; detail: LText } } {
  const t = normalize(text);
  const loc: Locale = ctx.locale;
  const money = (c: number) => formatMoney(c, loc, db.settings.company.currency);
  const both = (fn: (l: Locale) => string): LText => ({ pt: fn("pt"), en: fn("en") });
  const unitName = (l: Locale) => tx(unit.name, l);

  if (has(t, ["pessoa", "humano", "atendente", "recepcao", "person", "human", "agent", "someone"])) {
    return {
      reply: both((l) => (l === "pt" ? `Claro! Já chamei a recepção do ${unitName(l)}. Em instantes uma pessoa te responde por aqui.` : `Sure! I've called the ${unitName(l)} front desk. A person will reply here shortly.`)),
      forward: { reason: L("Pediu atendimento humano", "Asked for a person"), detail: { pt: text, en: text } },
    };
  }
  if (has(t, ["alerg", "saude", "formol", "gravid", "allerg", "health", "pregnan", "reclama", "complain", "reembolso", "estorno", "refund", "nota fiscal", "invoice"])) {
    return {
      reply: both((l) =>
        l === "pt"
          ? "Esse assunto precisa de uma pessoa da equipe para te responder com segurança. Já encaminhei, em instantes alguém fala com você."
          : "This topic needs someone from the team to answer you safely. I've forwarded it and someone will reply shortly.",
      ),
      forward: { reason: L("Assunto que sempre vai para uma pessoa", "Topic that always goes to a person"), detail: { pt: text, en: text } },
    };
  }

  const services = db.services.filter((s) => s.status === "active" && s.units.some((u) => u.unitId === unit.id));
  const named = services.find((s) => t.includes(normalize(tx(s.name, "pt"))) || t.includes(normalize(tx(s.name, "en"))));

  if (unit.ai.answers.orders && has(t, ["pedido", "marcado", "confirm", "agendamento", "order", "booking", "appointment", "meu horario", "my time"])) {
    const o = nextOrderOf(db, client, unit.id, ctx);
    if (!o)
      return { reply: both((l) => (l === "pt" ? `Não encontrei pedido marcado no ${unitName(l)} para este número. Quer que eu veja um horário?` : `I couldn't find a booking at the ${unitName(l)} for this number. Want me to look for a time?`)) };
    const pro = db.users.find((u) => u.id === o.professionalId);
    const items = (l: Locale) => o.items.map((i) => tx(i.name, l)).join(" + ");
    const when = (l: Locale) => `${o.start!.slice(8, 10)}/${o.start!.slice(5, 7)} ${l === "pt" ? "às" : "at"} ${o.start!.slice(11)}`;
    const status = (l: Locale) =>
      o.status === "paid" ? (l === "pt" ? "pago e confirmado" : "paid and confirmed") : l === "pt" ? `reservado, pague ${money(orderTotal(o))} no balcão` : `held, pay ${money(orderTotal(o))} at the desk`;
    return {
      reply: both((l) =>
        l === "pt"
          ? `Seu pedido ${o.code} está ${status(l)}: ${items(l)} com ${pro?.firstName ?? "a equipe"}, ${when(l)}. Chegue 10 minutos antes com o código.`
          : `Your order ${o.code} is ${status(l)}: ${items(l)} with ${pro?.firstName ?? "the team"}, ${when(l)}. Arrive 10 minutes early with your code.`,
      ),
    };
  }

  if (unit.ai.answers.slots && has(t, ["horario", "vaga", "hoje", "amanha", "livre", "agendar", "marcar", "available", "slot", "today", "tomorrow", "book", "time"])) {
    const svc = named ?? services.sort((a, b) => b.soldCount - a.soldCount)[0];
    const today = datePart(ctx.now);
    for (const date of [today, addDays(today, 1), addDays(today, 2)]) {
      const free = daySlots(db, unit.id, [svc.id], date, ctx.now).filter((s) => s.free.length).slice(0, 3);
      if (!free.length) continue;
      const day = (l: Locale) => (date === today ? (l === "pt" ? "hoje" : "today") : date === addDays(today, 1) ? (l === "pt" ? "amanhã" : "tomorrow") : `${date.slice(8, 10)}/${date.slice(5, 7)}`);
      const times = free.map((s) => s.time).join(", ");
      return {
        reply: both((l) =>
          l === "pt"
            ? `Para ${tx(svc.name, l)} tenho ${day(l)} às ${times}. Agende e pague pelo link: ${db.settings.company.domain}/${unit.slug}`
            : `For ${tx(svc.name, l)} I have ${day(l)} at ${times}. Book and pay through the link: ${db.settings.company.domain}/${unit.slug}`,
        ),
      };
    }
    return { reply: both((l) => (l === "pt" ? "Não achei vaga nos próximos dois dias. Quer que eu chame alguém da recepção?" : "I couldn't find a free slot in the next two days. Want me to call the front desk?")) };
  }

  if (unit.ai.answers.catalog && (named || has(t, ["preco", "quanto", "valor", "custa", "servico", "price", "cost", "how much", "service"]))) {
    if (named)
      return {
        reply: both((l) =>
          l === "pt"
            ? `${tx(named.name, l)} custa ${money(servicePriceAt(named, unit.id))} e leva ${durationLabel(named.durationMin, l)}. Quer que eu veja um horário?`
            : `${tx(named.name, l)} costs ${money(servicePriceAt(named, unit.id))} and takes ${durationLabel(named.durationMin, l)}. Want me to find a time?`,
        ),
      };
    const top = services.sort((a, b) => b.soldCount - a.soldCount).slice(0, 4);
    return {
      reply: both((l) =>
        (l === "pt" ? "Os mais procurados aqui: " : "Most popular here: ") + top.map((s) => `${tx(s.name, l)} ${money(servicePriceAt(s, unit.id))}`).join(" · "),
      ),
    };
  }

  if (unit.ai.answers.info && has(t, ["endereco", "onde", "fica", "abre", "fecha", "funciona", "address", "where", "open", "close", "hours"])) {
    const h = unitHoursOn(unit, datePart(ctx.now));
    return {
      reply: both((l) =>
        l === "pt"
          ? `O ${unitName(l)} fica em ${unit.address}. ${h ? `Hoje abre das ${h.start} às ${h.end}.` : "Hoje estamos fechados."} Telefone da recepção: ${unit.phone}.`
          : `The ${unitName(l)} is at ${unit.address}. ${h ? `Today we're open ${h.start}–${h.end}.` : "We're closed today."} Front desk: ${unit.phone}.`,
      ),
    };
  }

  if (has(t, ["oi", "ola", "bom dia", "boa tarde", "boa noite", "hello", "hi", "hey", "good morning"])) {
    return { reply: unit.ai.greeting };
  }
  if (has(t, ["obrigad", "valeu", "thanks", "thank you"])) {
    return { reply: L("Por nada! Qualquer coisa é só chamar.", "You're welcome! Message me anytime.") };
  }

  return {
    reply: both((l) =>
      l === "pt"
        ? "Não sei responder isso com certeza e não quero inventar. Já chamei uma pessoa da equipe para te ajudar."
        : "I can't answer that for sure and I won't make things up. I've called someone from the team to help you.",
    ),
    forward: { reason: L("A IA não soube responder", "The assistant couldn't answer"), detail: { pt: text, en: text } },
  };
}

export const chatClientSend: ActionFn = (db, raw, ctx) => {
  const input = z.object({ unitId: z.string(), text: z.string().trim().min(1).max(600) }).parse(raw);
  const client = actor(db, ctx);
  const unit = getUnit(db, input.unitId);
  if (!unit.whatsappConnected) fail("whatsapp_disconnected");
  let c: Conversation | undefined = db.conversations.find((x) => x.clientId === client.id && x.unitId === unit.id);
  if (!c) {
    c = {
      id: uid("cv"),
      unitId: unit.id,
      clientId: client.id,
      name: fullName(client),
      phone: client.phone,
      status: "ai",
      reason: null,
      reasonDetail: null,
      forwardedAt: null,
      messages: [],
      updatedAt: ctx.now,
    };
    db.conversations.unshift(c);
  }
  c.messages.push(msg("client", input.text, ctx, client.id));
  c.updatedAt = ctx.now;
  if (c.status === "closed") c.status = "ai";
  if (c.status === "forwarded" || c.status === "human") return { conversationId: c.id, waiting: true };

  const { reply, forward } = assistantReply(db, unit, client, input.text, ctx);
  c.messages.push(msg("ai", reply, ctx));
  if (forward) {
    c.status = "forwarded";
    c.reason = forward.reason;
    c.reasonDetail = forward.detail;
    c.forwardedAt = ctx.now;
    c.messages.push(msg("system", L("Encaminhada · IA pausada nesta conversa", "Forwarded · assistant paused in this chat"), ctx));
  }
  return { conversationId: c.id, waiting: !!forward };
};

