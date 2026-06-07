import { categories, scenarios } from "../src/data.js";

const MIN_SCENARIOS_PER_CATEGORY = 5;
const MAX_ANSWER_CHARS = 280;
const failures = [];

for (const category of categories) {
  const deck = scenarios[category.id];
  if (!Array.isArray(deck)) {
    failures.push(`${category.name} is missing a scenario deck`);
    continue;
  }

  if (deck.length < MIN_SCENARIOS_PER_CATEGORY) {
    failures.push(`${category.name} needs at least ${MIN_SCENARIOS_PER_CATEGORY} scenarios, found ${deck.length}`);
  }

  const seenPrompts = new Set();
  deck.forEach((scenario, index) => {
    const label = `${category.name} scenario ${index + 1}`;
    if (!scenario.prompt || scenario.prompt.length < 20) failures.push(`${label} needs a real prompt`);
    if (seenPrompts.has(scenario.prompt)) failures.push(`${label} duplicates another prompt`);
    seenPrompts.add(scenario.prompt);

    if (!scenario.opponentAnswer || scenario.opponentAnswer.length > MAX_ANSWER_CHARS) {
      failures.push(`${label} needs a short opponent answer`);
    }
    if (!scenario.winningAnswer || scenario.winningAnswer.length > MAX_ANSWER_CHARS) {
      failures.push(`${label} needs a short winning answer`);
    }
    if (!scenario.reason || scenario.reason.length < 20) failures.push(`${label} needs an AI reason`);
  });
}

if (failures.length) {
  console.error(`Content check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Content check passed for ${categories.length} categories`);
