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
import type * as http from "../http.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_errors from "../lib/errors.js";
import type * as migrations from "../migrations.js";
import type * as onboarding from "../onboarding.js";
import type * as organizationValidators from "../organizationValidators.js";
import type * as organizations from "../organizations.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authJwks: typeof authJwks;
  authStore: typeof authStore;
  businessValidators: typeof businessValidators;
  crons: typeof crons;
  http: typeof http;
  "lib/authorization": typeof lib_authorization;
  "lib/errors": typeof lib_errors;
  migrations: typeof migrations;
  onboarding: typeof onboarding;
  organizationValidators: typeof organizationValidators;
  organizations: typeof organizations;
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
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
