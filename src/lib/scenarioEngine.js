import { scenarios } from "../data.js";

export function getScenario(categoryId, roundIndex = 0) {
  const deck = scenarios[categoryId] ?? scenarios.social;
  if (Array.isArray(deck)) return deck[Math.abs(roundIndex) % deck.length];
  return deck;
}

export function getScenarioCount(categoryId) {
  const deck = scenarios[categoryId] ?? scenarios.social;
  return Array.isArray(deck) ? deck.length : 1;
}

export function randomScenarioRound(categoryId, previousRound = -1, random = Math.random) {
  const count = getScenarioCount(categoryId);
  if (count <= 1) return 0;

  const previousIndex = Math.abs(previousRound) % count;
  let nextIndex = Math.floor(random() * count);
  if (nextIndex === previousIndex) nextIndex = (nextIndex + 1) % count;
  return nextIndex;
}
