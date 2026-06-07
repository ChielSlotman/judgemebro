import {
  DAILY_RANKED_BATTLES,
  canStartRatedBattle,
  resolveDailyBattlesLeft,
  resolveStreakAfterBattle,
} from "../src/lib/dailyAllowance.js";

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

assert(canStartRatedBattle("ranked", 1), "Expected ranked battle to start with allowance");
assert(!canStartRatedBattle("ranked", 0), "Expected ranked battle to stop at zero allowance");
assert(!canStartRatedBattle("friend", 0), "Expected friend battle to stop at zero allowance");
assert(canStartRatedBattle("bot", 0), "Expected bot battle to ignore ranked allowance");
assert(canStartRatedBattle("streamer", 0), "Expected streamer battle to ignore ranked allowance");

assert(
  resolveStreakAfterBattle({ currentStreak: 3, lastPlayedDate: "", today: "2026-06-07" }) === 3,
  "Expected first tracked play to preserve current display streak",
);
assert(
  resolveStreakAfterBattle({ currentStreak: 3, lastPlayedDate: "2026-06-07", today: "2026-06-07" }) === 3,
  "Expected same-day replay to preserve streak",
);
assert(
  resolveStreakAfterBattle({ currentStreak: 3, lastPlayedDate: "2026-06-06", today: "2026-06-07" }) === 4,
  "Expected next-day play to increment streak",
);
assert(
  resolveStreakAfterBattle({ currentStreak: 3, lastPlayedDate: "2026-06-04", today: "2026-06-07" }) === 1,
  "Expected missed days to reset streak",
);

console.log("Daily allowance check passed");
