import { cronJobs, makeFunctionReference, type FunctionReference } from "convex/server";

const cleanupExpired = makeFunctionReference<"mutation", Record<string, never>>(
  "authStore:cleanupExpired",
) as unknown as FunctionReference<"mutation", "internal", Record<string, never>>;

const crons = cronJobs();
crons.interval("clean expired authentication records", { hours: 6 }, cleanupExpired, {});

export default crons;
