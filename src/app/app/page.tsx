"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { Stagger } from "@/components/motion";
import { useT, type Messages } from "@/i18n";
import { useAction, useClient, useDb } from "@/lib/client/hooks";
import { servicePriceAt, unitHoursOn } from "@/lib/domain/rules";
import { nowLocal } from "@/lib/domain/time";

const M = {
  title: ["Onde você quer ser atendido?", "Where would you like to be served?"],
  sub: ["Escolha a unidade do seu autocuidado.", "Pick the location for your self-care."],
  openUntil: ["Aberta até {t}", "Open until {t}"],
  closedToday: ["Fechada hoje", "Closed today"],
  closedNow: ["Fechada agora · abre às {t}", "Closed now · opens at {t}"],
  pick: ["Escolher", "Choose"],
  footer: [
    "Sua conta, pedidos e favoritos valem em todas as unidades. Troque de unidade quando quiser, no topo do app.",
    "Your account, orders and favorites work at every location. Switch locations anytime at the top of the app.",
  ],
  from: ["a partir de {v}", "from {v}"],
} satisfies Messages;

export default function ChooseUnit() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const client = useClient();
  const { run } = useAction("client");
  if (!db) return null;
  const now = nowLocal();
  return (
    <div className="bv-gradient flex flex-1 flex-col gap-6 p-5">
      <BrandMark className="mt-4 h-6 self-start" />
      <div className="flex flex-col gap-2" data-anim>
        <h1 className="text-3xl font-semibold leading-tight tracking-[-0.02em]">{t(M.title)}</h1>
        <p className="text-ink-muted">{t(M.sub)}</p>
      </div>
      <Stagger className="flex flex-col gap-3">
        {db.units
          .filter((u) => u.active)
          .map((u) => {
            const h = unitHoursOn(u, now.slice(0, 10));
            const time = now.slice(11);
            const services = db.services.filter((s) => s.status === "active" && s.units.some((l) => l.unitId === u.id));
            const min = Math.min(...services.map((s) => servicePriceAt(s, u.id)));
            return (
              <Link
                key={u.id}
                href={`/app/${u.slug}`}
                data-anim
                onClick={() => client && run("client.updateProfile", { preferredUnitId: u.id }, { silentError: true })}
                className="group flex flex-col gap-3 rounded-md border border-hairline bg-surface-0 p-5 transition-colors hover:border-ink"
              >
                <span className="bv-label">{tx(u.kind)}</span>
                <span className="text-3xl font-semibold">{tx(u.name)}</span>
                <span className="text-sm text-ink-muted">
                  {services
                    .slice(0, 4)
                    .map((s) => tx(s.name))
                    .join(" · ")}
                </span>
                <span className="flex items-center justify-between text-sm">
                  <span>
                    {!h ? t(M.closedToday) : time < h.start ? t(M.closedNow, { t: fmt.hour(h.start) }) : time >= h.end ? t(M.closedToday) : t(M.openUntil, { t: fmt.hour(h.end) })} ·{" "}
                    {t(M.from, { v: fmt.money(min) })}
                  </span>
                  <span className="font-medium group-hover:underline">{t(M.pick)} →</span>
                </span>
              </Link>
            );
          })}
      </Stagger>
      <p className="mt-auto text-sm text-ink-muted">{t(M.footer)}</p>
    </div>
  );
}
