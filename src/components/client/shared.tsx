"use client";

import { ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand";
import { Row } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useClient, useDb, useQ } from "@/lib/client/hooks";
import { useStore } from "@/lib/client/store";
import type { Unit } from "@/lib/domain/types";

const M = {
  cart: ["Carrinho", "Cart"],
  items: ["{n} item(ns) · {unit}", "{n} item(s) · {unit}"],
  remove: ["remover", "remove"],
  pickup: ["Produto · retira no balcão", "Product · pick up at the desk"],
  addAlong: ["Leve junto", "Add on"],
  add: ["Adicionar", "Add"],
  chairTotal: ["{d} de cadeira no total", "{d} in the chair in total"],
  pickTime: ["Escolher dia e horário", "Pick day and time"],
  checkout: ["Ir para o pagamento", "Go to payment"],
  empty: ["Seu carrinho está vazio.", "Your cart is empty."],
  seeServices: ["Ver serviços", "See services"],
  offerHint: ["{name} · desconto em {days}", "{name} · discount on {days}"],
  switchUnit: ["Trocar unidade", "Switch location"],
  signIn: ["Entrar", "Sign in"],
  signInToContinue: ["Entre para continuar", "Sign in to continue"],
  signInBody: ["Use sua conta Google para agendar, pagar e acompanhar seus pedidos.", "Use your Google account to book, pay and track your orders."],
} satisfies Messages;

export function useUnitSlug(): Unit | null {
  const params = useParams<{ unit?: string }>();
  const db = useDb();
  const client = useClient();
  if (!db) return null;
  if (params.unit) return db.units.find((u) => u.slug === params.unit) ?? null;
  return db.units.find((u) => u.id === client?.preferredUnitId) ?? db.units[0];
}

export function useCartCount(unitId: string | undefined) {
  return useStore((s) => {
    const o = s.db?.orders.find((x) => x.clientId === s.session.clientId && x.unitId === unitId && x.status === "cart");
    return o ? o.items.reduce((a, i) => a + i.qty, 0) : 0;
  });
}

export function ClientTopBar({ unit }: { unit: Unit }) {
  const { t, tx } = useT();
  const count = useCartCount(unit.id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-11 z-20 flex h-14 items-center gap-3 border-b border-hairline bg-surface-0/95 px-4 backdrop-blur">
        <Link href={`/app/${unit.slug}`} aria-label="BV Studio">
          <BrandMark className="h-4" />
        </Link>
        <Link href="/app" className="flex min-w-0 flex-1 flex-col leading-tight" aria-label={t(M.switchUnit)}>
          <span className="truncate text-sm font-medium">{tx(unit.name)}</span>
          <span className="text-[11px] text-ink-muted">{t(M.switchUnit)} ›</span>
        </Link>
        <Button variant="outline" size="icon" className="relative" aria-label={t(M.cart)} onClick={() => setOpen(true)}>
          <ShoppingBag />
          {count > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-sm bg-ink px-1 text-center font-mono text-[11px] text-surface-0">{count}</span>}
        </Button>
      </header>
      <CartSheet unit={unit} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function CartSheet({ unit, open, onClose }: { unit: Unit; open: boolean; onClose: () => void }) {
  const { t, tx, fmt } = useT();
  const router = useRouter();
  const client = useClient();
  const { data } = useQ("clientCart", { unitId: unit.id }, "client", { enabled: open && !!client });
  const { run, busy } = useAction("client");
  const cart = data && data.status === "cart" ? data : null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-[400px] gap-0 p-0">
        <SheetHeader className="border-b border-hairline">
          <SheetTitle className="text-xl">{t(M.cart)}</SheetTitle>
          <SheetDescription>{cart ? t(M.items, { n: cart.count, unit: tx(unit.name) }) : tx(unit.name)}</SheetDescription>
        </SheetHeader>
        {!cart ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center text-ink-muted">
            <p>{t(M.empty)}</p>
            <Button asChild variant="outline" onClick={onClose}>
              <Link href={`/app/${unit.slug}/services`}>{t(M.seeServices)} →</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <ul className="flex flex-col divide-y divide-hairline px-4">
              {cart.items.map((i) => (
                <li key={i.id} className="flex items-start gap-3 py-4">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="font-medium">
                      {tx(i.name)} {i.qty > 1 && `× ${i.qty}`}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {i.kind === "service" ? fmt.dur(i.durationMin) : t(M.pickup)} ·{" "}
                      <button type="button" className="underline underline-offset-2" disabled={busy} onClick={() => run("cart.remove", { orderId: cart.orderId, itemId: i.id })}>
                        {t(M.remove)}
                      </button>
                    </span>
                    {i.offerHint && (
                      <span className="text-xs text-ink-muted">
                        {t(M.offerHint, { name: tx(i.offerHint.name), days: i.offerHint.weekdays.map((d) => fmt.weekdayName(d)).join(", ") })}
                      </span>
                    )}
                  </div>
                  <span className="tabular">{fmt.money(i.unitPrice * i.qty)}</span>
                </li>
              ))}
            </ul>
            {cart.suggestions.length > 0 && (
              <div className="mx-4 mt-2 flex flex-col gap-2 rounded-md bg-muted p-3">
                <span className="bv-label">{t(M.addAlong)}</span>
                {cart.suggestions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {tx(s.name)} · {fmt.money(s.price)}
                    </span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => run("cart.add", { unitId: unit.id, kind: "product", refId: s.id })}>
                      {t(M.add)}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-auto flex flex-col gap-3 border-t border-hairline p-4">
              <Row label={t(C.subtotal)} value={fmt.money(cart.subtotal)} muted />
              <Row label={t(C.total)} value={fmt.money(cart.total)} strong className="text-lg" />
              {cart.hasServices && <span className="text-xs text-ink-muted">{t(M.chairTotal, { d: fmt.dur(cart.durationMin) })}</span>}
              <Button
                size="lg"
                onClick={() => {
                  onClose();
                  router.push(cart.hasServices ? `/app/${unit.slug}/book` : `/app/${unit.slug}/checkout`);
                }}
              >
                {cart.hasServices ? t(M.pickTime) : t(M.checkout)} →
              </Button>
            </div>
          </div>
        )}
        <button type="button" onClick={onClose} className="sr-only">
          <X /> {t(C.close)}
        </button>
      </SheetContent>
    </Sheet>
  );
}

/** Shown in place of a page when the visitor isn't signed in. */
export function SignInGate({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const client = useClient();
  const pathname = usePathname();
  if (client) return <>{children}</>;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <BrandMark className="h-8" />
      <h1 className="text-2xl font-semibold">{t(M.signInToContinue)}</h1>
      <p className="text-ink-muted">{t(M.signInBody)}</p>
      <Button asChild size="lg">
        <Link href={`/app/sign-in?next=${encodeURIComponent(pathname)}`}>{t(M.signIn)} →</Link>
      </Button>
    </div>
  );
}

/** Adds to cart, sending visitors to sign in first. */
export function useAddToCart(unitId: string) {
  const client = useClient();
  const router = useRouter();
  const pathname = usePathname();
  const { run, busy } = useAction("client");
  const add = async (kind: "service" | "product", refId: string, success?: string) => {
    if (!client) {
      router.push(`/app/sign-in?next=${encodeURIComponent(pathname)}`);
      return null;
    }
    return run<{ orderId: string; count: number }>("cart.add", { unitId, kind, refId }, { success });
  };
  return { add, busy };
}
