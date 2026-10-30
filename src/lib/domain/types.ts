/**
 * Domain model shared by the browser store and the Next.js back-end.
 *
 * The whole database lives in the browser (localStorage). Every mutation and
 * every computed report goes through a Route Handler that receives the current
 * database, applies the business rules and returns the new state.
 *
 * Dates and times are naive local strings ("2026-10-29" / "2026-10-29T14:20"),
 * always interpreted in the unit's local time. The browser sends its own
 * "now" on every request, so the server never depends on its timezone.
 */

export type ID = string;
export type Locale = "pt" | "en";
/** Seeded content carries both languages; content typed by the user is a plain string. */
export type LText = string | { pt: string; en: string };
/** Money is always stored in cents. */
export type Cents = number;
export type DateStr = string; // YYYY-MM-DD
export type DateTimeStr = string; // YYYY-MM-DDTHH:mm
export type TimeStr = string; // HH:mm

export type Role = "admin" | "desk" | "professional" | "client";
export type Audience = "female" | "male" | "unisex";
export type Currency = "auto" | "BRL" | "USD" | "EUR";

export interface DayHours {
  open: boolean;
  start: TimeStr;
  end: TimeStr;
  breakStart?: TimeStr | null;
  breakEnd?: TimeStr | null;
}

/** Index 0 = Sunday … 6 = Saturday */
export type WeekHours = DayHours[];

export interface Closure {
  id: ID;
  start: DateStr;
  end: DateStr;
  label: LText;
}

export interface UnitAiConfig {
  assistantName: LText;
  answers: { orders: boolean; catalog: boolean; slots: boolean; info: boolean };
  forwardTopics: LText[];
  notifyWho: LText;
  alertAfterMin: number;
  reminder1: LText;
  reminder2: LText;
  lateNotice: boolean;
  afterHours: LText;
  greeting: LText;
}

export interface Unit {
  id: ID;
  slug: string;
  name: LText;
  kind: LText; // "Salão feminino"
  audience: Audience;
  tagline: LText;
  phone: string;
  whatsapp: string;
  instagram: string;
  address: string;
  district: string;
  city: string;
  zip: string;
  coords: string;
  active: boolean;
  chairs: number;
  hours: WeekHours;
  closures: Closure[];
  lateToleranceMin: number;
  holdMinutes: number;
  whatsappConnected: boolean;
  whatsappInstance: string;
  ai: UnitAiConfig;
}

export type CategoryKind = "service" | "product";

export interface Category {
  id: ID;
  kind: CategoryKind;
  name: LText;
  order: number;
  special?: boolean;
}

export interface UnitServiceLink {
  unitId: ID;
  price?: Cents | null; // null → base price
  professionalIds: ID[];
}

export type ServiceStatus = "active" | "draft" | "archived";

export interface Service {
  id: ID;
  name: LText;
  categoryId: ID;
  price: Cents;
  durationMin: number;
  summary: LText;
  description: LText; // markdown
  media: number; // number of photos (placeholders in the demo)
  status: ServiceStatus;
  isNew: boolean;
  allowFavorites: boolean;
  units: UnitServiceLink[];
  /** cached for display; real numbers come from reviews */
  soldCount: number;
}

export interface UnitProductLink {
  unitId: ID;
  price?: Cents | null;
}

export interface Product {
  id: ID;
  name: LText;
  categoryId: ID;
  price: Cents;
  detail: LText;
  badge?: LText | null;
  description: LText;
  media: number;
  available: boolean;
  sellOnline: boolean;
  staffCanAdd: boolean;
  units: UnitProductLink[];
  soldOnline: number;
  soldByStaff: number;
}

export type DiscountType = "percent" | "fixed";

export interface Offer {
  id: ID;
  unitId: ID;
  name: LText;
  type: DiscountType;
  value: number; // percent (0-100) or cents
  usageLimit: number | null;
  uses: number;
  start: DateStr;
  end: DateStr;
  weekdays: number[]; // 0-6
  serviceIds: ID[];
  endedAt?: DateTimeStr | null;
}

export type UserStatus = "active" | "invited" | "disabled";

export interface SchedulePeriod {
  id: ID;
  type: "closed" | "extra";
  start: DateTimeStr;
  end: DateTimeStr;
  label: LText;
}

export interface User {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roles: Role[];
  unitId: ID | null;
  about: LText;
  since: DateStr;
  status: UserStatus;
  commission: { exec: number; product: number } | null;
  /** null → follows the unit hours */
  schedule: WeekHours | null;
  periods: SchedulePeriod[];
  chair?: number;
  favorites: { services: ID[]; products: ID[]; professionals: ID[] };
  preferredUnitId?: ID | null;
  acceptedTermsVersion?: number;
}

export type OrderStatus =
  | "cart"
  | "awaiting_payment"
  | "paid"
  | "in_service"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentMethod =
  | "pix"
  | "credit"
  | "debit"
  | "cash"
  | "store_pix"
  | "pos_debit"
  | "pos_credit";

export type OrderOrigin = "site" | "walkin";

export interface OrderItem {
  id: ID;
  kind: "service" | "product";
  refId: ID;
  name: LText;
  unitPrice: Cents;
  qty: number;
  durationMin: number;
  /** service done mark (pro app) */
  doneAt?: DateTimeStr | null;
  /** extra launched by a professional during the service */
  addedBy?: ID | null;
  delivered?: boolean;
}

export interface Payment {
  id: ID;
  method: PaymentMethod;
  channel: "online" | "counter";
  amount: Cents;
  at: DateTimeStr;
  by?: ID | null; // staff who received
  received?: Cents | null;
  change?: Cents | null;
  stripeId?: string | null;
  fee: Cents;
}

export type TimelineKind =
  | "cart"
  | "created"
  | "paid"
  | "reserved_cash"
  | "reminder"
  | "late"
  | "checkin"
  | "extra"
  | "service_done"
  | "completed"
  | "counter_received"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "no_show"
  | "rescheduled";

export interface TimelineEvent {
  at: DateTimeStr;
  kind: TimelineKind;
  by?: ID | null;
  note?: LText | null;
}

export interface Order {
  id: ID;
  code: string; // BV-7F2K9
  completionCode: string; // OK-7310
  unitId: ID;
  clientId: ID | null;
  clientName: string;
  clientPhone: string;
  origin: OrderOrigin;
  professionalId: ID | null;
  start: DateTimeStr | null; // null → products only (pickup)
  status: OrderStatus;
  items: OrderItem[];
  discount: Cents;
  offerId: ID | null;
  payments: Payment[];
  refunded: Cents;
  timeline: TimelineEvent[];
  createdAt: DateTimeStr;
  startedAt?: DateTimeStr | null;
  completedAt?: DateTimeStr | null;
  pausedMin?: number;
  chosenMethod?: PaymentMethod | null;
  holdUntil?: DateTimeStr | null;
  /** client chose "any professional" */
  anyProfessional?: boolean;
  reviewed?: boolean;
}

export interface Review {
  id: ID;
  orderId: ID;
  unitId: ID;
  clientId: ID | null;
  clientName: string;
  serviceId: ID | null;
  productId: ID | null;
  professionalId: ID | null;
  serviceRating: number;
  proRating: number | null;
  productRating: number | null;
  text: LText;
  at: DateTimeStr;
  reply: { text: LText; by: ID; at: DateTimeStr } | null;
  onHome: boolean;
}

export type ConversationStatus = "ai" | "forwarded" | "human" | "closed";

export interface ChatMessage {
  id: ID;
  who: "client" | "ai" | "staff" | "system";
  text: LText;
  at: DateTimeStr;
  by?: ID | null;
  tag?: LText | null; // e.g. "LEMBRETE · 1 DIA ANTES"
}

export interface Conversation {
  id: ID;
  unitId: ID;
  clientId: ID | null;
  name: string;
  phone: string;
  status: ConversationStatus;
  reason: LText | null;
  reasonDetail: LText | null;
  forwardedAt: DateTimeStr | null;
  messages: ChatMessage[];
  updatedAt: DateTimeStr;
}

export interface Notice {
  id: ID;
  userId: ID;
  kind: "order_paid" | "late" | "review" | "next" | "cancelled" | "info";
  title: LText;
  body: LText;
  at: DateTimeStr;
  read: boolean;
  orderId?: ID | null;
}

export type NotifyEvent =
  | "paid"
  | "reminder"
  | "late"
  | "started"
  | "completed"
  | "cancelled"
  | "refunded"
  | "review"
  | "forwarded"
  | "digest";

export type NotifyChannel = "pro" | "desk" | "admin" | "email" | "whatsapp";

export interface DeliveryLog {
  id: ID;
  ok: boolean;
  channel: "whatsapp" | "email";
  label: LText;
  to: string;
  at: DateTimeStr;
  error?: LText | null;
}

export interface PolicyDoc {
  version: number;
  publishedAt: DateStr;
  published: LText;
  draft: LText;
  acceptances: number;
  editedBy: string;
  editedAt: DateTimeStr;
  history: { version: number; publishedAt: DateStr }[];
}

export interface Settings {
  company: {
    name: string;
    legalName: string;
    taxId: string;
    cityReg: string;
    email: string;
    instagram: string;
    domain: string;
    currency: Currency;
  };
  payment: {
    methods: Record<"pix" | "credit" | "debit" | "cash" | "boleto", boolean>;
    fees: { pixPct: number; creditPct: number; creditFixed: Cents; debitPct: number };
    installments: number;
    minInstallment: Cents;
    cancelFee: Cents;
    autoRefund: boolean;
    adminLateRefund: boolean;
  };
  commissions: {
    defaultExec: number;
    defaultProduct: number;
    exceptions: { id: ID; unitId: ID; categoryId: ID; pct: number; reason: LText }[];
    rules: {
      completed: boolean;
      noShow: boolean;
      lateFit: boolean;
      refunded: boolean;
      productByPro: boolean;
      productOnline: boolean;
    };
  };
  notifications: {
    matrix: Record<NotifyEvent, Partial<Record<NotifyChannel, boolean>>>;
    senderName: string;
    replyTo: string;
    log: DeliveryLog[];
  };
  policies: { terms: PolicyDoc; privacy: PolicyDoc };
}

export interface Session {
  /** staff user acting in the panel / pro app */
  staffId: ID | null;
  /** client signed in on the client site */
  clientId: ID | null;
  /** professional using the pro app */
  proId: ID | null;
}

export interface DB {
  version: number;
  seededAt: DateTimeStr;
  units: Unit[];
  categories: Category[];
  services: Service[];
  products: Product[];
  offers: Offer[];
  users: User[];
  orders: Order[];
  reviews: Review[];
  conversations: Conversation[];
  notices: Notice[];
  settings: Settings;
  counters: { order: number; walkin: number };
}

/** Context every request carries from the browser. */
export interface RequestCtx {
  now: DateTimeStr;
  locale: Locale;
  actorId: ID | null;
}
