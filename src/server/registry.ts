import { ZodError } from "zod";
import type { DB, RequestCtx } from "@/lib/domain/types";
import * as admin from "./actions/admin";
import * as catalog from "./actions/catalog";
import * as chat from "./actions/chat";
import * as orders from "./actions/orders";
import { DomainError, type ActionFn, type QueryFn } from "./core";
import * as client from "./queries/client";
import * as operations from "./queries/operations";
import * as pro from "./queries/pro";
import * as reports from "./queries/reports";

export const actions: Record<string, ActionFn> = {
  // client
  "cart.add": orders.cartAdd,
  "cart.remove": orders.cartRemove,
  "checkout.reserve": orders.checkoutReserve,
  "checkout.pay": orders.checkoutPay,
  "order.cancel": orders.orderCancel,
  "order.review": orders.orderReview,
  "client.signIn": admin.clientSignIn,
  "client.updateProfile": admin.clientUpdateProfile,
  "client.toggleFavorite": admin.clientToggleFavorite,
  "chat.clientSend": chat.chatClientSend,
  // professional
  "pro.checkIn": orders.proCheckIn,
  "pro.addItems": orders.proAddItems,
  "pro.markDone": orders.proMarkDone,
  "pro.complete": orders.proComplete,
  "pro.createWalkin": orders.proCreateWalkin,
  "pro.readNotices": orders.proReadNotices,
  // front desk / operations
  "desk.settle": orders.deskSettle,
  "desk.deliver": orders.deskDeliver,
  "desk.createWalkin": orders.deskCreateWalkin,
  "order.noShow": orders.orderNoShow,
  "order.refund": orders.orderRefund,
  "order.resendReceipt": orders.orderResendReceipt,
  "order.reschedule": orders.orderReschedule,
  "chat.takeOver": chat.chatTakeOver,
  "chat.send": chat.chatSend,
  "chat.finish": chat.chatFinish,
  "review.reply": catalog.reviewReply,
  "review.toggleHome": catalog.reviewToggleHome,
  // catalog
  "service.save": catalog.serviceSave,
  "service.setStatus": catalog.serviceSetStatus,
  "product.save": catalog.productSave,
  "product.toggle": catalog.productToggle,
  "category.save": catalog.categorySave,
  "category.move": catalog.categoryMove,
  "category.delete": catalog.categoryDelete,
  "offer.save": catalog.offerSave,
  "offer.end": catalog.offerEnd,
  // business
  "unit.save": admin.unitSave,
  "unit.catalogToggle": admin.unitCatalogToggle,
  "unit.whatsapp": admin.unitWhatsapp,
  "ai.save": admin.aiSave,
  "user.invite": admin.userInvite,
  "user.update": admin.userUpdate,
  "user.setStatus": admin.userSetStatus,
  "user.transfer": admin.userTransfer,
  "team.saveSchedule": admin.teamSaveSchedule,
  "team.addPeriod": admin.teamAddPeriod,
  "team.removePeriod": admin.teamRemovePeriod,
  "settings.save": admin.settingsSave,
  "notify.test": admin.notifyTest,
  "policy.save": admin.policySave,
};

export const queries: Record<string, QueryFn> = {
  dashboard: reports.dashboard,
  sales: reports.sales,
  commissions: reports.commissions,
  unitsOverview: reports.unitsOverview,
  reviewsSummary: reports.reviewsSummary,
  counter: operations.counter,
  agenda: operations.agenda,
  ordersList: operations.ordersList,
  orderDetail: operations.orderDetail,
  unitCatalog: client.unitCatalog,
  serviceDetail: client.serviceDetail,
  productDetail: client.productDetail,
  professionalDetail: client.professionalDetail,
  availabilityMonth: client.availabilityMonth,
  availabilityDay: client.availabilityDay,
  availabilityPros: client.availabilityPros,
  clientOrders: client.clientOrders,
  clientOrder: client.clientOrder,
  clientCart: client.clientCart,
  clientProfile: client.clientProfile,
  clientConversation: client.clientConversation,
  proDay: pro.proDay,
  proOrder: pro.proOrder,
  proCodeLookup: pro.proCodeLookup,
  proEarnings: pro.proEarnings,
  proReviews: pro.proReviews,
  proNotices: pro.proNotices,
  proCatalog: pro.proCatalog,
};

export interface ApiBody {
  db: DB;
  input: unknown;
  ctx: RequestCtx;
}

export function errorResponse(err: unknown) {
  if (err instanceof DomainError) {
    return Response.json({ error: { code: err.code, params: err.params } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return Response.json({ error: { code: "invalid_input", params: { detail: err.issues[0]?.path.join(".") ?? "" } } }, { status: 422 });
  }
  console.error(err);
  return Response.json({ error: { code: "unexpected", params: {} } }, { status: 500 });
}

export function parseBody(body: unknown): ApiBody {
  const b = body as Partial<ApiBody>;
  if (!b || typeof b !== "object" || !b.db || !Array.isArray(b.db.orders) || !b.ctx?.now) {
    throw new DomainError("invalid_input", { detail: "db" }, 422);
  }
  return { db: b.db, input: b.input ?? {}, ctx: { now: b.ctx.now, locale: b.ctx.locale === "en" ? "en" : "pt", actorId: b.ctx.actorId ?? null } };
}
