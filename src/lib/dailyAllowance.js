export const DAILY_RANKED_BATTLES = 5;

export function resolveDailyBattlesLeft({ storedDate, storedBattlesLeft, today }) {
  if (storedDate === today && Number.isFinite(storedBattlesLeft)) {
    return storedBattlesLeft;
  }

  return DAILY_RANKED_BATTLES;
}

export function canStartRatedBattle(mode, battlesLeft) {
  if (mode === "bot" || mode === "streamer") return true;
  return battlesLeft > 0;
}

function daysBetween(previousDate, today) {
  const previousTime = Date.parse(`${previousDate}T00:00:00.000Z`);
  const todayTime = Date.parse(`${today}T00:00:00.000Z`);
  if (!Number.isFinite(previousTime) || !Number.isFinite(todayTime)) return null;
  return Math.round((todayTime - previousTime) / 86_400_000);
}

export function resolveStreakAfterBattle({ currentStreak, lastPlayedDate, today }) {
  if (!lastPlayedDate) return Math.max(1, currentStreak || 1);

  const dayDelta = daysBetween(lastPlayedDate, today);
  if (dayDelta === 0) return Math.max(1, currentStreak || 1);
  if (dayDelta === 1) return Math.max(1, currentStreak || 1) + 1;
  return 1;
}
