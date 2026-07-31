/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authJwks from "../authJwks.js";
import type * as authStore from "../authStore.js";
import type * as businessValidators from "../businessValidators.js";
import type * as crons from "../crons.js";
import type * as developmentFixtures from "../developmentFixtures.js";
import type * as escrowEvents from "../escrowEvents.js";
import type * as escrowFulfillment from "../escrowFulfillment.js";
import type * as escrowFunding from "../escrowFunding.js";
import type * as escrowReconciliation from "../escrowReconciliation.js";
import type * as exporterDirectory from "../exporterDirectory.js";
import type * as exporterInvitations from "../exporterInvitations.js";
import type * as exporterOrders from "../exporterOrders.js";
import type * as http from "../http.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_orderAssets from "../lib/orderAssets.js";
import type * as lib_orderAuthorization from "../lib/orderAuthorization.js";
import type * as lib_orderCounts from "../lib/orderCounts.js";
import type * as lib_orderTerms from "../lib/orderTerms.js";
import type * as lib_supplierOrderAuthorization from "../lib/supplierOrderAuthorization.js";
import type * as lib_tradeOrderAuthorization from "../lib/tradeOrderAuthorization.js";
import type * as lib_verification from "../lib/verification.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as orderDashboard from "../orderDashboard.js";
import type * as orderDecisions from "../orderDecisions.js";
import type * as orderDetails from "../orderDetails.js";
import type * as orderDrafts from "../orderDrafts.js";
import type * as orderRevisions from "../orderRevisions.js";
import type * as orders from "../orders.js";
import type * as orderTimeline from "../orderTimeline.js";
import type * as orderValidators from "../orderValidators.js";
import type * as organizations from "../organizations.js";
import type * as organizationValidators from "../organizationValidators.js";
import type * as organizationVerification from "../organizationVerification.js";
import type * as refunds from "../refunds.js";
import type * as shipments from "../shipments.js";
import type * as supplierDirectory from "../supplierDirectory.js";
import type * as supplierOrderDeadlines from "../supplierOrderDeadlines.js";
import type * as supplierOrders from "../supplierOrders.js";
import type * as tradeDocuments from "../tradeDocuments.js";
import type * as tradeOrderDecisions from "../tradeOrderDecisions.js";
import type * as tradeOrderRevisions from "../tradeOrderRevisions.js";
import type * as tradeOrders from "../tradeOrders.js";
import type * as validators from "../validators.js";
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authJwks: typeof authJwks;
  authStore: typeof authStore;
  businessValidators: typeof businessValidators;
  crons: typeof crons;
  developmentFixtures: typeof developmentFixtures;
  escrowEvents: typeof escrowEvents;
  escrowFulfillment: typeof escrowFulfillment;
  escrowFunding: typeof escrowFunding;
  escrowReconciliation: typeof escrowReconciliation;
  exporterDirectory: typeof exporterDirectory;
  exporterInvitations: typeof exporterInvitations;
  exporterOrders: typeof exporterOrders;
  http: typeof http;
  "lib/authorization": typeof lib_authorization;
  "lib/errors": typeof lib_errors;
  "lib/orderAssets": typeof lib_orderAssets;
  "lib/orderAuthorization": typeof lib_orderAuthorization;
  "lib/orderCounts": typeof lib_orderCounts;
  "lib/orderTerms": typeof lib_orderTerms;
  "lib/supplierOrderAuthorization": typeof lib_supplierOrderAuthorization;
  "lib/tradeOrderAuthorization": typeof lib_tradeOrderAuthorization;
  "lib/verification": typeof lib_verification;
  migrations: typeof migrations;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  orderDashboard: typeof orderDashboard;
  orderDecisions: typeof orderDecisions;
  orderDetails: typeof orderDetails;
  orderDrafts: typeof orderDrafts;
  orderRevisions: typeof orderRevisions;
  orderTimeline: typeof orderTimeline;
  orderValidators: typeof orderValidators;
  orders: typeof orders;
  organizationValidators: typeof organizationValidators;
  organizationVerification: typeof organizationVerification;
  organizations: typeof organizations;
  refunds: typeof refunds;
  shipments: typeof shipments;
  supplierDirectory: typeof supplierDirectory;
  supplierOrderDeadlines: typeof supplierOrderDeadlines;
  supplierOrders: typeof supplierOrders;
  tradeDocuments: typeof tradeDocuments;
  tradeOrderDecisions: typeof tradeOrderDecisions;
  tradeOrderRevisions: typeof tradeOrderRevisions;
  tradeOrders: typeof tradeOrders;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
