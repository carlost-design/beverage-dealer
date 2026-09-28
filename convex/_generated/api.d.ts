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
import type * as clients from "../clients.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_dayView from "../lib/dayView.js";
import type * as lib_labels from "../lib/labels.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_orders from "../lib/orders.js";
import type * as lib_stock from "../lib/stock.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  clients: typeof clients;
  dashboard: typeof dashboard;
  http: typeof http;
  inventory: typeof inventory;
  "lib/access": typeof lib_access;
  "lib/dates": typeof lib_dates;
  "lib/dayView": typeof lib_dayView;
  "lib/labels": typeof lib_labels;
  "lib/money": typeof lib_money;
  "lib/orders": typeof lib_orders;
  "lib/stock": typeof lib_stock;
  orders: typeof orders;
  payments: typeof payments;
  products: typeof products;
  seed: typeof seed;
  settings: typeof settings;
  users: typeof users;
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

export declare const components: {};
