const MIN_STRONG_ANSWER_LENGTH = 42;

export function normalizeAnswer(answer) {
  return String(answer ?? "").trim();
}

export function judgeAnswers({
  mode = "ranked",
  category,
  prompt,
  yourAnswer,
  opponentAnswer,
  opponent = "Juno",
}) {
  const cleanYourAnswer = normalizeAnswer(yourAnswer);
  const cleanOpponentAnswer = normalizeAnswer(opponentAnswer);
  const noAnswer = cleanYourAnswer.length === 0;
  const opponentMissed = cleanOpponentAnswer.length === 0;
  const bothMissed = noAnswer && opponentMissed;

  const specificityScore = scoreAnswer(cleanYourAnswer);
  const opponentSpecificityScore = scoreAnswer(cleanOpponentAnswer);
  const youWin = !bothMissed && !noAnswer && (opponentMissed || specificityScore >= opponentSpecificityScore);
  const points = mode === "bot" || mode === "streamer" || bothMissed ? 0 : youWin ? 18 : -18;

  return {
    mode,
    category,
    opponent,
    prompt,
    yourAnswer: cleanYourAnswer || "No answer submitted.",
    opponentAnswer: cleanOpponentAnswer || "No answer submitted.",
    youWin,
    points,
    reason: buildReason({
      bothMissed,
      noAnswer,
      opponentMissed,
      youWin,
      specificityScore,
      opponentSpecificityScore,
    }),
    judgeModel: "local-deterministic-v1",
  };
}

function scoreAnswer(answer) {
  if (!answer) return 0;

  const lengthScore = Math.min(answer.length / MIN_STRONG_ANSWER_LENGTH, 2);
  const questionScore = answer.includes("?") ? 0.35 : 0;
  const boundaryScore = /\b(no|not|can't|cannot|scope|quality|plan|checkpoint|confess|boundary|take it down)\b/i.test(answer)
    ? 0.45
    : 0;
  const accountabilityScore = /\b(own|accountability|here is|next|what part|can we|before)\b/i.test(answer)
    ? 0.35
    : 0;
  const panicPenalty = /\b(discount|done|whatever|fine|not my problem)\b/i.test(answer) ? -0.35 : 0;

  return lengthScore + questionScore + boundaryScore + accountabilityScore + panicPenalty;
}

function buildReason({
  bothMissed,
  noAnswer,
  opponentMissed,
  youWin,
  specificityScore,
  opponentSpecificityScore,
}) {
  if (bothMissed) return "Both players missed the timer, so no rating change happens.";
  if (noAnswer) return "You missed the timer, so the round goes to your opponent.";
  if (opponentMissed) return "Your opponent missed the timer, so you win by default.";
  if (youWin) {
    return specificityScore > opponentSpecificityScore + 0.35
      ? "You gave the more specific, controlled response and kept the situation moving."
      : "Your answer was slightly stronger because it balanced confidence with a practical next step.";
  }

  return "Your opponent gave the more specific response, with clearer judgment and a stronger next step.";
}
