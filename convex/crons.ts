import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();
// 매일 한국 시간 03:00 (UTC 18:00)
crons.daily(
  "drive backup",
  { hourUTC: 18, minuteUTC: 0 },
  makeFunctionReference<"action", Record<string, never>>("backup:toDrive") as any,
);
export default crons;
