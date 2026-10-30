"use client";

import { Banknote, Copy, CreditCard, QrCode } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SignInGate, useUnitSlug } from "@/components/client/shared";
import { Empty, Field, Row, SkeletonBlock } from "@/components/kit";
import { BottomBar, MobileHeader } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, type Messages } from "@/i18n";
import { useAction, useClient, useClock, useQ } from "@/lib/client/hooks";
import { addMinutes, epochMin, nowLocal } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const M = {
  title: ["Pagamento", "Payment"],
  withPro: ["com {name}", "with {name}"],
  anyPro: ["com quem estiver livre", "with whoever is free"],
  ends: ["termina {t}", "ends {t}"],
  change: ["trocar", "change"],
  pickupLine: ["× {n} · retira no balcão", "× {n} · pick up at the desk"],
  discount: ["Desconto da oferta", "Offer discount"],
  how: ["Como você quer pagar", "How would you like to pay"],
  pix: ["Pix", "Pix"],
  pixH: ["Confirma na hora", "Confirms instantly"],
  credit: ["Cartão de crédito", "Credit card"],
  creditH: ["Em até {n}x sem juros", "Up to {n}x interest-free"],
  debit: ["Cartão de débito", "Debit card"],
  cash: ["Dinheiro", "Cash"],
  cashH: ["Pague no balcão do {unit}", "Pay at the {unit} front desk"],
  stripe: ["Pagamento processado pelo Stripe (simulado na demo). Cancele até {t} e o valor volta inteiro para você.", "Payment processed by Stripe (simulated in the demo). Cancel until {t} and get a full refund."],
  terms: ["Ao confirmar você concorda com os", "By confirming you agree to the"],
  termsLink: ["Termos de serviço", "Terms of service"],
  pay: ["Pagar {v} com {m}", "Pay {v} with {m}"],
  reserve: ["Reservar e pagar no balcão", "Hold and pay at the desk"],
  pixTitle: ["Pague com Pix", "Pay with Pix"],
  expires: ["Expira em {t}", "Expires in {t}"],
  pixHint: ["Abra o app do seu banco, escolha Pix por QR Code e aponte a câmera.", "Open your bank app, choose Pix by QR code and point the camera."],
  copy: ["Copiar", "Copy"],
  copied: ["Código copiado.", "Code copied."],
  held: ["Seu horário das {t} fica reservado enquanto o código estiver válido. Se expirar, ele volta para a agenda.", "Your {t} time stays held while the code is valid. If it expires, it goes back to the agenda."],
  paid: ["Já paguei, verificar", "I've paid, check it"],
  cardTitle: ["Cartão", "Card"],
  number: ["Número do cartão", "Card number"],
  holder: ["Nome no cartão", "Name on card"],
  expiry: ["Validade", "Expiry"],
  cvv: ["CVV", "CVV"],
  installments: ["Parcelas", "Installments"],
  cardHint: ["Dados tratados pelo Stripe. Não guardamos seu cartão. Na demo, qualquer número funciona.", "Data handled by Stripe. We never store your card. In the demo, any number works."],
  payCard: ["Pagar {v}", "Pay {v}"],
  nothing: ["Nada para pagar agora.", "Nothing to pay right now."],
  backServices: ["Ver serviços", "See services"],
} satisfies Messages;

type Method = "pix" | "credit" | "debit" | "cash";

export default function CheckoutPage() {
  return (
    <SignInGate>
      <Checkout />
    </SignInGate>
  );
}

function Checkout() {
  const { t, tx, fmt } = useT();
  const router = useRouter();
  const unit = useUnitSlug();
  const client = useClient();
  const { data: cart, loading } = useQ("clientCart", { unitId: unit?.id }, "client", { enabled: !!unit });
  const { run, busy } = useAction("client");
  const [method, setMethod] = useState<Method>("pix");
  const [screen, setScreen] = useState<"choose" | "pix" | "card">("choose");
  const [installments, setInstallments] = useState("1");
  const [card, setCard] = useState({ number: "4242 4242 4242 4242", name: client ? `${client.firstName} ${client.lastName}`.toUpperCase() : "", exp: "08/29", cvv: "123" });
  const nowMs = useClock(1000);

  // product-only carts go straight here: hold them first
  useEffect(() => {
    if (cart && cart.status === "cart" && !cart.hasServices) void run("checkout.reserve", { orderId: cart.orderId, start: null, professionalId: null }, { silentError: true });
  }, [cart, run]);

  if (!unit) return null;
  if (!cart && !loading)
    return (
      <>
        <MobileHeader title={t(M.title)} back={`/app/${unit.slug}`} />
        <Empty className="m-6">
          {t(M.nothing)}{" "}
          <Link href={`/app/${unit.slug}/services`} className="underline">
            {t(M.backServices)}
          </Link>
        </Empty>
      </>
    );
  if (!cart) return <SkeletonBlock className="m-4 h-96" />;

  const methods = cart.methods;
  const total = cart.total;
  const startT = cart.start?.slice(11) ?? "";
  const end = cart.start ? addMinutes(cart.start, cart.durationMin) : null;
  const holdLeft = cart.holdUntil ? Math.max(0, (epochMin(cart.holdUntil) - epochMin(nowLocal())) * 60 - new Date(nowMs).getSeconds()) : 600;
  const methodLabel: Record<Method, string> = { pix: "Pix", credit: t(M.credit), debit: t(M.debit), cash: t(M.cash) };

  const pay = async (m: Method) => {
    const r = await run<{ orderId: string }>("checkout.pay", { orderId: cart.orderId, method: m, installments: m === "credit" ? Number(installments) : undefined });
    if (r) router.push(`/app/orders/${r.orderId}?new=1`);
  };

  if (screen === "pix")
    return (
      <div className="flex flex-1 flex-col">
        <MobileHeader title={t(M.pixTitle)} back={true} right={<span className="pr-2 font-mono text-sm">{t(M.expires, { t: `${String(Math.floor(holdLeft / 60)).padStart(2, "0")}:${String(holdLeft % 60).padStart(2, "0")}` })}</span>} />
        <div className="flex flex-col items-center gap-5 p-5">
          <p className="text-center text-ink-muted">{t(M.pixHint)}</p>
          <div className="grid size-56 grid-cols-12 gap-0.5 rounded-md border border-hairline bg-white p-3" aria-hidden="true">
            {Array.from({ length: 144 }).map((_, i) => (
              <span key={i} className={((i * 7919) % 13) % 3 === 0 || [0, 1, 12, 13, 10, 11, 22, 23, 132, 133, 120, 121].includes(i) ? "bg-[#161616]" : "bg-white"} />
            ))}
          </div>
          <div className="flex w-full items-center gap-2 rounded-sm border border-hairline p-2">
            <code className="flex-1 truncate font-mono text-xs">00020126580014br.gov.bcb.pix0136{cart.orderId}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(`00020126580014br.gov.bcb.pix0136${cart.orderId}`);
                toast.success(t(M.copied));
              }}
            >
              <Copy /> {t(M.copy)}
            </Button>
          </div>
          <span className="text-3xl font-semibold">{fmt.money(total, { decimals: "always" })}</span>
          {cart.start && <p className="text-center text-sm text-ink-muted">{t(M.held, { t: fmt.hour(startT) })}</p>}
        </div>
        <BottomBar>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => pay("pix")}>
            {t(M.paid)}
          </Button>
        </BottomBar>
      </div>
    );

  if (screen === "card")
    return (
      <div className="flex flex-1 flex-col">
        <MobileHeader title={method === "credit" ? t(M.credit) : t(M.debit)} back={true} />
        <div className="flex flex-col gap-4 p-5">
          <div className="bv-gradient flex aspect-[1.6] flex-col justify-between rounded-md border border-hairline p-5" aria-hidden="true">
            <CreditCard className="size-6" />
            <span className="font-mono text-lg tracking-[0.15em]">{card.number || "•••• •••• •••• ••••"}</span>
            <div className="flex justify-between font-mono text-xs">
              <span>{card.name || "—"}</span>
              <span>{card.exp}</span>
            </div>
          </div>
          <Field label={t(M.number)}>
            <Input inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} />
          </Field>
          <Field label={t(M.holder)}>
            <Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value.toUpperCase() })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(M.expiry)}>
              <Input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} />
            </Field>
            <Field label={t(M.cvv)}>
              <Input type="password" inputMode="numeric" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} />
            </Field>
          </div>
          {method === "credit" && (
            <Field label={t(M.installments)}>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: cart.installments }, (_, i) => i + 1)
                    .filter((n) => n === 1 || total / n >= cart.minInstallment)
                    .map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x {fmt.money(Math.round(total / n), { decimals: "always" })}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <p className="text-xs text-ink-muted">{t(M.cardHint)}</p>
        </div>
        <BottomBar>
          <Button size="lg" className="w-full" disabled={busy || card.number.replace(/\D/g, "").length < 12 || !card.name} onClick={() => pay(method)}>
            {t(M.payCard, { v: fmt.money(total) })}
          </Button>
        </BottomBar>
      </div>
    );

  const options: { id: Method; icon: React.ReactNode; title: string; hint?: string; on: boolean }[] = [
    { id: "pix", icon: <QrCode />, title: t(M.pix), hint: t(M.pixH), on: methods.pix },
    { id: "credit", icon: <CreditCard />, title: t(M.credit), hint: t(M.creditH, { n: cart.installments }), on: methods.credit },
    { id: "debit", icon: <CreditCard />, title: t(M.debit), on: methods.debit },
    { id: "cash", icon: <Banknote />, title: t(M.cash), hint: t(M.cashH, { unit: tx(unit.name) }), on: methods.cash && cart.hasServices },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader title={t(M.title)} back={cart.hasServices ? `/app/${unit.slug}/book` : true} />
      <div className="flex flex-col gap-5 p-5">
        {cart.start && (
          <div className="flex items-start justify-between gap-3 rounded-md border border-hairline p-4" data-anim>
            <div className="flex flex-col">
              <span className="font-semibold first-letter:uppercase">
                {fmt.dayWeek(cart.start)} · {fmt.hour(startT)}
              </span>
              <span className="text-sm text-ink-muted">
                {cart.anyProfessional || !cart.proName ? t(M.anyPro) : t(M.withPro, { name: cart.proName.split(" ")[0] })} · {end && t(M.ends, { t: fmt.hour(end.slice(11)) })} · {tx(unit.name)}
              </span>
            </div>
            <Link href={`/app/${unit.slug}/book`} className="text-sm underline underline-offset-2">
              {t(M.change)}
            </Link>
          </div>
        )}
        <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline px-4" data-anim>
          {cart.items.map((i) => (
            <Row key={i.id} label={i.kind === "service" ? tx(i.name) : `${tx(i.name)} ${t(M.pickupLine, { n: i.qty })}`} value={fmt.money(i.unitPrice * i.qty)} />
          ))}
          {cart.discount > 0 && <Row label={t(M.discount)} value={`− ${fmt.money(cart.discount)}`} muted />}
          <Row label="Total" value={fmt.money(total)} strong className="text-lg" />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-lg font-semibold">{t(M.how)}</legend>
          {options
            .filter((o) => o.on)
            .map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={method === o.id}
                onClick={() => setMethod(o.id)}
                className={cn("flex min-h-14 items-center gap-3 rounded-md border p-3 text-left", method === o.id ? "border-2 border-ink" : "border-hairline")}
              >
                <span className={cn("flex size-10 items-center justify-center rounded-sm", method === o.id ? "bg-ink text-surface-0" : "bg-muted")}>{o.icon}</span>
                <span className="flex flex-col">
                  <span className="font-medium">{o.title}</span>
                  {o.hint && <span className="text-xs text-ink-muted">{o.hint}</span>}
                </span>
              </button>
            ))}
        </fieldset>
        <p className="text-xs text-ink-muted">{t(M.stripe, { t: cart.start ? `${fmt.hour(startT)} · ${fmt.dayWeek(cart.start)}` : "—" })}</p>
        <p className="text-xs text-ink-muted">
          {t(M.terms)}{" "}
          <Link href="/app/terms" className="underline underline-offset-2">
            {t(M.termsLink)}
          </Link>
          .
        </p>
      </div>
      <BottomBar>
        <Button
          size="lg"
          className="w-full"
          disabled={busy || cart.status !== "awaiting_payment"}
          onClick={() => (method === "pix" ? setScreen("pix") : method === "cash" ? pay("cash") : setScreen("card"))}
        >
          {method === "cash" ? t(M.reserve) : t(M.pay, { v: fmt.money(total), m: methodLabel[method] })}
        </Button>
      </BottomBar>
    </div>
  );
}
