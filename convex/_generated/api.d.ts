/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as adminHelpers from "../adminHelpers.js";
import type * as assignments from "../assignments.js";
import type * as auth from "../auth.js";
import type * as authCallbacks from "../authCallbacks.js";
import type * as availability from "../availability.js";
import type * as cleanup from "../cleanup.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as initialSetup from "../initialSetup.js";
import type * as manualSuperAdminFix from "../manualSuperAdminFix.js";
import type * as organizationSettings from "../organizationSettings.js";
import type * as people from "../people.js";
import type * as roleConfigurations from "../roleConfigurations.js";
import type * as roleLinking from "../roleLinking.js";
import type * as roles from "../roles.js";
import type * as router from "../router.js";
import type * as shifts from "../shifts.js";
import type * as shows from "../shows.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  adminHelpers: typeof adminHelpers;
  assignments: typeof assignments;
  auth: typeof auth;
  authCallbacks: typeof authCallbacks;
  availability: typeof availability;
  cleanup: typeof cleanup;
  groups: typeof groups;
  http: typeof http;
  initialSetup: typeof initialSetup;
  manualSuperAdminFix: typeof manualSuperAdminFix;
  organizationSettings: typeof organizationSettings;
  people: typeof people;
  roleConfigurations: typeof roleConfigurations;
  roleLinking: typeof roleLinking;
  roles: typeof roles;
  router: typeof router;
  shifts: typeof shifts;
  shows: typeof shows;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
