"use client";

import { MoreHorizontal, Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ConflictList } from "@/components/admin/hours-editor";
import { RoleGate } from "@/components/admin/shell";
import { Avatar, Chip, Empty, Field, PageHeader, Pager, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C, ROLE } from "@/i18n/common";
import { conflictList, useAction, useDb, useStaff } from "@/lib/client/hooks";
import { matches, tx as txRaw } from "@/lib/domain/text";
import type { Role, User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const M = {
  eyebrow: ["Pessoas · só administradores", "People · admins only"],
  title: ["Usuários", "Users"],
  search: ["Nome ou e-mail", "Name or email"],
  invite: ["Convidar", "Invite"],
  pros: ["Profissionais", "Professionals"],
  desks: ["Balconistas", "Front desk"],
  clients: ["Clientes", "Clients"],
  admins: ["Administradores", "Admins"],
  activeF: ["Ativos", "Active"],
  disabledF: ["Desativados", "Deactivated"],
  person: ["Pessoa", "Person"],
  publicProfile: ["Perfil público", "Public profile"],
  complete: ["Completo", "Complete"],
  noAbout: ["Sem \"sobre mim\" · não aparece na vitrine", "No \"about me\" · not shown on the site"],
  served: ["Atendimentos", "Services"],
  commission: ["Comissões", "Commissions"],
  roles: ["Papéis", "Roles"],
  invited: ["Convidada", "Invited"],
  disabled: ["Desativado", "Deactivated"],
  more: ["Mais ações", "More actions"],
  edit: ["Editar papéis e comissão", "Edit roles and commission"],
  deactivate: ["Desativar", "Deactivate"],
  reactivate: ["Reativar", "Reactivate"],
  accept: ["Marcar convite aceito", "Mark invitation accepted"],
  hint: [
    "Profissionais e balconistas pertencem a uma unidade só; para mudar, use Transferir na configuração da unidade. Só quem tem \"sobre mim\" preenchido aparece em \"Quem vai te atender\".",
    "Professionals and front desk belong to a single location; to change it, use Transfer in the location settings. Only people with an \"about me\" appear under \"Who will serve you\".",
  ],
  inviteTitle: ["Convidar pessoa", "Invite a person"],
  inviteHint: ["Ela entra com a conta Google deste e-mail e já cai na área do papel escolhido.", "They sign in with the Google account for this email and land in the area for their role."],
  firstName: ["Nome", "First name"],
  lastName: ["Sobrenome", "Last name"],
  unitHint: ["Obrigatória para profissional e balconista. Administradores veem todas.", "Required for professionals and front desk. Admins see all."],
  send: ["Enviar convite", "Send invitation"],
  sent: ["Convite enviado.", "Invitation sent."],
  execPct: ["Execução (%)", "Service (%)"],
  productPct: ["Produtos (%)", "Products (%)"],
  savedUser: ["Usuário atualizado.", "User updated."],
  conflict: ["Há atendimentos futuros", "There are future bookings"],
  sinceShort: ["desde {d}", "since {d}"],
  orders: ["{n} pedidos", "{n} orders"],
} satisfies Messages;

type Tab = "professional" | "desk" | "client" | "admin";

export default function UsersPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Suspense>
        <Users />
      </Suspense>
    </RoleGate>
  );
}

function Users() {
  const { t, tx, fmt, locale } = useT();
  const db = useDb();
  const me = useStaff();
  const params = useSearchParams();
  const { run, busy } = useAction("staff");
  const [tab, setTab] = useState<Tab>("professional");
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState("all");
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(params.get("invite") === "1");
  const [editing, setEditing] = useState<User | null>(null);
  const [conflicts, setConflicts] = useState<ReturnType<typeof conflictList>>([]);
  if (!db) return null;

  const count = (r: Role) => db.users.filter((u) => u.roles.includes(r)).length;
  const rows = db.users.filter(
    (u) =>
      u.roles.includes(tab) &&
      (unit === "all" || u.unitId === unit || (tab === "client" && u.preferredUnitId === unit)) &&
      (status === "active" ? u.status !== "disabled" : u.status === "disabled") &&
      matches(`${u.firstName} ${u.lastName} ${u.email}`, q),
  );
  const pageRows = rows.slice((page - 1) * 20, page * 20);
  const served = (id: string) => db.orders.filter((o) => o.professionalId === id && o.status === "completed").length;
  const clientOrders = (id: string) => db.orders.filter((o) => o.clientId === id && o.status !== "cart").length;
  const rating = (id: string) => {
    const r = db.reviews.filter((x) => x.professionalId === id && x.proRating);
    return r.length ? r.reduce((a, b) => a + (b.proRating ?? 0), 0) / r.length : null;
  };

  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        actions={
          <>
            <label className="flex h-10 min-w-60 items-center gap-2 rounded-sm border border-input px-3">
              <Search className="size-4 text-ink-muted" />
              <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
            </label>
            <Button onClick={() => setInviteOpen(true)}>
              <Plus /> {t(M.invite)}
            </Button>
          </>
        }
      />
      <nav className="flex gap-1 overflow-x-auto border-b border-hairline" data-anim>
        {(
          [
            ["professional", M.pros],
            ["desk", M.desks],
            ["client", M.clients],
            ["admin", M.admins],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => (setTab(k), setPage(1))}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm", tab === k ? "border-ink font-medium" : "border-transparent text-ink-muted hover:text-ink")}
          >
            {t(label)} · {fmt.num(count(k))}
          </button>
        ))}
      </nav>
      <section className="flex flex-wrap gap-2" data-anim>
        <Select value={unit} onValueChange={(v) => (setUnit(v), setPage(1))}>
          <SelectTrigger className="w-48" aria-label={t(C.unit)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(C.allUnits)}</SelectItem>
            {db.units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {tx(u.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40" aria-label={t(C.status)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t(M.activeF)}</SelectItem>
            <SelectItem value="disabled">{t(M.disabledF)}</SelectItem>
          </SelectContent>
        </Select>
      </section>
      {conflicts.length > 0 && (
        <div className="rounded-md border border-dashed border-ink p-4" role="alert">
          <span className="font-medium">{t(M.conflict)}</span>
          <ConflictList items={conflicts} />
        </div>
      )}
      <Panel>
        {rows.length === 0 ? (
          <Empty>{t(C.noResults)}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t(M.person)}</TableHead>
                  <TableHead>{t(C.unit)}</TableHead>
                  {tab === "professional" && <TableHead>{t(M.publicProfile)}</TableHead>}
                  <TableHead className="text-right">{tab === "client" ? t(["Pedidos", "Orders"]) : t(M.served)}</TableHead>
                  {tab === "professional" && <TableHead className="text-right">{t(C.rating)}</TableHead>}
                  {tab === "professional" && <TableHead>{t(M.commission)}</TableHead>}
                  <TableHead>{t(M.roles)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(C.actions)}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((u) => {
                  const r = rating(u.id);
                  const unitName = tx(db.units.find((x) => x.id === (u.unitId ?? u.preferredUnitId))?.name);
                  return (
                    <TableRow key={u.id} className={cn(u.status === "disabled" && "text-ink-muted")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={`${u.firstName} ${u.lastName}`} />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {u.firstName} {u.lastName}
                            </span>
                            <span className="text-xs text-ink-muted">{u.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{u.roles.includes("admin") && !u.unitId ? t(C.allUnits) : unitName || "—"}</TableCell>
                      {tab === "professional" && (
                        <TableCell className="max-w-48 text-sm">{txRaw(u.about, locale) ? t(M.complete) : <span className="text-ink-muted">{t(M.noAbout)}</span>}</TableCell>
                      )}
                      <TableCell className="tabular text-right">{tab === "client" ? clientOrders(u.id) : served(u.id) || "—"}</TableCell>
                      {tab === "professional" && <TableCell className="tabular text-right">{r ? fmt.num(r, 1) : "—"}</TableCell>}
                      {tab === "professional" && (
                        <TableCell className="tabular">{u.commission ? `${u.commission.exec}% · ${u.commission.product}%` : "—"}</TableCell>
                      )}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.status === "invited" && <Chip className="border-dashed border-ink text-ink">{t(M.invited)}</Chip>}
                          {u.status === "disabled" && <Chip>{t(M.disabled)}</Chip>}
                          {u.roles.map((role) => (
                            <Chip key={role} active={role === "admin"}>
                              {t(ROLE[role])}
                            </Chip>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {tab !== "client" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={t(M.more)}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setEditing(u)}>{t(M.edit)}</DropdownMenuItem>
                              {u.status === "invited" && <DropdownMenuItem onSelect={() => run("user.setStatus", { id: u.id, status: "active" })}>{t(M.accept)}</DropdownMenuItem>}
                              {u.id !== me?.id &&
                                (u.status === "disabled" ? (
                                  <DropdownMenuItem onSelect={() => run("user.setStatus", { id: u.id, status: "active" })}>{t(M.reactivate)}</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setConflicts([]);
                                      void run("user.setStatus", { id: u.id, status: "disabled" }, { onError: (e) => setConflicts(conflictList(e)) });
                                    }}
                                  >
                                    {t(M.deactivate)}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} pages={Math.ceil(rows.length / 20)} total={rows.length} pageSize={20} onPage={setPage} />
        <p className="mt-3 text-sm text-ink-muted">{t(M.hint)}</p>
      </Panel>
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} busy={busy} run={run} />
      {editing && <EditDialog user={editing} onClose={() => setEditing(null)} busy={busy} run={run} />}
    </>
  );
}

type Run = ReturnType<typeof useAction>["run"];

function RolePicker({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {(["professional", "desk", "admin"] as Role[]).map((r) => {
        const on = value.includes(r);
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}
            className={cn("h-10 rounded-sm border px-4 text-sm", on ? "border-ink bg-ink text-surface-0" : "border-hairline hover:border-ink")}
          >
            {t(ROLE[r])}
          </button>
        );
      })}
    </div>
  );
}

function InviteDialog({ open, onClose, busy, run }: { open: boolean; onClose: () => void; busy: boolean; run: Run }) {
  const { t, tx } = useT();
  const db = useDb();
  const [f, setF] = useState({ email: "", firstName: "", lastName: "", roles: ["professional"] as Role[], unitId: db?.units[0]?.id ?? "" });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">{t(M.inviteTitle)}</DialogTitle>
          <DialogDescription>{t(M.inviteHint)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={t(C.email)}>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(M.firstName)}>
              <Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
            </Field>
            <Field label={t(M.lastName)}>
              <Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label={t(M.roles)}>
            <RolePicker value={f.roles} onChange={(roles) => setF({ ...f, roles })} />
          </Field>
          <Field label={t(C.unit)} hint={t(M.unitHint)}>
            <Select value={f.unitId} onValueChange={(v) => setF({ ...f, unitId: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {db?.units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {tx(u.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t(C.cancel)}
          </Button>
          <Button
            disabled={busy || !f.email || !f.firstName || !f.roles.length}
            onClick={async () => {
              const needsUnit = f.roles.some((r) => r !== "admin");
              const r = await run("user.invite", { ...f, unitId: needsUnit ? f.unitId : null }, { success: t(M.sent) });
              if (r) {
                setF({ ...f, email: "", firstName: "", lastName: "" });
                onClose();
              }
            }}
          >
            {t(M.send)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ user, onClose, busy, run }: { user: User; onClose: () => void; busy: boolean; run: Run }) {
  const { t } = useT();
  const [roles, setRoles] = useState<Role[]>(user.roles.filter((r) => r !== "client"));
  const [exec, setExec] = useState(String(user.commission?.exec ?? 55));
  const [product, setProduct] = useState(String(user.commission?.product ?? 15));
  const isPro = roles.includes("professional");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {user.firstName} {user.lastName}
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <Field label={t(M.roles)}>
          <RolePicker value={roles} onChange={setRoles} />
        </Field>
        {isPro && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(M.execPct)}>
              <Input inputMode="decimal" value={exec} onChange={(e) => setExec(e.target.value)} />
            </Field>
            <Field label={t(M.productPct)}>
              <Input inputMode="decimal" value={product} onChange={(e) => setProduct(e.target.value)} />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t(C.cancel)}
          </Button>
          <Button
            disabled={busy || roles.length === 0}
            onClick={async () => {
              const r = await run(
                "user.update",
                { id: user.id, roles, commission: isPro ? { exec: Number(exec.replace(",", ".")), product: Number(product.replace(",", ".")) } : null },
                { success: t(M.savedUser) },
              );
              if (r) onClose();
            }}
          >
            {t(C.save)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
