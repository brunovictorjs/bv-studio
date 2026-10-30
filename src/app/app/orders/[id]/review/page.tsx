"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { SignInGate } from "@/components/client/shared";
import { Avatar, Field, SkeletonBlock, StarInput } from "@/components/kit";
import { BottomBar, MobileHeader } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT, type Messages } from "@/i18n";
import { useAction, useQ } from "@/lib/client/hooks";

const M = {
  title: ["Avaliar", "Review"],
  how: ["Como foi?", "How was it?"],
  service: ["O serviço", "The service"],
  who: ["Quem atendeu", "Who served you"],
  product: ["O produto", "The product"],
  text: ["Conta pra gente (opcional)", "Tell us more (optional)"],
  homeHint: ["Com 5 estrelas nas duas notas e um texto, sua avaliação pode aparecer na página do {unit}.", "With 5 stars on both ratings and a text, your review may appear on the {unit} page."],
  send: ["Enviar avaliação", "Send review"],
  thanks: ["Obrigada! Sua avaliação foi enviada.", "Thank you! Your review was sent."],
  labels: ["Ruim|Fraco|Ok|Bom|Excelente", "Poor|Weak|Okay|Good|Excellent"],
} satisfies Messages;

export default function ReviewPage() {
  return (
    <SignInGate>
      <Review />
    </SignInGate>
  );
}

function Review() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, tx, fmt } = useT();
  const { data: o } = useQ("clientOrder", { id }, "client");
  const { run, busy } = useAction("client");
  const [svc, setSvc] = useState(0);
  const [pro, setPro] = useState(0);
  const [prod, setProd] = useState(0);
  const [text, setText] = useState("");
  if (!o) return <SkeletonBlock className="m-4 h-96" />;
  const labels = t(M.labels).split("|");
  const product = o.items.find((i) => i.kind === "product");
  const label = (n: number) => (n ? labels[n - 1] : "");
  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader title={t(M.title)} back={`/app/orders/${o.id}`} />
      <div className="flex flex-col gap-6 p-5">
        <div className="flex flex-col gap-1" data-anim>
          <h1 className="text-3xl font-semibold">{t(M.how)}</h1>
          <span className="text-sm text-ink-muted">
            {o.items.map((i) => tx(i.name)).join(" + ")} · {o.start ? fmt.dayWeek(o.start) : ""} · <span className="font-mono">{o.code}</span> · {tx(o.unitName)}
          </span>
        </div>
        <section className="flex flex-col gap-1">
          <span className="font-medium">{t(M.service)}</span>
          <StarInput value={svc} onChange={setSvc} label={t(M.service)} />
          <span className="text-sm text-ink-muted">{label(svc)}</span>
        </section>
        {o.pro && (
          <section className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-medium">
              {t(M.who)} <Avatar name={o.pro.name} className="size-7 text-[10px]" /> {o.pro.name}
            </span>
            <StarInput value={pro} onChange={setPro} label={t(M.who)} />
            <span className="text-sm text-ink-muted">{label(pro)}</span>
          </section>
        )}
        {product && (
          <section className="flex flex-col gap-1">
            <span className="font-medium">
              {t(M.product)} · {tx(product.name)}
            </span>
            <StarInput value={prod} onChange={setProd} label={t(M.product)} />
          </section>
        )}
        <Field label={t(M.text)}>
          <Textarea rows={4} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <p className="text-xs text-ink-muted">{t(M.homeHint, { unit: tx(o.unitName) })}</p>
      </div>
      <BottomBar>
        <Button
          size="lg"
          className="w-full"
          disabled={busy || !svc || (!!o.pro && !pro)}
          onClick={async () => {
            const r = await run("order.review", { orderId: o.id, serviceRating: svc, proRating: o.pro ? pro : null, productRating: product && prod ? prod : null, text }, { success: t(M.thanks) });
            if (r) router.push("/app/orders");
          }}
        >
          {t(M.send)}
        </Button>
      </BottomBar>
    </div>
  );
}
