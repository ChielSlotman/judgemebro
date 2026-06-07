import { DAILY_RANKED_BATTLES, resolveDailyBattlesLeft } from "../src/lib/dailyAllowance.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  resolveDailyBattlesLeft({ storedDate: "2026-06-07", storedBattlesLeft: 2, today: "2026-06-07" }) === 2,
  "Expected same-day stored allowance to be preserved",
);

assert(
  resolveDailyBattlesLeft({ storedDate: "2026-06-06", storedBattlesLeft: 0, today: "2026-06-07" }) === DAILY_RANKED_BATTLES,
  "Expected old allowance to reset to the daily default",
);

assert(
  resolveDailyBattlesLeft({ storedDate: "", storedBattlesLeft: Number.NaN, today: "2026-06-07" }) === DAILY_RANKED_BATTLES,
  "Expected missing allowance to use the daily default",
);

console.log("Daily allowance check passed");
