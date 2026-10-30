"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SignInGate } from "@/components/client/shared";
import { Avatar, Field } from "@/components/kit";
import { BottomBar, MobileHeader } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT, type Messages } from "@/i18n";
import { useAction, useClient } from "@/lib/client/hooks";
import { tx as txRaw } from "@/lib/domain/text";

const M = {
  step1: ["Passo 1 de 2", "Step 1 of 2"],
  step2: ["Passo 2 de 2", "Step 2 of 2"],
  title1: ["Monte seu perfil", "Set up your profile"],
  title2: ["Sobre você", "About you"],
  first: ["Nome", "First name"],
  last: ["Sobrenome", "Last name"],
  email: ["E-mail", "Email"],
  fromGoogle: ["do Google", "from Google"],
  phone: ["Celular (WhatsApp)", "Phone (WhatsApp)"],
  phoneHint: ["É por esse número que a assistente da unidade reconhece você no WhatsApp e manda os lembretes do seu horário.", "This is how the location's assistant recognizes you on WhatsApp and sends your reminders."],
  continue: ["Continuar", "Continue"],
  aboutHint: ["Opcional para clientes. Para quem atende, é o texto que aparece no perfil público.", "Optional for clients. For staff, it's the text shown on their public profile."],
  aboutLabel: ["Sobre mim", "About me"],
  aboutPh: ["Conte um pouco sobre você", "Tell us a bit about yourself"],
  skip: ["Pular", "Skip"],
  finish: ["Concluir", "Finish"],
  saved: ["Perfil salvo.", "Profile saved."],
} satisfies Messages;

export default function EditProfilePage() {
  return (
    <SignInGate>
      <Suspense>
        <EditProfile />
      </Suspense>
    </SignInGate>
  );
}

function EditProfile() {
  const { t, locale } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app/profile";
  const me = useClient()!;
  const { run, busy } = useAction("client");
  const [step, setStep] = useState<1 | 2>(1);
  const [f, setF] = useState({ firstName: me.firstName, lastName: me.lastName, phone: me.phone, about: txRaw(me.about, locale) });
  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader title={t(step === 1 ? M.title1 : M.title2)} back={step === 1 ? true : undefined} sub={t(step === 1 ? M.step1 : M.step2)} />
      {step === 1 ? (
        <div className="flex flex-col gap-4 p-5" data-anim>
          <Avatar name={`${f.firstName} ${f.lastName}`} inverted className="size-20 self-center text-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(M.first)}>
              <Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
            </Field>
            <Field label={t(M.last)}>
              <Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label={t(M.email)} hint={t(M.fromGoogle)}>
            <Input value={me.email} disabled />
          </Field>
          <Field label={t(M.phone)} hint={t(M.phoneHint)}>
            <Input type="tel" value={f.phone} placeholder="(81) 9 0000-0000" onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-5" data-anim>
          <p className="text-ink-muted">{t(M.aboutHint)}</p>
          <Field label={t(M.aboutLabel)} hint={`${f.about.length}/400`}>
            <Textarea rows={6} maxLength={400} placeholder={t(M.aboutPh)} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} />
          </Field>
        </div>
      )}
      <BottomBar>
        {step === 1 ? (
          <Button
            size="lg"
            className="w-full"
            disabled={busy || !f.firstName.trim() || !f.lastName.trim() || f.phone.replace(/\D/g, "").length < 8}
            onClick={async () => {
              const r = await run("client.updateProfile", { firstName: f.firstName, lastName: f.lastName, phone: f.phone, acceptTerms: true });
              if (r) setStep(2);
            }}
          >
            {t(M.continue)} →
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" onClick={() => router.push(next)}>
              {t(M.skip)}
            </Button>
            <Button
              size="lg"
              disabled={busy}
              onClick={async () => {
                const r = await run("client.updateProfile", { about: f.about }, { success: t(M.saved) });
                if (r) router.push(next);
              }}
            >
              {t(M.finish)}
            </Button>
          </div>
        )}
      </BottomBar>
    </div>
  );
}
