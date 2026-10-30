"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SignInGate, useUnitSlug } from "@/components/client/shared";
import { Avatar, Empty, SkeletonBlock } from "@/components/kit";
import { BottomBar } from "@/components/mobile";
import { Stagger } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useAction, useQ } from "@/lib/client/hooks";
import { addMonths, nowLocal, startOfMonth, weekday } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const M = {
  step: ["Passo {n} de 3", "Step {n} of 3"],
  when: ["Quando?", "When?"],
  whenSub: ["Precisamos de {d} livres para {s} no {unit}.", "We need {d} free for {s} at the {unit}."],
  prevMonth: ["Mês anterior", "Previous month"],
  nextMonth: ["Próximo mês", "Next month"],
  chosen: ["escolhido", "chosen"],
  free: ["tem vaga", "available"],
  full: ["lotado", "full"],
  closed: ["fechado", "closed"],
  past: ["passou", "past"],
  seeTimes: ["Ver horários de {d}", "See times for {d}"],
  pickDay: ["Escolha um dia", "Pick a day"],
  whatTime: ["Que horas?", "What time?"],
  change: ["trocar", "change"],
  morning: ["Manhã", "Morning"],
  afternoon: ["Tarde", "Afternoon"],
  evening: ["Noite", "Evening"],
  noPro: ["sem profissional livre", "no professional free"],
  untilHint: ["Às {a} o atendimento vai até {b}. Chegue 10 minutos antes com o código do pedido em mãos.", "At {a} the service runs until {b}. Arrive 10 minutes early with your order code."],
  discount: ["Neste dia vale a oferta: − {v}.", "An offer applies on this day: − {v}."],
  choosePro: ["Escolher profissional", "Choose professional"],
  pickTime: ["Escolha um horário", "Pick a time"],
  withWhom: ["Com quem?", "With whom?"],
  any: ["Qualquer profissional", "Any professional"],
  anyHint: ["A casa escolhe quem estiver livre; costuma começar mais no horário.", "The house picks whoever is free; it usually starts more on time."],
  orKnown: ["Ou escolha quem você já conhece", "Or choose someone you know"],
  freeAt: ["{n} livre(s) às {t}", "{n} free at {t}"],
  busyUntil: ["Ocupada até {t}", "Busy until {t}"],
  off: ["Fora do horário", "Off duty"],
  toPay: ["Ir para o pagamento", "Go to payment"],
  noDays: ["Sem vagas neste mês.", "No availability this month."],
  noTimes: ["Sem horários livres neste dia.", "No free times on this day."],
  emptyCart: ["Adicione um serviço ao carrinho para agendar.", "Add a service to your cart to book."],
} satisfies Messages;

export default function BookPage() {
  return (
    <SignInGate>
      <Book />
    </SignInGate>
  );
}

function Book() {
  const { t, tx, fmt } = useT();
  const router = useRouter();
  const unit = useUnitSlug();
  const today = nowLocal().slice(0, 10);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [month, setMonth] = useState(startOfMonth(today));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [pro, setPro] = useState<string | null>(null);
  const { data: cart, loading: cartLoading } = useQ("clientCart", { unitId: unit?.id }, "client", { enabled: !!unit });
  const serviceIds = useMemo(() => cart?.items.filter((i) => i.kind === "service").map((i) => i.refId) ?? [], [cart]);
  const { data: monthData } = useQ("availabilityMonth", { unitId: unit?.id, serviceIds, month }, "client", { enabled: !!unit && serviceIds.length > 0 });
  const { data: dayData } = useQ("availabilityDay", { unitId: unit?.id, serviceIds, date }, "client", { enabled: !!date && serviceIds.length > 0 && step >= 2 });
  const { data: pros } = useQ("availabilityPros", { unitId: unit?.id, serviceIds, start: `${date}T${time}` }, "client", { enabled: step === 3 && !!date && !!time });
  const { run, busy } = useAction("client");
  if (!unit) return null;
  if (!cart && !cartLoading) return <Empty className="m-6">{t(M.emptyCart)}</Empty>;
  if (!cart) return <SkeletonBlock className="m-4 h-96" />;
  const svcNames = cart.items.filter((i) => i.kind === "service").map((i) => tx(i.name)).join(" + ");
  const firstWd = weekday(month);
  const groups = [
    { label: M.morning, slots: dayData?.slots.filter((s) => s.time < "12:00") ?? [] },
    { label: M.afternoon, slots: dayData?.slots.filter((s) => s.time >= "12:00" && s.time < "18:00") ?? [] },
    { label: M.evening, slots: dayData?.slots.filter((s) => s.time >= "18:00") ?? [] },
  ].filter((g) => g.slots.length);
  const endTime = (tm: string) => {
    const [h, m] = tm.split(":").map(Number);
    const total = h * 60 + m + (dayData?.durationMin ?? cart.durationMin);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const slotFree = dayData?.slots.find((s) => s.time === time)?.free.length ?? 0;

  const reserve = async (proId: string | null) => {
    const r = await run("checkout.reserve", { orderId: cart.orderId, start: `${date}T${time}`, professionalId: proId });
    if (r) router.push(`/app/${unit.slug}/checkout`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-2 py-2">
        <button
          type="button"
          aria-label={t(["Voltar", "Back"])}
          className="flex size-11 items-center justify-center rounded-sm hover:bg-muted"
          onClick={() => (step === 1 ? router.back() : setStep((step - 1) as 1 | 2))}
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="bv-label">{t(M.step, { n: step })}</span>
        <div className="ml-auto flex gap-1 pr-2" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={cn("h-1 w-8 rounded-[2px]", n <= step ? "bg-ink" : "bg-hairline")} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4 p-5" data-anim>
          <h1 className="text-3xl font-semibold">{t(M.when)}</h1>
          <p className="text-ink-muted">{t(M.whenSub, { d: fmt.dur(cart.durationMin), s: svcNames, unit: tx(unit.name) })}</p>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label={t(M.prevMonth)} disabled={month <= startOfMonth(today)} onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft />
            </Button>
            <span className="font-medium first-letter:uppercase">
              {fmt.monthName(Number(month.slice(5, 7)))} {month.slice(0, 4)}
            </span>
            <Button variant="ghost" size="icon" aria-label={t(M.nextMonth)} disabled={month >= addMonths(startOfMonth(today), 2)} onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight />
            </Button>
          </div>
          {!monthData ? (
            <SkeletonBlock className="h-72" />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <span key={d} className="py-1 font-mono text-[11px] uppercase text-ink-muted">
                    {fmt.weekdayName(d).slice(0, 1)}
                  </span>
                ))}
                {Array.from({ length: firstWd }).map((_, i) => (
                  <span key={`b${i}`} />
                ))}
                {monthData.days.map((d) => {
                  const sel = d.date === date;
                  const label = sel ? t(M.chosen) : t(M[d.state]);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      disabled={d.state !== "free"}
                      aria-pressed={sel}
                      aria-label={`${fmt.dayLong(d.date)}, ${label}`}
                      onClick={() => {
                        setDate(d.date);
                        setTime(null);
                      }}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-sm border text-sm",
                        sel
                          ? "border-ink bg-ink font-semibold text-surface-0"
                          : d.state === "free"
                            ? "border-line-strong hover:border-ink"
                            : d.state === "full"
                              ? "bv-hatch border-hairline text-ink-muted line-through"
                              : d.state === "closed"
                                ? "border-dashed border-hairline text-ink-muted"
                                : "border-transparent text-ink-muted/60",
                      )}
                    >
                      {Number(d.date.slice(8))}
                    </button>
                  );
                })}
              </div>
              <ul className="flex flex-wrap gap-4 text-xs text-ink-muted">
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px] bg-ink" /> {t(M.chosen)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px] border border-line-strong" /> {t(M.free)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="bv-hatch size-3 rounded-[2px] border border-hairline" /> {t(M.full)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[2px] border border-dashed border-hairline" /> {t(M.closed)}
                </li>
              </ul>
              {!monthData.days.some((d) => d.state === "free") && <Empty>{t(M.noDays)}</Empty>}
            </>
          )}
        </div>
      )}

      {step === 2 && date && (
        <div className="flex flex-col gap-4 p-5" data-anim>
          <h1 className="text-3xl font-semibold">{t(M.whatTime)}</h1>
          <p className="text-ink-muted">
            <span className="inline-block first-letter:uppercase">{fmt.dayLong(date)}</span> ·{" "}
            <button type="button" className="underline underline-offset-2" onClick={() => setStep(1)}>
              {t(M.change)}
            </button>
          </p>
          {dayData && dayData.discount > 0 && <p className="rounded-md border border-dashed border-ink p-3 text-sm">{t(M.discount, { v: fmt.money(dayData.discount) })}</p>}
          {!dayData ? (
            <SkeletonBlock className="h-72" />
          ) : groups.length === 0 ? (
            <Empty>{t(M.noTimes)}</Empty>
          ) : (
            groups.map((g) => (
              <section key={g.label[0]} className="flex flex-col gap-2">
                <span className="bv-label">{t(g.label)}</span>
                <Stagger className="grid grid-cols-4 gap-2" deps={[date]}>
                  {g.slots.map((s) => {
                    const off = s.free.length === 0;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        data-anim
                        disabled={off}
                        aria-pressed={time === s.time}
                        aria-label={`${s.time}${off ? `, ${t(M.noPro)}` : ""}`}
                        onClick={() => setTime(s.time)}
                        className={cn(
                          "h-11 rounded-sm border font-mono text-sm",
                          time === s.time ? "border-ink bg-ink text-surface-0" : off ? "border-dashed border-hairline text-ink-muted line-through" : "border-line-strong hover:border-ink",
                        )}
                      >
                        {fmt.time(s.time)}
                      </button>
                    );
                  })}
                </Stagger>
              </section>
            ))
          )}
          {time && <p className="text-sm text-ink-muted">{t(M.untilHint, { a: fmt.hour(time), b: fmt.hour(endTime(time)) })}</p>}
        </div>
      )}

      {step === 3 && date && time && (
        <div className="flex flex-col gap-4 p-5" data-anim>
          <h1 className="text-3xl font-semibold">{t(M.withWhom)}</h1>
          <p className="text-ink-muted">
            {fmt.dayWeek(date)} · {fmt.hour(time)} ·{" "}
            <button type="button" className="underline underline-offset-2" onClick={() => setStep(2)}>
              {t(M.change)}
            </button>
          </p>
          <button
            type="button"
            aria-pressed={pro === null}
            onClick={() => setPro(null)}
            className={cn("flex flex-col gap-1 rounded-md border p-4 text-left", pro === null ? "border-2 border-ink" : "border-hairline")}
          >
            <span className="font-semibold">{t(M.any)}</span>
            <span className="text-sm text-ink-muted">{t(M.anyHint)}</span>
          </button>
          <div className="flex items-baseline justify-between">
            <span className="bv-label">{t(M.orKnown)}</span>
            <span className="text-xs text-ink-muted">{t(M.freeAt, { n: slotFree, t: fmt.hour(time) })}</span>
          </div>
          {!pros ? (
            <SkeletonBlock className="h-40" />
          ) : (
            <div className="flex flex-col gap-2">
              {pros.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.free}
                  aria-pressed={pro === p.id}
                  onClick={() => setPro(p.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-3 text-left disabled:opacity-60",
                    pro === p.id ? "border-2 border-ink" : "border-hairline",
                    !p.free && "border-dashed",
                  )}
                >
                  <Avatar name={p.name} inverted={p.free} />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-sm text-ink-muted">{p.free ? `★ ${p.rating ? fmt.num(p.rating, 1) : "—"}` : p.busyUntil ? t(M.busyUntil, { t: p.busyUntil }) : t(M.off)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomBar>
        {step === 1 && (
          <Button size="lg" className="w-full" disabled={!date} onClick={() => setStep(2)}>
            {date ? t(M.seeTimes, { d: fmt.dayWeek(date) }) : t(M.pickDay)} →
          </Button>
        )}
        {step === 2 && (
          <Button size="lg" className="w-full" disabled={!time} onClick={() => setStep(3)}>
            {time ? t(M.choosePro) : t(M.pickTime)} →
          </Button>
        )}
        {step === 3 && (
          <Button size="lg" className="w-full" disabled={busy} onClick={() => reserve(pro)}>
            {t(M.toPay)} →
          </Button>
        )}
      </BottomBar>
    </div>
  );
}
