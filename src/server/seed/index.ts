import { L, normalize } from "@/lib/domain/text";
import {
  addDays,
  addMinutes,
  datePart,
  epochMin,
  fromMinutes,
  join,
  timePart,
  toMinutes,
} from "@/lib/domain/time";
import { orderTotal, proHoursOn, stripeFee, unitHoursOn } from "@/lib/domain/rules";
import type {
  Conversation,
  DateTimeStr,
  DB,
  LText,
  Notice,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  Review,
  Service,
  TimelineEvent,
  User,
} from "@/lib/domain/types";
import { mulberry32, newCompletionCode, newOrderCode, pick, type Rng } from "../ids";
import {
  femaleClients,
  maleClients,
  reviewTexts,
  seedCategories,
  seedProducts,
  seedServices,
  seedSettings,
  seedStaff,
  seedUnits,
} from "./catalog";

export const DB_VERSION = 3;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const slug = (name: string) => normalize(name).replace(/[^a-z]+/g, ".");

interface AddOrderInput {
  unitId: string;
  pro: User | null;
  client: User | null;
  walkinName?: string;
  start: DateTimeStr | null;
  services: Service[];
  products?: Product[];
  extras?: Product[];
  status: OrderStatus;
  method: PaymentMethod;
  createdAt: DateTimeStr;
  /** counter balance already received at the desk */
  settled?: boolean;
  delivered?: boolean;
  startedAt?: DateTimeStr | null;
  completedAt?: DateTimeStr | null;
  doneCount?: number;
  any?: boolean;
}

export function buildSeed(now: DateTimeStr): DB {
  const today = datePart(now);
  const rng: Rng = mulberry32(hash(today));
  const units = seedUnits(today);
  const staffUsers = seedStaff(today, addDays);
  const settings = seedSettings(today, addDays);

  const phone = () =>
    `(81) 9 9${Math.floor(rng() * 900 + 100)}-${String(Math.floor(rng() * 9000 + 1000))}`;

  const mkClient = (name: string, unitId: string): User => {
    const [firstName, ...rest] = name.split(" ");
    return {
      id: `cl-${slug(name).replace(/\./g, "-")}`,
      firstName,
      lastName: rest.join(" "),
      email: `${slug(name)}@email.com`,
      phone: phone(),
      roles: ["client"],
      unitId: null,
      about: "",
      since: addDays(today, -Math.floor(rng() * 500 + 40)),
      status: "active",
      commission: null,
      schedule: null,
      periods: [],
      favorites: { services: [], products: [], professionals: [] },
      preferredUnitId: unitId,
      acceptedTermsVersion: 4,
    };
  };

  const salonClients = femaleClients.map((n) => mkClient(n, "u-salao"));
  const barberClients = maleClients.map((n) => mkClient(n, "u-barbearia"));
  const mariana = salonClients[0];
  mariana.email = "mariana.lopes@gmail.com";
  mariana.phone = "(81) 9 9123-4455";
  mariana.since = addDays(today, -580);
  mariana.favorites = {
    services: ["s-escova", "s-manipedi"],
    products: ["pr-serum"],
    professionals: ["p-juliana", "p-camila"],
  };

  const db: DB = {
    version: DB_VERSION,
    seededAt: now,
    units,
    categories: seedCategories.map((c) => ({ ...c })),
    services: seedServices.map((s) => ({ ...s, units: s.units.map((u) => ({ ...u })) })),
    products: seedProducts.map((p) => ({ ...p, units: p.units.map((u) => ({ ...u })) })),
    offers: [
      {
        id: "of-quimica",
        unitId: "u-salao",
        name: L("Terça e quarta da química", "Chemical Tuesdays & Wednesdays"),
        type: "percent",
        value: 20,
        usageLimit: 40,
        uses: 14,
        start: addDays(today, -4),
        end: addDays(today, 5),
        weekdays: [2, 3],
        serviceIds: ["s-botox"],
      },
      {
        id: "of-combo",
        unitId: "u-barbearia",
        name: L("Combo da semana", "Combo of the week"),
        type: "percent",
        value: 25,
        usageLimit: null,
        uses: 41,
        start: addDays(today, -4),
        end: addDays(today, 6),
        weekdays: [1, 2, 3, 4],
        serviceIds: ["s-combo"],
      },
      {
        id: "of-unhas",
        unitId: "u-salao",
        name: L("Mês das unhas", "Nails month"),
        type: "fixed",
        value: 1000,
        usageLimit: 100,
        uses: 0,
        start: addDays(today, 3),
        end: addDays(today, 33),
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        serviceIds: ["s-manipedi", "s-spa"],
      },
      {
        id: "of-primavera",
        unitId: "u-barbearia",
        name: L("Primavera", "Spring"),
        type: "percent",
        value: 10,
        usageLimit: 50,
        uses: 23,
        start: addDays(today, -40),
        end: addDays(today, -19),
        weekdays: [2, 3, 4, 5, 6],
        serviceIds: ["s-hidratacao"],
      },
    ],
    users: [...staffUsers, ...salonClients, ...barberClients],
    orders: [],
    reviews: [],
    conversations: [],
    notices: [],
    settings,
    counters: { order: 0, walkin: 210 },
  };

  const svc = (id: string) => db.services.find((s) => s.id === id)!;
  const prod = (id: string) => db.products.find((p) => p.id === id)!;
  const user = (id: string) => db.users.find((u) => u.id === id)!;
  const unitOf = (id: string) => db.units.find((u) => u.id === id)!;

  const busy = new Map<string, [number, number][]>();
  const isFree = (proId: string, s: number, e: number) =>
    !(busy.get(proId) ?? []).some(([a, b]) => s < b && a < e);
  const reserve = (proId: string, s: number, e: number) => {
    const list = busy.get(proId) ?? [];
    list.push([s, e]);
    busy.set(proId, list);
  };

  const desks: Record<string, string> = { "u-salao": "d-bianca", "u-barbearia": "d-tatiane" };
  const counterMethods: PaymentMethod[] = ["cash", "store_pix", "pos_debit", "pos_credit"];

  function addOrder(p: AddOrderInput): Order {
    const unitPrice = (s: Service) => s.units.find((u) => u.unitId === p.unitId)?.price ?? s.price;
    const pPrice = (pr: Product) => pr.units.find((u) => u.unitId === p.unitId)?.price ?? pr.price;
    const items: OrderItem[] = [];
    const date = p.start ? datePart(p.start) : today;
    let discount = 0;
    let offerId: string | null = null;
    for (const s of p.services) {
      const price = unitPrice(s);
      items.push({
        id: `it-${items.length + 1}`,
        kind: "service",
        refId: s.id,
        name: s.name,
        unitPrice: price,
        qty: 1,
        durationMin: s.durationMin,
        doneAt: null,
      });
      const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
      const offer = db.offers.find(
        (o) =>
          o.unitId === p.unitId &&
          o.serviceIds.includes(s.id) &&
          date >= o.start &&
          date <= o.end &&
          o.weekdays.includes(wd),
      );
      if (offer && p.status !== "cart") {
        discount += offer.type === "percent" ? Math.round((price * offer.value) / 100) : offer.value;
        offerId = offer.id;
      }
    }
    for (const pr of p.products ?? []) {
      items.push({
        id: `it-${items.length + 1}`,
        kind: "product",
        refId: pr.id,
        name: pr.name,
        unitPrice: pPrice(pr),
        qty: 1,
        durationMin: 0,
        delivered: !!p.delivered,
      });
    }
    const timeline: TimelineEvent[] = p.status === "cart" ? [{ at: p.createdAt, kind: "cart", by: p.client?.id ?? null }] : [{ at: p.createdAt, kind: "created", by: p.client?.id ?? null }];
    const order: Order = {
      id: `o-${String(db.orders.length + 1).padStart(4, "0")}`,
      code: newOrderCode(db, rng),
      completionCode: newCompletionCode(rng),
      unitId: p.unitId,
      clientId: p.client?.id ?? null,
      clientName: p.client ? `${p.client.firstName} ${p.client.lastName}` : p.walkinName ?? "",
      clientPhone: p.client?.phone ?? "",
      origin: p.walkinName ? "walkin" : "site",
      professionalId: p.pro?.id ?? null,
      start: p.start,
      status: p.status,
      items,
      discount,
      offerId,
      payments: [],
      refunded: 0,
      timeline,
      createdAt: p.createdAt,
      startedAt: p.startedAt ?? null,
      completedAt: p.completedAt ?? null,
      pausedMin: 0,
      chosenMethod: p.method,
      anyProfessional: !!p.any,
      reviewed: false,
    };
    if (order.origin === "walkin") {
      db.counters.walkin += 1;
      order.code = `AVL-${String(db.counters.walkin).padStart(4, "0")}`;
      order.timeline = [{ at: p.createdAt, kind: "created", by: desks[p.unitId] }];
    }

    const online = ["pix", "credit", "debit"].includes(p.method) && order.origin === "site";
    const base = orderTotal(order);
    if (p.status !== "cart") {
      if (online && p.status !== "awaiting_payment") {
        const paidAt = addMinutes(p.createdAt, 4);
        order.payments.push({
          id: `pay-${order.id}-1`,
          method: p.method,
          channel: "online",
          amount: base,
          at: paidAt,
          stripeId: `pi_3Q${order.code.slice(3)}${Math.floor(rng() * 9999)}`,
          fee: stripeFee(p.method, base, db.settings),
        });
        order.timeline.push({ at: paidAt, kind: "paid", note: null });
      } else if (order.origin === "site") {
        order.timeline.push({ at: addMinutes(p.createdAt, 3), kind: "reserved_cash" });
      }
    }

    if (p.start && p.status !== "cart") {
      const s = epochMin(p.start);
      for (const before of [1440, 120]) {
        const at = addMinutes(p.start, -before);
        if (epochMin(at) <= epochMin(now) && epochMin(at) > epochMin(p.createdAt) && p.status !== "cancelled" && s > epochMin(now) - 2880)
          order.timeline.push({ at, kind: "reminder", note: before === 1440 ? L("1 dia antes", "1 day before") : L("2 horas antes", "2 hours before") });
      }
      if (p.pro) reserve(p.pro.id, s, s + order.items.reduce((a, i) => a + i.durationMin, 0));
    }

    if (p.startedAt) order.timeline.push({ at: p.startedAt, kind: "checkin", by: p.pro?.id });

    // extras launched by the professional during the service
    for (const ex of p.extras ?? []) {
      order.items.push({
        id: `it-${order.items.length + 1}`,
        kind: "product",
        refId: ex.id,
        name: ex.name,
        unitPrice: pPrice(ex),
        qty: 1,
        durationMin: 0,
        addedBy: p.pro?.id,
        delivered: !!p.settled,
      });
      if (p.startedAt) order.timeline.push({ at: addMinutes(p.startedAt, 12), kind: "extra", by: p.pro?.id, note: ex.name });
    }

    const services = order.items.filter((i) => i.kind === "service");
    if (p.startedAt) {
      let t = epochMin(p.startedAt);
      const doneCount = p.status === "completed" ? services.length : p.doneCount ?? 0;
      services.slice(0, doneCount).forEach((it) => {
        t += it.durationMin;
        it.doneAt = addMinutes(p.startedAt!, t - epochMin(p.startedAt!));
      });
    }

    if (p.status === "completed" && p.completedAt) {
      if (order.origin === "site") order.timeline.push({ at: p.completedAt, kind: "completed", by: p.pro?.id });
      else order.timeline.push({ at: p.completedAt, kind: "completed", by: p.pro?.id });
      order.items.forEach((i) => {
        if (i.kind === "product") i.delivered = p.settled !== false;
      });
      const due = orderTotal(order) - order.payments.reduce((a, x) => a + x.amount, 0);
      if (due > 0 && p.settled !== false) {
        const at = addMinutes(p.completedAt, 6);
        const m = online ? pick(rng, counterMethods) : p.method === "cash" ? "cash" : pick(rng, counterMethods);
        const received = m === "cash" ? Math.ceil(due / 1000) * 1000 : due;
        order.payments.push({
          id: `pay-${order.id}-2`,
          method: m,
          channel: "counter",
          amount: due,
          at,
          by: desks[p.unitId],
          received,
          change: received - due,
          fee: 0,
        });
        order.timeline.push({ at, kind: "counter_received", by: desks[p.unitId] });
      }
    }
    if (p.status === "cancelled") {
      const at = p.start ? addMinutes(p.start, -Math.floor(rng() * 1200 + 60)) : addMinutes(p.createdAt, 60);
      order.timeline.push({ at, kind: "cancelled", by: order.clientId });
      const paid = order.payments.reduce((a, x) => a + x.amount, 0);
      if (paid) {
        order.refunded = paid;
        order.timeline.push({ at: addMinutes(at, 2), kind: "refunded" });
      }
      if (p.pro && p.start) {
        const list = busy.get(p.pro.id) ?? [];
        busy.set(
          p.pro.id,
          list.filter(([a]) => a !== epochMin(p.start!)),
        );
      }
    }
    if (p.status === "no_show" && p.start) {
      order.timeline.push({ at: addMinutes(p.start, unitOf(p.unitId).lateToleranceMin), kind: "no_show" });
    }
    order.timeline.sort((a, b) => a.at.localeCompare(b.at));
    db.orders.push(order);
    return order;
  }

  const prosOf = (unitId: string) =>
    db.users.filter((u) => u.roles.includes("professional") && u.unitId === unitId && u.status === "active");
  const servicesOf = (pro: User) =>
    db.services.filter((s) => s.status === "active" && s.units.some((l) => l.professionalIds.includes(pro.id)));
  const nowMin = epochMin(now);
  const cur = toMinutes(timePart(now));
  const round5 = (m: number) => Math.floor(m / 5) * 5;

  // ---------------------------------------------------------------- scripted
  const liveScripted = new Set<string>();

  // Mariana: next appointment with Juliana at 10:00 (blowout + serum)
  const juliana = user("p-juliana");
  for (let d = 1; d < 10; d++) {
    const date = addDays(today, d);
    const h = proHoursOn(juliana, unitOf("u-salao"), date);
    if (h && toMinutes(h.start) <= 600 && toMinutes(h.end) >= 660) {
      addOrder({
        unitId: "u-salao",
        pro: juliana,
        client: mariana,
        start: join(date, "10:00"),
        services: [svc("s-escova")],
        products: [prod("pr-serum")],
        status: "paid",
        method: "pix",
        createdAt: join(addDays(today, -1), "21:10"),
      });
      break;
    }
  }
  const camila = user("p-camila");
  for (let d = 8; d < 16; d++) {
    const date = addDays(today, d);
    const h = proHoursOn(camila, unitOf("u-salao"), date);
    if (h && toMinutes(h.start) <= 540) {
      addOrder({
        unitId: "u-salao",
        pro: camila,
        client: mariana,
        start: join(date, "09:00"),
        services: [svc("s-manipedi")],
        status: "awaiting_payment",
        method: "cash",
        createdAt: join(today, "08:40"),
      });
      break;
    }
  }
  // Mariana: last visit, not reviewed yet
  for (let d = 2; d < 9; d++) {
    const date = addDays(today, -d);
    const h = proHoursOn(juliana, unitOf("u-salao"), date);
    if (h && toMinutes(h.start) <= 600) {
      const start = join(date, "10:00");
      addOrder({
        unitId: "u-salao",
        pro: juliana,
        client: mariana,
        start,
        services: [svc("s-escova")],
        status: "completed",
        method: "pix",
        createdAt: addMinutes(start, -2880),
        startedAt: addMinutes(start, 3),
        completedAt: addMinutes(start, 52),
      });
      break;
    }
  }

  // Live scenes for today (only when the unit is open right now)
  const liveCast: Record<string, { late: string; extra: string; walkin: string; svcLate: string; svcLive: string; prod: string }> = {
    "u-barbearia": { late: "Thiago Mendes", extra: "Lucas Prado", walkin: "Felipe Duarte", svcLate: "s-corte", svcLive: "s-combo", prod: "pr-pomada" },
    "u-salao": { late: "Aline Duarte", extra: "Renata Gomes", walkin: "Cláudia Melo", svcLate: "s-escova", svcLive: "s-escova", prod: "pr-oleo" },
  };
  for (const unit of db.units) {
    const h = unitHoursOn(unit, today);
    if (!h) continue;
    const open = toMinutes(h.start);
    const close = toMinutes(h.end);
    const inBreak = h.breakStart && h.breakEnd && cur >= toMinutes(h.breakStart) - 30 && cur < toMinutes(h.breakEnd) + 30;
    if (cur < open + 60 || cur > close - 45 || inBreak) continue;
    const cast = liveCast[unit.id];
    const working = prosOf(unit.id).filter((p) => proHoursOn(p, unit, today));
    const clientByName = (n: string) => db.users.find((u) => `${u.firstName} ${u.lastName}` === n)!;
    const [p0, p1, p2] = working;
    if (p0) {
      // in the chair with an extra product → balance at the counter
      const start = join(today, fromMinutes(round5(cur - 20)));
      addOrder({
        unitId: unit.id,
        pro: p0,
        client: clientByName(cast.extra),
        start,
        services: [svc(cast.svcLive)],
        extras: [prod(cast.prod)],
        status: "in_service",
        method: "pix",
        createdAt: addMinutes(start, -1500),
        startedAt: addMinutes(start, 2),
        settled: false,
      });
      // finished earlier today, paid in cash, still open at the counter
      const early = join(today, fromMinutes(round5(cur - 120)));
      if (toMinutes(timePart(early)) >= open)
        addOrder({
          unitId: unit.id,
          pro: p0,
          client: null,
          walkinName: cast.walkin,
          start: early,
          services: [servicesOf(p0).sort((a, b) => a.durationMin - b.durationMin)[0]],
          status: "completed",
          method: "cash",
          createdAt: addMinutes(early, -2),
          startedAt: early,
          completedAt: addMinutes(early, 30),
          settled: false,
        });
      liveScripted.add(p0.id);
    }
    if (p1) {
      // late client: booked 25 minutes ago and did not arrive
      const start = join(today, fromMinutes(round5(cur - 25)));
      if (servicesOf(p1).some((s) => s.id === cast.svcLate))
        addOrder({
          unitId: unit.id,
          pro: p1,
          client: clientByName(cast.late),
          start,
          services: [svc(cast.svcLate)],
          status: "paid",
          method: "credit",
          createdAt: addMinutes(start, -3000),
        });
      liveScripted.add(p1.id);
    }
    if (p2) {
      const start = join(today, fromMinutes(round5(cur - 10)));
      const s = servicesOf(p2).sort((a, b) => b.durationMin - a.durationMin)[0];
      addOrder({
        unitId: unit.id,
        pro: p2,
        client: pick(rng, unit.id === "u-salao" ? salonClients.slice(4) : barberClients.slice(4)),
        start,
        services: [s],
        status: "in_service",
        method: "pix",
        createdAt: addMinutes(start, -2000),
        startedAt: addMinutes(start, 1),
      });
      liveScripted.add(p2.id);
    }
  }

  // Products to pick up at the counter
  addOrder({
    unitId: "u-salao",
    pro: null,
    client: salonClients[5],
    start: null,
    services: [],
    products: [prod("pr-serum")],
    status: "paid",
    method: "pix",
    createdAt: addMinutes(now, -130),
  });
  for (let i = 0; i < 5; i++) {
    const at = join(addDays(today, -Math.floor(rng() * 30 + 1)), "15:00");
    const c = pick(rng, salonClients);
    const o = addOrder({
      unitId: rng() < 0.6 ? "u-salao" : "u-barbearia",
      pro: null,
      client: c,
      start: null,
      services: [],
      products: [pick(rng, db.products.filter((p) => p.available))],
      status: "completed",
      method: "pix",
      createdAt: at,
      completedAt: addMinutes(at, 1440),
      delivered: true,
    });
    o.timeline.push({ at: addMinutes(at, 1440), kind: "delivered", by: desks[o.unitId] });
  }

  // ---------------------------------------------------------------- generator
  const methodPick = (): PaymentMethod => {
    const r = rng();
    if (r < 0.46) return "pix";
    if (r < 0.74) return "credit";
    if (r < 0.91) return "cash";
    return "debit";
  };

  for (let d = -30; d <= 12; d++) {
    const date = addDays(today, d);
    for (const unit of db.units) {
      const pool = unit.id === "u-salao" ? salonClients : barberClients;
      for (const pro of prosOf(unit.id)) {
        const h = proHoursOn(pro, unit, date);
        if (!h) continue;
        const services = servicesOf(pro).filter((s) => s.units.some((l) => l.unitId === unit.id));
        if (!services.length) continue;
        const occ = d < 0 ? 0.5 : d === 0 ? 0.68 : Math.max(0.12, 0.55 - d * 0.045);
        let t = toMinutes(h.start);
        const end = toMinutes(h.end);
        const bS = h.breakStart ? toMinutes(h.breakStart) : null;
        const bE = h.breakEnd ? toMinutes(h.breakEnd) : null;
        while (t + 15 <= end) {
          if (bS != null && bE != null && t >= bS && t < bE) {
            t = bE;
            continue;
          }
          if (rng() > occ) {
            t += 30;
            continue;
          }
          const s = pick(rng, services);
          const dur = s.durationMin;
          if (t + dur > end || (bS != null && bE != null && t < bE && t + dur > bS)) {
            t += 30;
            continue;
          }
          const startAbs = epochMin(join(date, fromMinutes(t)));
          if (!isFree(pro.id, startAbs, startAbs + dur)) {
            t += 10;
            continue;
          }
          const start = join(date, fromMinutes(t));
          const endAbs = startAbs + dur;
          let status: OrderStatus;
          const method = methodPick();
          if (endAbs <= nowMin) {
            const r = rng();
            status = r < 0.92 ? "completed" : r < 0.98 ? "cancelled" : "no_show";
          } else if (startAbs <= nowMin) {
            if (liveScripted.has(pro.id)) {
              t += dur;
              continue;
            }
            status = "in_service";
          } else {
            status = method === "cash" ? "awaiting_payment" : "paid";
          }
          const walkin = d <= 0 && status === "completed" && rng() < 0.08;
          const client = walkin ? null : d < 0 && rng() < 0.05 && unit.id === "u-salao" ? mariana : pick(rng, pool.slice(1));
          const extras = status === "completed" && rng() < 0.16 ? [pick(rng, db.products.filter((p) => p.available && p.units.some((u) => u.unitId === unit.id)))] : [];
          const lead = Math.floor(rng() * 6 * 1440 + 90);
          const createdAt = walkin ? addMinutes(start, -5) : addMinutes(start, -lead);
          if (epochMin(createdAt) > nowMin) {
            t += 30;
            continue;
          }
          addOrder({
            unitId: unit.id,
            pro,
            client,
            walkinName: walkin ? pick(rng, unit.id === "u-salao" ? femaleClients : maleClients) : undefined,
            start,
            services: [s],
            extras,
            status: walkin ? "completed" : status,
            method: walkin ? pick(rng, counterMethods) : method,
            createdAt,
            startedAt: status === "completed" || status === "in_service" ? addMinutes(start, Math.floor(rng() * 6)) : null,
            completedAt: status === "completed" ? addMinutes(start, dur + Math.floor(rng() * 8) - 3) : null,
            doneCount: 0,
            any: rng() < 0.3,
          });
          t += dur + pick(rng, [0, 0, 10, 20]);
        }
      }
    }
  }

  // Carts left open
  for (let i = 0; i < 5; i++) {
    const unitId = i % 2 === 0 ? "u-salao" : "u-barbearia";
    const pool = unitId === "u-salao" ? salonClients.slice(6) : barberClients.slice(6);
    const services = db.services.filter((s) => s.status === "active" && s.units.some((l) => l.unitId === unitId));
    addOrder({
      unitId,
      pro: null,
      client: pool[i % pool.length],
      start: null,
      services: [pick(rng, services)],
      status: "cart",
      method: "pix",
      createdAt: addMinutes(now, -Math.floor(rng() * 4000 + 30)),
    });
  }

  db.orders.sort((a, b) => (a.start ?? a.createdAt).localeCompare(b.start ?? b.createdAt));
  db.orders.forEach((o, i) => (o.id = `o-${String(i + 1).padStart(4, "0")}`));
  db.counters.order = db.orders.length;

  // ---------------------------------------------------------------- reviews
  const reviews: Review[] = [];
  const lastMariana = db.orders
    .filter((o) => o.clientId === mariana.id && o.status === "completed")
    .sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""))[0];
  for (const o of db.orders) {
    if (o.status !== "completed" || !o.clientId || !o.start || o === lastMariana) continue;
    if (rng() > 0.4) continue;
    const r = rng();
    const serviceRating = r < 0.76 ? 5 : r < 0.93 ? 4 : r < 0.97 ? 3 : 2;
    const proRating = serviceRating === 5 ? (rng() < 0.92 ? 5 : 4) : Math.min(5, serviceRating + (rng() < 0.5 ? 1 : 0));
    const withText = rng() < 0.7;
    let text: LText = "";
    if (withText) {
      if (serviceRating === 5) text = pick(rng, o.unitId === "u-salao" ? reviewTexts.salon5 : reviewTexts.barber5);
      else if (serviceRating >= 4) text = pick(rng, reviewTexts.mid);
      else text = pick(rng, reviewTexts.low);
    }
    const svcItem = o.items.find((i) => i.kind === "service");
    const at = addMinutes(o.completedAt ?? o.start, Math.floor(rng() * 600 + 30));
    if (epochMin(at) > nowMin) continue;
    reviews.push({
      id: `rv-${reviews.length + 1}`,
      orderId: o.id,
      unitId: o.unitId,
      clientId: o.clientId,
      clientName: o.clientName,
      serviceId: svcItem?.refId ?? null,
      productId: null,
      professionalId: o.professionalId,
      serviceRating,
      proRating,
      productRating: null,
      text,
      at,
      reply: null,
      onHome: serviceRating === 5 && proRating === 5 && withText,
    });
    o.reviewed = true;
  }
  // a couple of replies from the house
  reviews
    .filter((r) => r.onHome)
    .slice(-6)
    .forEach((r, i) => {
      if (i % 2 === 0)
        r.reply = {
          text: L(`Valeu, ${r.clientName.split(" ")[0]}! Até a próxima.`, `Thanks, ${r.clientName.split(" ")[0]}! See you next time.`),
          by: "a-ana",
          at: addMinutes(r.at, 90),
        };
    });
  db.reviews = reviews.sort((a, b) => b.at.localeCompare(a.at));

  // ---------------------------------------------------------------- conversations
  db.conversations = buildConversations(db, now, rng, mariana);

  // ---------------------------------------------------------------- notices
  const notices: Notice[] = [];
  for (const pro of db.users.filter((u) => u.roles.includes("professional"))) {
    const mine = db.orders.filter((o) => o.professionalId === pro.id);
    mine
      .filter((o) => o.status === "paid" && o.start && epochMin(o.start) > nowMin)
      .slice(0, 3)
      .forEach((o) => {
        const paid = o.timeline.find((e) => e.kind === "paid");
        if (!paid) return;
        notices.push({
          id: `nt-${notices.length + 1}`,
          userId: pro.id,
          kind: "order_paid",
          title: L(`Pedido ${o.code} pago`, `Order ${o.code} paid`),
          body: L(
            `${o.clientName} · ${o.start!.slice(8, 10)}/${o.start!.slice(5, 7)} ${o.start!.slice(11)}`,
            `${o.clientName} · ${o.start!.slice(5, 7)}/${o.start!.slice(8, 10)} ${o.start!.slice(11)}`,
          ),
          at: paid.at,
          read: false,
          orderId: o.id,
        });
      });
    db.reviews
      .filter((r) => r.professionalId === pro.id && r.proRating === 5)
      .slice(0, 2)
      .forEach((r) =>
        notices.push({
          id: `nt-${notices.length + 1}`,
          userId: pro.id,
          kind: "review",
          title: L("Você recebeu 5 estrelas", "You got 5 stars"),
          body: L(r.clientName, r.clientName),
          at: r.at,
          read: true,
          orderId: r.orderId,
        }),
      );
    const late = mine.find((o) => o.status === "paid" && o.start && datePart(o.start) === today && epochMin(o.start) < nowMin);
    if (late)
      notices.push({
        id: `nt-${notices.length + 1}`,
        userId: pro.id,
        kind: "late",
        title: L(`${late.clientName} está atrasado`, `${late.clientName} is running late`),
        body: L("A IA já avisou o cliente sobre o encaixe.", "The assistant already told the client about the new slot."),
        at: addMinutes(late.start!, 6),
        read: false,
        orderId: late.id,
      });
  }
  db.notices = notices;

  db.settings.notifications.log = [
    { id: "lg-1", ok: true, channel: "whatsapp", label: L("Lembrete 2 h", "2 h reminder"), to: "Lucas Prado", at: addMinutes(now, -49) },
    { id: "lg-2", ok: true, channel: "email", label: L("Novo pedido pago", "New paid order"), to: "juliana@…", at: addMinutes(now, -62) },
    {
      id: "lg-3",
      ok: false,
      channel: "email",
      label: L("Comprovante", "Receipt"),
      to: "ana.r@…",
      at: addMinutes(now, -185),
      error: L("caixa cheia", "mailbox full"),
    },
  ];

  return db;
}

function buildConversations(db: DB, now: DateTimeStr, rng: Rng, mariana: User): Conversation[] {
  const convs: Conversation[] = [];
  const at = (min: number) => addMinutes(now, -min);
  const nameOf = (u: User) => `${u.firstName} ${u.lastName}`;
  const find = (name: string) => db.users.find((u) => nameOf(u) === name)!;
  let n = 0;
  const msg = (who: "client" | "ai" | "staff" | "system", minAgo: number, text: LText, extra: Partial<{ by: string; tag: LText }> = {}) => ({
    id: `m-${++n}`,
    who,
    at: at(minAgo),
    text,
    by: extra.by ?? null,
    tag: extra.tag ?? null,
  });

  const mOrder = db.orders.find((o) => o.clientId === mariana.id && o.status === "paid");
  const mWhen = mOrder?.start ?? now;
  const code = mOrder?.code ?? "BV-0A0A0";
  const hhmm = mWhen.slice(11, 16);
  convs.push({
    id: "cv-mariana",
    unitId: "u-salao",
    clientId: mariana.id,
    name: nameOf(mariana),
    phone: mariana.phone,
    status: "forwarded",
    reason: L("Pediu atendimento humano", "Asked for a person"),
    reasonDetail: L("A cliente quer falar com uma pessoa sobre a troca de pagamento.", "The client wants to talk to a person about changing the payment method."),
    forwardedAt: at(18),
    updatedAt: at(18),
    messages: [
      msg("ai", 300, L(`Oi, Mariana! Seu horário é ${mWhen.slice(8, 10)}/${mWhen.slice(5, 7)} às ${hhmm}: Escova com a Juliana, no Salão. Código do pedido: ${code}.`, `Hi Mariana! Your time is ${mWhen.slice(5, 7)}/${mWhen.slice(8, 10)} at ${hhmm}: Blowout with Juliana, at the Salon. Order code: ${code}.`), {
        tag: L("LEMBRETE", "REMINDER"),
      }),
      msg("client", 37, L("Consigo incluir manicure?", "Can I add a manicure?")),
      msg("ai", 37, L("Consegue sim! Para Manicure & pedicure tenho a Camila às 11h ou às 11h40. Qual prefere?", "Yes! For Manicure & pedicure I have Camila at 11:00 or 11:40. Which one works?")),
      msg("client", 19, L("Queria trocar o pagamento de Pix pra cartão. Prefiro falar com uma pessoa.", "I'd like to switch the payment from Pix to card. I'd rather talk to a person.")),
      msg("ai", 18, L("Claro! Já chamei a recepção do Salão. Em instantes uma pessoa te responde por aqui.", "Sure! I've called the Salon front desk. A person will reply here shortly.")),
      msg("system", 18, L("Encaminhada · a cliente pediu atendimento humano · IA pausada nesta conversa", "Forwarded · the client asked for a person · assistant paused in this chat")),
    ],
  });

  const fwd = (
    id: string,
    unitId: string,
    name: string,
    minAgo: number,
    reason: LText,
    detail: LText,
    q: LText,
    a: LText,
    status: "forwarded" | "human" = "forwarded",
  ) => {
    const u = find(name);
    const c: Conversation = {
      id,
      unitId,
      clientId: u.id,
      name,
      phone: u.phone,
      status,
      reason,
      reasonDetail: detail,
      forwardedAt: at(minAgo),
      updatedAt: at(minAgo),
      messages: [
        msg("client", minAgo + 1, q),
        msg("ai", minAgo, a),
        msg("system", minAgo, L("Encaminhada · IA pausada nesta conversa", "Forwarded · assistant paused in this chat")),
      ],
    };
    convs.push(c);
    return c;
  };
  fwd(
    "cv-gabriela",
    "u-salao",
    "Gabriela Sá",
    3,
    L("A IA não soube responder", "The assistant couldn't answer"),
    L("Dúvida sobre composição do produto e alergia. A IA não responde questões de saúde.", "Question about product ingredients and allergies. The assistant doesn't answer health questions."),
    L("Tenho alergia a formol. A progressiva de vocês tem formol?", "I'm allergic to formaldehyde. Does your keratin treatment contain it?"),
    L("Essa é uma dúvida de saúde e não quero te passar uma informação errada. Chamei a equipe do Salão para te responder com segurança.", "That's a health question and I don't want to give you wrong information. I've called the Salon team to answer you safely."),
  );
  fwd(
    "cv-rodrigo",
    "u-barbearia",
    "Rodrigo Alves",
    10,
    L("A IA não soube responder", "The assistant couldn't answer"),
    L("Serviço que não está no catálogo da Barbearia.", "A service that isn't in the Barbershop catalog."),
    L("Vocês fazem pigmentação de barba com henna?", "Do you do beard coloring with henna?"),
    L("Não encontrei pigmentação com henna no catálogo da Barbearia. Vou chamar alguém da equipe para confirmar com você.", "I couldn't find henna beard coloring in the Barbershop catalog. I'll ask someone on the team to confirm with you."),
  );
  fwd(
    "cv-bruno",
    "u-barbearia",
    "Bruno Farias",
    27,
    L("Pediu atendimento humano", "Asked for a person"),
    L("Quer nota fiscal no CNPJ da empresa.", "Wants an invoice issued to his company."),
    L("Preciso da nota no CNPJ da minha empresa, consegue?", "I need the invoice issued to my company, can you do that?"),
    L("Nota fiscal fica com a recepção. Já chamei alguém da Barbearia para te ajudar.", "Invoices are handled by the front desk. I've called someone from the Barbershop to help you."),
  );
  const pat = fwd(
    "cv-patricia",
    "u-salao",
    "Patrícia Nunes",
    40,
    L("Pediu atendimento humano", "Asked for a person"),
    L("Quer remarcar para outro dia com a mesma profissional.", "Wants to reschedule to another day with the same professional."),
    L("Posso falar com alguém para remarcar?", "Can I talk to someone to reschedule?"),
    L("Claro! Chamei a recepção do Salão.", "Sure! I've called the Salon front desk."),
    "human",
  );
  pat.messages.push(
    msg("staff", 32, L("Oi, Patrícia! Aqui é a Bianca. Qual dia fica melhor para você?", "Hi Patrícia! This is Bianca. Which day works better for you?"), { by: "d-bianca" }),
    msg("client", 30, L("Sábado de manhã, se tiver.", "Saturday morning, if possible.")),
  );
  pat.updatedAt = at(30);

  // conversations the assistant handled on its own
  const aiTopics: [LText, LText][] = [
    [L("Qual o horário de vocês no sábado?", "What are your Saturday hours?"), L("No sábado abrimos das 8h às 18h, sem intervalo.", "On Saturdays we're open from 8:00 to 18:00, no break.")],
    [L("Quanto custa a hidratação?", "How much is deep conditioning?"), L("A Hidratação custa R$ 40 e leva 30 min. Quer que eu veja um horário?", "Deep conditioning is $40 and takes 30 min. Want me to find a time?")],
    [L("Meu pedido está confirmado?", "Is my order confirmed?"), L("Está sim! Pago e confirmado. Chegue 10 minutos antes com o código.", "Yes! Paid and confirmed. Arrive 10 minutes early with your code.")],
    [L("Tem horário hoje à tarde?", "Any time this afternoon?"), L("Tenho às 15h20, 16h ou 17h20. É só escolher pelo link.", "I have 15:20, 16:00 or 17:20. Just pick one through the link.")],
    [L("Onde fica a unidade?", "Where is the location?"), L("Estamos no endereço da unidade. Mando a localização por aqui.", "We're at the unit's address. I'll send the location here.")],
  ];
  const clients = db.users.filter((u) => u.roles.includes("client") && u.id !== mariana.id);
  for (let i = 0; i < 26; i++) {
    const u = clients[i % clients.length];
    const unitId = u.preferredUnitId ?? "u-salao";
    const [q, a] = pick(rng, aiTopics);
    const minAgo = Math.floor(rng() * 9000 + 5);
    const handedOff = i % 9 === 4;
    convs.push({
      id: `cv-${i + 10}`,
      unitId,
      clientId: u.id,
      name: nameOf(u),
      phone: u.phone,
      status: i < 4 ? "ai" : "closed",
      reason: handedOff ? L("Pediu atendimento humano", "Asked for a person") : null,
      reasonDetail: null,
      forwardedAt: handedOff ? at(minAgo) : null,
      updatedAt: at(minAgo),
      messages: [msg("client", minAgo + 1, q), msg("ai", minAgo, a)],
    });
  }
  return convs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
