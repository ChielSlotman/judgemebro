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
