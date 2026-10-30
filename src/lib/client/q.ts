import type * as client from "@/server/queries/client";
import type * as operations from "@/server/queries/operations";
import type * as pro from "@/server/queries/pro";
import type * as reports from "@/server/queries/reports";

/** Result types of the server queries, for typed `useQuery` calls (type-only import). */
type R<F> = F extends (...args: never[]) => infer X ? X : never;
export type Q = {
  dashboard: R<typeof reports.dashboard>;
  sales: R<typeof reports.sales>;
  commissions: R<typeof reports.commissions>;
  unitsOverview: R<typeof reports.unitsOverview>;
  reviewsSummary: R<typeof reports.reviewsSummary>;
  counter: R<typeof operations.counter>;
  agenda: R<typeof operations.agenda>;
  ordersList: R<typeof operations.ordersList>;
  orderDetail: R<typeof operations.orderDetail>;
  unitCatalog: R<typeof client.unitCatalog>;
  serviceDetail: R<typeof client.serviceDetail>;
  productDetail: R<typeof client.productDetail>;
  professionalDetail: R<typeof client.professionalDetail>;
  availabilityMonth: R<typeof client.availabilityMonth>;
  availabilityDay: R<typeof client.availabilityDay>;
  availabilityPros: R<typeof client.availabilityPros>;
  clientOrders: R<typeof client.clientOrders>;
  clientOrder: R<typeof client.clientOrder>;
  clientCart: R<typeof client.clientCart>;
  clientProfile: R<typeof client.clientProfile>;
  clientConversation: R<typeof client.clientConversation>;
  proDay: R<typeof pro.proDay>;
  proOrder: R<typeof pro.proOrder>;
  proCodeLookup: R<typeof pro.proCodeLookup>;
  proEarnings: R<typeof pro.proEarnings>;
  proReviews: R<typeof pro.proReviews>;
  proNotices: R<typeof pro.proNotices>;
  proCatalog: R<typeof pro.proCatalog>;
};
