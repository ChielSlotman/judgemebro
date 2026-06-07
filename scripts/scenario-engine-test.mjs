import { getScenario, getScenarioCount, randomScenarioRound } from "../src/lib/scenarioEngine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(getScenarioCount("social") >= 5, "Expected social deck to include multiple prompts");
assert(getScenario("unknown-category").prompt === getScenario("social").prompt, "Expected unknown categories to fall back");

const previousRound = 0;
const repeatedRandom = () => 0;
const nextRound = randomScenarioRound("social", previousRound, repeatedRandom);
assert(nextRound !== previousRound, "Expected random scenario to avoid immediate repeats");
assert(getScenario("social", nextRound).prompt !== getScenario("social", previousRound).prompt, "Expected a new prompt");

const lastIndexRandom = () => 0.999;
const lastRound = randomScenarioRound("social", 2, lastIndexRandom);
assert(lastRound === getScenarioCount("social") - 1, "Expected random picker to use the full deck");

console.log("Scenario engine check passed");
