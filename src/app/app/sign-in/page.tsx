"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BrandMark, Tag } from "@/components/brand";
import { Field } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT, type Messages } from "@/i18n";
import { useAction } from "@/lib/client/hooks";
import { store } from "@/lib/client/store";

const M = {
  tag: ["entrar", "sign in"],
  title: ["Seu momento te espera.", "Your moment is waiting."],
  sub: ["Escolha o serviço, o horário e pague pelo app. Chegou, foi atendida.", "Pick the service, the time and pay in the app. Arrive and get served."],
  google: ["Entrar com Google", "Sign in with Google"],
  demo: ["Na demo, entra como Mariana Lopes (cliente com histórico).", "In the demo, you sign in as Mariana Lopes (a client with history)."],
  or: ["ou crie um perfil novo", "or create a new profile"],
  name: ["Seu nome", "Your name"],
  email: ["E-mail do Google", "Google email"],
  create: ["Criar conta e continuar", "Create account and continue"],
  accept: ["Ao entrar você aceita os", "By signing in you accept the"],
  terms: ["Termos de serviço", "Terms of service"],
  and: ["e a", "and the"],
  privacy: ["Política de privacidade", "Privacy policy"],
} satisfies Messages;

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
  const { run, busy } = useAction("client");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const signIn = async (mode: "demo" | "new") => {
    const r = await run<{ clientId: string; isNew: boolean }>("client.signIn", mode === "demo" ? { mode } : { mode, email, name });
    if (!r) return;
    store.setSession({ clientId: r.clientId });
    router.push(r.isNew ? `/app/profile/edit?next=${encodeURIComponent(next)}` : next);
  };
  return (
    <div className="bv-gradient flex flex-1 flex-col gap-8 p-6">
      <BrandMark className="mt-6 h-8 self-start" />
      <div className="flex flex-col gap-3" data-anim>
        <Tag>{t(M.tag)}</Tag>
        <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em]">{t(M.title)}</h1>
        <p className="text-ink-muted">{t(M.sub)}</p>
      </div>
      <div className="flex flex-col gap-2" data-anim>
        <Button size="lg" variant="outline" className="bg-surface-0" disabled={busy} onClick={() => signIn("demo")}>
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14zM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9z" />
          </svg>
          {t(M.google)}
        </Button>
        <p className="text-xs text-ink-muted">{t(M.demo)}</p>
      </div>
      <div className="flex flex-col gap-3" data-anim>
        <span className="bv-label">{t(M.or)}</span>
        <Field label={t(M.name)}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t(M.email)}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button disabled={busy || name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email)} onClick={() => signIn("new")}>
          {t(M.create)} →
        </Button>
      </div>
      <p className="mt-auto text-xs text-ink-muted">
        {t(M.accept)}{" "}
        <Link href="/app/terms" className="underline">
          {t(M.terms)}
        </Link>{" "}
        {t(M.and)}{" "}
        <Link href="/app/terms?doc=privacy" className="underline">
          {t(M.privacy)}
        </Link>
        .
      </p>
    </div>
  );
}
