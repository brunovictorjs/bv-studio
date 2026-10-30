"use client";

import { useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { Markdown } from "@/components/content";
import { Chip, Panel, Row, Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT, type Messages } from "@/i18n";
import { useAction, useDb } from "@/lib/client/hooks";

const M = {
  privacy: ["Política de privacidade", "Privacy policy"],
  terms: ["Termos de serviço", "Terms of service"],
  versionLine: ["versão {v} · publicada em {d}", "version {v} · published {d}"],
  draftOf: ["rascunho da v{v}", "draft of v{v}"],
  edit: ["Editar", "Edit"],
  preview: ["Pré-visualizar", "Preview"],
  publication: ["Publicação", "Publishing"],
  status: ["Situação", "Status"],
  draft: ["Rascunho", "Draft"],
  published: ["Publicado", "Published"],
  current: ["Vigente", "Current"],
  acceptances: ["Aceites da v{v}", "v{v} acceptances"],
  editedBy: ["Editado por", "Edited by"],
  saveDraft: ["Salvar rascunho", "Save draft"],
  publish: ["Publicar nova versão", "Publish new version"],
  history: ["Ver histórico de versões", "See version history"],
  publishHint: ["Publicar pede novo aceite no próximo login de cada cliente.", "Publishing asks every client to accept again on their next sign-in."],
  where: ["Onde aparece", "Where it appears"],
  whereBody: ["Rodapé do site das unidades, tela de login e antes de pagar.", "Every location's site footer, the sign-in screen and before paying."],
  savedDraft: ["Rascunho salvo.", "Draft saved."],
  publishedOk: ["Versão {v} publicada.", "Version {v} published."],
  version: ["Versão {v}", "Version {v}"],
  langNote: ["O texto editado aqui vale para os dois idiomas até ser traduzido.", "Text edited here applies to both languages until translated."],
} satisfies Messages;

export default function PoliciesPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Policies />
    </RoleGate>
  );
}

function Policies() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const [doc, setDoc] = useState<"terms" | "privacy">("terms");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const p = db?.settings.policies[doc];
  const draftText = p ? tx(p.draft) : "";
  const text = drafts[doc] ?? draftText;
  const setText = (v: string) => setDrafts((d) => ({ ...d, [doc]: v }));
  if (!db || !p) return null;
  const dirty = text !== draftText;
  const isDraft = tx(p.draft) !== tx(p.published) || dirty;
  return (
    <>
      <div className="flex flex-wrap gap-2" data-anim>
        <Segmented
          label={t(M.terms)}
          value={doc}
          onChange={setDoc}
          options={[
            { value: "terms", label: t(M.terms) },
            { value: "privacy", label: t(M.privacy) },
          ]}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title={t(doc === "terms" ? M.terms : M.privacy)}
          description={`${t(M.versionLine, { v: p.version, d: fmt.numeric(p.publishedAt) + "/" + p.publishedAt.slice(0, 4) })}${isDraft ? ` · ${t(M.draftOf, { v: p.version + 1 })}` : ""}`}
          actions={
            <Segmented
              size="sm"
              label={t(M.edit)}
              value={mode}
              onChange={setMode}
              options={[
                { value: "edit", label: t(M.edit) },
                { value: "preview", label: t(M.preview) },
              ]}
            />
          }
        >
          {mode === "edit" ? (
            <textarea
              aria-label={t(doc === "terms" ? M.terms : M.privacy)}
              className="min-h-[420px] w-full rounded-sm border border-input bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ink"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <div className="min-h-[420px] rounded-sm border border-hairline p-5">
              <Markdown source={text} />
            </div>
          )}
          <p className="mt-2 text-xs text-ink-muted">{t(M.langNote)}</p>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title={t(M.publication)}>
            <div className="flex flex-col divide-y divide-hairline text-sm">
              <Row label={t(M.status)} value={<Chip active={!isDraft}>{isDraft ? t(M.draft) : t(M.published)}</Chip>} />
              <Row label={t(M.current)} value={t(M.version, { v: p.version })} />
              <Row
                label={t(M.acceptances, { v: p.version })}
                value={`${fmt.num(p.acceptances)} / ${fmt.num(db.users.filter((u) => u.roles.includes("client")).length)}`}
              />
              <Row label={t(M.editedBy)} value={`${p.editedBy} · ${fmt.relative(p.editedAt)}`} />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="outline" disabled={busy || !dirty} onClick={() => run("policy.save", { doc, draft: text, publish: false }, { success: t(M.savedDraft) }).then((r) => {
                    if (r)
                      setDrafts((d) => {
                        const next = { ...d };
                        delete next[doc];
                        return next;
                      });
                  })
              }>
                {t(M.saveDraft)}
              </Button>
              <Button
                disabled={busy || !isDraft}
                onClick={async () => {
                  const r = await run<{ version: number }>("policy.save", { doc, draft: text, publish: true });
                  if (r) (await import("sonner")).toast.success(t(M.publishedOk, { v: r.version }));
                }}
              >
                {t(M.publish)}
              </Button>
              <Button variant="link" onClick={() => setHistoryOpen(true)}>
                {t(M.history)}
              </Button>
            </div>
            <p className="mt-2 text-xs text-ink-muted">{t(M.publishHint)}</p>
          </Panel>
          <Panel title={t(M.where)}>
            <p className="text-sm text-ink-muted">{t(M.whereBody)}</p>
          </Panel>
        </div>
      </div>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(M.history)}</DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col divide-y divide-hairline">
            {[...p.history].reverse().map((h) => (
              <li key={h.version} className="flex justify-between py-2.5 text-sm">
                <span className="font-mono">v{h.version}</span>
                <span className="text-ink-muted">{fmt.numeric(h.publishedAt)}/{h.publishedAt.slice(0, 4)}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
