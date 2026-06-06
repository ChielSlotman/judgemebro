export const categories = [
  {
    id: "business",
    name: "Business",
    icon: "Briefcase",
    image: "/assets/cat-business.png",
  },
  {
    id: "dating",
    name: "Dating",
    icon: "Heart",
    image: "/assets/cat-dating.png",
  },
  {
    id: "survival",
    name: "Survival",
    icon: "Flame",
    image: "/assets/cat-survival.png",
  },
  {
    id: "negotiation",
    name: "Negotiation",
    icon: "Handshake",
    image: "/assets/cat-negotiation.png",
  },
  {
    id: "moral",
    name: "Moral Dilemmas",
    icon: "Scale",
    image: "/assets/cat-moral.png",
  },
  {
    id: "social",
    name: "Social Drama",
    icon: "Users",
    image: "/assets/cat-social.png",
  },
  {
    id: "crisis",
    name: "Crisis Management",
    icon: "Shield",
    image: "/assets/cat-crisis.png",
  },
];

export const scenarios = {
  business: {
    prompt: 'A client says, "Your price is too high." What do you reply?',
    opponentAnswer: "I understand. I can give you a discount.",
    winningAnswer:
      "If price is the issue, I can reduce the scope, not the quality. What part matters most to you?",
    reason:
      "You protected the value of the offer while keeping the negotiation open.",
  },
  dating: {
    prompt: 'She says, "You are nice, but I do not feel a spark." What do you reply?',
    opponentAnswer: "No spark? Good. I was looking for fire anyway.",
    winningAnswer:
      "Fair, but sparks are overrated. I prefer tension that actually builds.",
    reason:
      "You stayed confident without chasing validation or turning defensive.",
  },
  survival: {
    prompt:
      "You are lost with one bottle of water and two hours of daylight. What is your first move?",
    opponentAnswer: "Keep walking until I find a road.",
    winningAnswer:
      "Stop moving, mark my location, conserve water, and use daylight to find high ground for signal.",
    reason:
      "You prioritized orientation, energy, and rescue odds instead of panic movement.",
  },
  negotiation: {
    prompt:
      "Your boss offers a promotion without a raise. What do you say in the moment?",
    opponentAnswer: "Thanks, I accept. We can talk money later.",
    winningAnswer:
      "I am excited about the responsibility. Can we define the compensation that matches the new scope?",
    reason:
      "You accepted the opportunity while anchoring the compensation conversation.",
  },
  moral: {
    prompt:
      "Your friend confesses they cheated on an exam and asks you not to tell. What do you do?",
    opponentAnswer: "I would stay out of it because it is not my problem.",
    winningAnswer:
      "I would tell them they have one chance to confess before I do.",
    reason:
      "You gave your friend agency while still protecting the integrity of the situation.",
  },
  social: {
    prompt:
      "Your best friend posts an embarrassing photo of you. What do you say?",
    opponentAnswer: "Delete it now or we are done.",
    winningAnswer:
      "That one makes me uncomfortable. Can you take it down and ask me before posting next time?",
    reason:
      "You set a clear boundary without escalating the conflict.",
  },
  crisis: {
    prompt:
      "Your team missed a critical deadline. The client asks what happened. What do you say?",
    opponentAnswer: "We had some internal issues, but it should be fine soon.",
    winningAnswer:
      "We missed it, and I own the communication gap. Here is the recovery plan and exact next checkpoint.",
    reason:
      "You took accountability and immediately moved the conversation toward recovery.",
  },
};

export const bots = [
  {
    name: "Cold CEO",
    strength: "Business and negotiation",
    note: "Direct, practical, ruthless.",
  },
  {
    name: "Chaos Carl",
    strength: "Creative curveballs",
    note: "Funny, risky, unpredictable.",
  },
  {
    name: "The Monk",
    strength: "Moral and relationship dilemmas",
    note: "Calm, patient, unusually hard to tilt.",
  },
  {
    name: "The Survivalist",
    strength: "Survival and crisis",
    note: "Practical, tactical, low drama.",
  },
  {
    name: "Smooth Talker",
    strength: "Dating and social drama",
    note: "Confident, playful, dangerous.",
  },
];

export const viewerAnswers = [
  {
    id: 1,
    name: "Viewer 1",
    text: "No spark? Good. I was looking for fire anyway.",
  },
  {
    id: 2,
    name: "Viewer 2",
    text: "That is okay. I do not chase chemistry that needs convincing.",
  },
  {
    id: 3,
    name: "Viewer 3",
    text: "Respect. I will go find someone with better taste.",
  },
  {
    id: 4,
    name: "Viewer 4",
    text: "Fair. I like people honest enough not to waste both our time.",
  },
];
