export const DAILY_RANKED_BATTLES = 5;

export function resolveDailyBattlesLeft({ storedDate, storedBattlesLeft, today }) {
  if (storedDate === today && Number.isFinite(storedBattlesLeft)) {
    return storedBattlesLeft;
  }

  return DAILY_RANKED_BATTLES;
}
