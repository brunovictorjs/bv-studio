"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { BrandMark, Numeral, Tag } from "@/components/brand";
import { LocaleSwitch, ThemeSwitch } from "@/components/demo-bar";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const INSTAGRAM = "https://instagram.com/brunovictor.jsx";
const WHATSAPP = "https://wa.me/5581987363068";

const M = {
  nav: ["Navegação", "Navigation"],
  navApps: ["Áreas", "Areas"],
  navHow: ["Como funciona", "How it works"],
  navFeatures: ["Recursos", "Features"],
  openDemo: ["Abrir a demo", "Open the demo"],
  heroTag: ["agendamento", "booking"],
  heroTitle1: ["Agenda, pagamento", "Booking, payment"],
  heroTitle2: ["e balcão.", "and front desk."],
  heroTitle3: ["Num sistema só.", "One system."],
  heroBody: [
    "Software de agendamento para salões e barbearias com mais de uma unidade. O cliente marca e paga pelo site, a assistente lembra no WhatsApp e a equipe atende com um código.",
    "Booking software for salons and barbershops with more than one location. Clients book and pay online, the assistant reminds them on WhatsApp and the team serves them with a code.",
  ],
  contact: ["Me chama no direct", "Message me on Instagram"],
  mockTitle: ["Agenda da unidade", "Location agenda"],
  mockInChair: ["na cadeira", "in the chair"],
  mockLate: ["atrasado · encaixe 15:10", "late · fitted at 15:10"],
  mockPaid: ["pago · Pix", "paid · Pix"],
  appsTag: ["três apps", "three apps"],
  appsTitle: ["Cada pessoa com a sua tela.", "Everyone gets their own screen."],
  a1: ["Site do cliente", "Client site"],
  a1b: ["Escolhe a unidade, o serviço, o dia e quem atende. Paga com Pix ou cartão, ou reserva para pagar no balcão.", "Picks the location, service, day and professional. Pays with Pix or card, or holds the time to pay at the desk."],
  a1i1: ["Agenda em três passos", "Booking in three steps"],
  a1i2: ["Código do pedido na chegada", "Order code on arrival"],
  a1i3: ["Cancelamento com reembolso no prazo", "Cancel with refund in time"],
  a2: ["App do profissional", "Professional app"],
  a2b: ["Agenda do dia, conferência do código, cronômetro de cadeira, extras e ganhos com comissão.", "Day agenda, code check-in, chair timer, extras and earnings with commission."],
  a2i1: ["Inicia o atendimento com o código", "Starts the service with the code"],
  a2i2: ["Lança produto como extra", "Adds products as extras"],
  a2i3: ["Vê a comissão do mês", "Sees this month's commission"],
  a3: ["Painel de gestão", "Management panel"],
  a3b: ["Visão por unidade, vendas, balcão, agenda, catálogo, ofertas, equipe, IA e configurações.", "Per-location overview, sales, front desk, agenda, catalog, offers, team, AI and settings."],
  a3i1: ["Faturamento e margem por dia", "Revenue and margin by day"],
  a3i2: ["Fechamento do caixa do balcão", "Front desk cash closing"],
  a3i3: ["Comissões por profissional", "Commissions per professional"],
  open: ["Abrir", "Open"],
  howTag: ["como funciona", "how it works"],
  howTitle: ["Do clique à cadeira.", "From click to chair."],
  s1: ["Agenda e paga", "Books and pays"],
  s1b: ["O cliente escolhe o horário livre e paga online. O horário fica segurado enquanto ele paga.", "The client picks a free time and pays online. The time is held while they pay."],
  s2: ["A IA lembra", "The assistant reminds"],
  s2b: ["Um dia e duas horas antes, a assistente da unidade avisa no WhatsApp com o código do pedido.", "One day and two hours before, the location's assistant sends a WhatsApp reminder with the order code."],
  s3: ["Atende com código", "Serves with a code"],
  s3b: ["O profissional digita o código, o cronômetro começa. Para concluir, pede o código de conclusão.", "The professional types the code and the timer starts. To finish, they ask for the completion code."],
  s4: ["O balcão fecha", "The desk closes out"],
  s4b: ["Extras e pagamentos em dinheiro caem no balcão. O caixa fecha por forma de pagamento.", "Extras and cash payments go to the front desk. The register closes by payment method."],
  featTag: ["recursos", "features"],
  featTitle: ["O que vem pronto.", "What comes built in."],
  f1: ["Multiunidade", "Multi-location"],
  f1b: ["Endereço, horário, equipe, WhatsApp e caixa por unidade. Catálogo compartilhado com preço por unidade.", "Address, hours, team, WhatsApp and register per location. Shared catalog with per-location pricing."],
  f2: ["Pix e cartão", "Pix and cards"],
  f2b: ["Pagamento online via Stripe, com taxas e repasse no relatório. Dinheiro no balcão também.", "Online payment through Stripe, with fees and payouts in the report. Cash at the desk too."],
  f3: ["Assistente no WhatsApp", "WhatsApp assistant"],
  f3b: ["Responde pedidos, preços e horários da unidade. Encaminha para uma pessoa quando precisa.", "Answers orders, prices and open times. Hands over to a person when needed."],
  f4: ["Encaixe de atrasados", "Late arrivals fitted in"],
  f4b: ["Passou do horário? O sistema calcula o próximo encaixe e o prazo até virar falta.", "Missed the time? The system finds the next gap and the deadline before it's a no-show."],
  f5: ["Comissões automáticas", "Automatic commissions"],
  f5b: ["Percentual por profissional, exceção por categoria e regras do que entra na conta.", "Rate per professional, per-category exceptions and rules for what counts."],
  f6: ["Avaliações na vitrine", "Reviews on display"],
  f6b: ["Notas do serviço e do profissional. As 5 estrelas com texto vão para a home da unidade.", "Service and professional ratings. Five-star reviews with text go on the location's home page."],
  f7: ["Ofertas por dia", "Day-based offers"],
  f7b: ["Desconto por dia da semana, período e limite de usos, sem conflito entre ofertas.", "Discounts by weekday, period and usage limit, with no overlapping offers."],
  f8: ["Português e inglês", "Portuguese and English"],
  f8b: ["Toda a interface troca de idioma na hora. Moeda e datas seguem o idioma.", "The whole interface switches language instantly. Currency and dates follow along."],
  brandTag: ["sob medida", "made to fit"],
  brandTitle: ["Com a cara do seu negócio.", "With your brand on it."],
  brandBody: [
    "Esta demo usa a identidade BV. No seu salão ou barbearia, cores, fontes, logo e textos seguem o seu design system. Os dados aqui ficam só no seu navegador: teste à vontade.",
    "This demo uses the BV identity. For your salon or barbershop, colors, fonts, logo and copy follow your design system. The data here stays in your browser: try anything.",
  ],
  role: ["Desenvolvedor de Software", "Software Developer"],
} satisfies Messages;

export default function Landing() {
  const { t } = useT();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from("[data-hero-logo]", { autoAlpha: 0, scale: 0.92, duration: 0.8 })
          .from("[data-hero-line]", { yPercent: 110, duration: 0.8, stagger: 0.09 }, "-=0.4")
          .from("[data-hero-fade]", { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.08 }, "-=0.4")
          .from("[data-mock-row]", { autoAlpha: 0, x: 24, duration: 0.5, stagger: 0.07 }, "-=0.5")
          .from("[data-mock-now]", { scaleX: 0, transformOrigin: "left", duration: 0.8 }, "-=0.3");
        gsap.to("[data-mock-live]", { opacity: 0.55, repeat: -1, yoyo: true, duration: 1.1, ease: "sine.inOut" });

        gsap.utils.toArray<HTMLElement>("[data-section]").forEach((section) => {
          gsap.from(section.querySelectorAll("[data-reveal]"), {
            autoAlpha: 0,
            y: 28,
            duration: 0.7,
            stagger: 0.08,
            ease: "power3.out",
            scrollTrigger: { trigger: section, start: "top 78%" },
          });
        });
        gsap.utils.toArray<HTMLElement>("[data-numeral]").forEach((el) => {
          gsap.from(el, { autoAlpha: 0, x: -20, duration: 0.6, scrollTrigger: { trigger: el, start: "top 85%" } });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const apps = [
    { n: 1, title: M.a1, body: M.a1b, items: [M.a1i1, M.a1i2, M.a1i3], href: "/app" },
    { n: 2, title: M.a2, body: M.a2b, items: [M.a2i1, M.a2i2, M.a2i3], href: "/pro" },
    { n: 3, title: M.a3, body: M.a3b, items: [M.a3i1, M.a3i2, M.a3i3], href: "/admin" },
  ];
  const steps = [
    [M.s1, M.s1b],
    [M.s2, M.s2b],
    [M.s3, M.s3b],
    [M.s4, M.s4b],
  ] as const;
  const features = [
    [M.f1, M.f1b],
    [M.f2, M.f2b],
    [M.f3, M.f3b],
    [M.f4, M.f4b],
    [M.f5, M.f5b],
    [M.f6, M.f6b],
    [M.f7, M.f7b],
    [M.f8, M.f8b],
  ] as const;

  return (
    <div ref={root} className="min-h-dvh bg-surface-0 text-ink">
      <header className="sticky top-0 z-30 border-b border-hairline bg-surface-0/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
          <Link href="/" aria-label="BV Studio">
            <BrandMark className="h-6" />
          </Link>
          <nav aria-label={t(M.nav)} className="ml-4 hidden items-center gap-6 text-sm text-ink-muted md:flex">
            <a href="#apps" className="hover:text-ink">
              {t(M.navApps)}
            </a>
            <a href="#how" className="hover:text-ink">
              {t(M.navHow)}
            </a>
            <a href="#features" className="hover:text-ink">
              {t(M.navFeatures)}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitch />
            <ThemeSwitch />
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/admin">
                {t(M.openDemo)} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="bv-gradient border-b border-hairline">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.1fr_1fr] md:items-center md:px-6 md:py-24">
          <div className="flex flex-col gap-6">
            <div data-hero-logo className="flex items-center gap-3">
              <Tag>{t(M.heroTag)}</Tag>
            </div>
            <h1 className="text-4xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
              {[M.heroTitle1, M.heroTitle2, M.heroTitle3].map((m, i) => (
                <span key={i} className="block overflow-hidden pb-1">
                  <span data-hero-line className={`block ${i === 2 ? "text-ink-muted" : ""}`}>
                    {t(m)}
                  </span>
                </span>
              ))}
            </h1>
            <p data-hero-fade className="max-w-xl text-lg leading-relaxed text-ink-muted">
              {t(M.heroBody)}
            </p>
            <div data-hero-fade className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/admin">
                  {t(M.openDemo)} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={INSTAGRAM} target="_blank" rel="noreferrer">
                  {t(M.contact)} →
                </a>
              </Button>
            </div>
          </div>
          <HeroMock t={t} />
        </div>
      </section>

      <section id="apps" data-section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <div data-reveal className="mb-10 flex flex-col gap-2">
          <Tag>{t(M.appsTag)}</Tag>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">{t(M.appsTitle)}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {apps.map((a) => (
            <article key={a.n} data-reveal className="flex flex-col gap-4 rounded-md border border-hairline bg-card p-6">
              <Numeral n={a.n} className="text-5xl font-semibold text-hairline" />
              <h3 className="text-2xl font-medium">{t(a.title)}</h3>
              <p className="text-ink-muted">{t(a.body)}</p>
              <ul className="bv-slash-list text-sm">
                {a.items.map((it, i) => (
                  <li key={i}>{t(it)}</li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-auto self-start">
                <Link href={a.href}>
                  {t(M.open)} {t(a.title).toLowerCase()} →
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section id="how" data-section className="border-y border-hairline bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
          <div data-reveal className="mb-10 flex flex-col gap-2">
            <Tag>{t(M.howTag)}</Tag>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">{t(M.howTitle)}</h2>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-4">
            {steps.map(([title, body], i) => (
              <li key={i} data-reveal className="flex flex-col gap-3 bg-card p-6">
                <span data-numeral className="font-mono text-sm text-ink-muted">
                  {String(i + 1).padStart(2, "0")} / 04
                </span>
                <h3 className="text-xl font-medium">{t(title)}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{t(body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" data-section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <div data-reveal className="mb-10 flex flex-col gap-2">
          <Tag>{t(M.featTag)}</Tag>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">{t(M.featTitle)}</h2>
        </div>
        <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
          {features.map(([title, body], i) => (
            <div key={i} data-reveal className="flex gap-4 border-b border-hairline py-5">
              <span className="font-mono text-ink-muted" aria-hidden="true">
                /
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">{t(title)}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{t(body)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section data-section className="bv-gradient border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-20 md:flex-row md:items-center md:justify-between md:px-6">
          <div data-reveal className="flex max-w-xl flex-col gap-3">
            <Tag>{t(M.brandTag)}</Tag>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">{t(M.brandTitle)}</h2>
            <p className="leading-relaxed text-ink-muted">{t(M.brandBody)}</p>
          </div>
          <div data-reveal className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/app">
                {t(M.openDemo)} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={WHATSAPP} target="_blank" rel="noreferrer">
                WhatsApp →
              </a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-4">
            <BrandMark className="h-8" />
            <div className="flex flex-col">
              <span className="font-semibold">Bruno Victor</span>
              <span className="text-sm text-ink-muted">{t(M.role)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 font-mono text-sm text-ink-muted md:items-end">
            <span>
              <span className="mr-2">ig</span>
              <a href={INSTAGRAM} target="_blank" rel="noreferrer" className="text-ink hover:underline">
                @brunovictor.jsx
              </a>
            </span>
            <span>
              <span className="mr-2">tel</span>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="text-ink hover:underline">
                +55 81 98736-3068
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroMock({ t }: { t: ReturnType<typeof useT>["t"] }) {
  const cols = [
    {
      who: "Juliana",
      rows: [
        { time: "13:30", name: "André P.", kind: "done" },
        { time: "14:20", name: "Mateus R.", kind: "live", note: M.mockInChair },
        { time: "15:20", name: "Igor S.", kind: "paid", note: M.mockPaid },
      ],
    },
    {
      who: "Rafael",
      rows: [
        { time: "13:40", name: "Thiago M.", kind: "late", note: M.mockLate },
        { time: "15:30", name: "Gustavo L.", kind: "paid", note: M.mockPaid },
        { time: "16:30", name: "Rodrigo A.", kind: "paid" },
      ],
    },
  ];
  return (
    <div data-hero-fade className="rounded-md border border-hairline bg-surface-0/70 p-4" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between">
        <span className="bv-tag">&lt;{t(M.mockTitle).toLowerCase()} /&gt;</span>
        <BrandMark className="h-3.5" />
      </div>
      <div className="relative grid grid-cols-2 gap-3">
        {cols.map((c) => (
          <div key={c.who} className="flex flex-col gap-2">
            <span className="text-sm font-medium">{c.who}</span>
            {c.rows.map((r) => (
              <div
                key={r.time}
                data-mock-row
                className={
                  r.kind === "live"
                    ? "rounded-sm border-2 border-ink bg-ink p-3 text-surface-0"
                    : r.kind === "late"
                      ? "bv-hatch-strong rounded-sm border border-dashed border-ink p-3"
                      : r.kind === "done"
                        ? "rounded-sm border border-hairline bg-surface-2 p-3 text-ink-muted"
                        : "rounded-sm border border-ink p-3"
                }
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono">{r.time}</span>
                  {r.kind === "live" && <span data-mock-live className="size-2 rounded-full bg-surface-0" />}
                </div>
                <div className="font-medium">{r.name}</div>
                {r.note && <div className="text-xs opacity-80">{t(r.note)}</div>}
              </div>
            ))}
          </div>
        ))}
        <div data-mock-now className="pointer-events-none absolute left-0 right-0 top-[46%] h-0.5 bg-ink" />
      </div>
    </div>
  );
}
