import { bots, categories, scenarios } from "../src/data.js";
import { getBotAnswer, getBotStyleLead } from "../src/lib/botEngine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const bot of bots) {
  const lead = getBotStyleLead(bot.name);
  assert(lead, `${bot.name} needs a style lead`);

  for (const category of categories) {
    for (const scenario of scenarios[category.id]) {
      const answer = getBotAnswer(bot.name, scenario);
      assert(answer.length > 20, `${bot.name} generated too-short answer for ${category.name}`);
      assert(answer.length <= 280, `${bot.name} generated overlong answer for ${category.name}`);
      assert(answer.includes(lead), `${bot.name} answer did not include its personality lead`);
    }
  }
}

const smoothAnswer = getBotAnswer("Smooth Talker", scenarios.dating[0]);
const survivalAnswer = getBotAnswer("The Survivalist", scenarios.survival[0]);
assert(smoothAnswer.includes("confident"), "Smooth Talker should sound confident");
assert(survivalAnswer.includes("safety"), "The Survivalist should prioritize safety");

console.log(`Bot engine check passed for ${bots.length} bots`);
