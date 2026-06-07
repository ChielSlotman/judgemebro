const MAX_BOT_ANSWER_CHARS = 280;

const botStyles = {
  "Cold CEO": {
    lead: "I would protect leverage and make the tradeoff explicit:",
    source: "winningAnswer",
  },
  "Chaos Carl": {
    lead: "I would take the loud swing first, then recover fast:",
    source: "opponentAnswer",
  },
  "The Monk": {
    lead: "I would slow it down and answer without ego:",
    source: "winningAnswer",
  },
  "The Survivalist": {
    lead: "First priority is control and safety:",
    source: "winningAnswer",
  },
  "Smooth Talker": {
    lead: "I would keep it confident, light, and hard to rattle:",
    source: "winningAnswer",
  },
};

function clampBotAnswer(answer) {
  if (answer.length <= MAX_BOT_ANSWER_CHARS) return answer;
  return `${answer.slice(0, MAX_BOT_ANSWER_CHARS - 1).trimEnd()}.`;
}

export function getBotAnswer(botName, scenario) {
  const style = botStyles[botName] ?? botStyles["Cold CEO"];
  const baseAnswer = scenario?.[style.source] || scenario?.opponentAnswer || scenario?.winningAnswer || "";
  const answer = `${style.lead} ${baseAnswer}`;
  return clampBotAnswer(answer);
}

export function getBotStyleLead(botName) {
  return botStyles[botName]?.lead ?? botStyles["Cold CEO"].lead;
}
