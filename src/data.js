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
  business: [
    {
      prompt: 'A client says, "Your price is too high." What do you reply?',
      opponentAnswer: "I understand. I can give you a discount.",
      winningAnswer:
        "If price is the issue, I can reduce the scope, not the quality. What part matters most to you?",
      reason:
        "You protected the value of the offer while keeping the negotiation open.",
    },
    {
      prompt: "Your startup demo crashes in front of an investor. What do you say next?",
      opponentAnswer: "Sorry, the internet here is weird. It worked earlier.",
      winningAnswer:
        "The crash is on us. I will show the workflow from the backup build, then send the fixed recording today.",
      reason: "You owned the failure and immediately moved to a credible recovery path.",
    },
    {
      prompt: "A teammate takes credit for your idea in a meeting. What do you do?",
      opponentAnswer: "Call them out in front of everyone.",
      winningAnswer:
        "I would add context calmly: that came from the direction I prototyped yesterday, and here is the next step.",
      reason: "You reclaimed credit without derailing the room.",
    },
    {
      prompt: "Your biggest customer asks for a feature you know will hurt the product. What do you say?",
      opponentAnswer: "Sure, we can build that if you really need it.",
      winningAnswer:
        "I want to solve the outcome, not ship a feature that creates new problems. What job are you trying to get done?",
      reason: "You protected product quality while keeping the customer inside the conversation.",
    },
    {
      prompt: "A competitor publicly copies your launch. What is your first response?",
      opponentAnswer: "Post that they stole it and tag them.",
      winningAnswer:
        "Do not feed the copycat. I would show our proof, sharpen the offer, and make the next release harder to chase.",
      reason: "You turned the moment into momentum instead of giving the competitor free attention.",
    },
  ],
  dating: [
    {
      prompt: 'She says, "You are nice, but I do not feel a spark." What do you reply?',
      opponentAnswer: "No spark? Good. I was looking for fire anyway.",
      winningAnswer:
        "Fair, but sparks are overrated. I prefer tension that actually builds.",
      reason:
        "You stayed confident without chasing validation or turning defensive.",
    },
    {
      prompt: "Your date checks their phone constantly. What do you say?",
      opponentAnswer: "Are you bored or something?",
      winningAnswer:
        "I like being present when I am with someone. Want to reset for ten minutes, phones down?",
      reason: "You set a standard without sounding needy or hostile.",
    },
    {
      prompt: 'They text, "I am bad at replying." What is your answer?',
      opponentAnswer: "It is fine, I can wait.",
      winningAnswer:
        "No stress. I am not looking for constant texting, just enough rhythm to know there is interest.",
      reason: "You stayed relaxed while still protecting your own time.",
    },
    {
      prompt: "They cancel plans for the second time with a vague excuse. What do you reply?",
      opponentAnswer: "It is okay, whenever you are free.",
      winningAnswer:
        "No hard feelings, but I only reschedule when the energy is mutual. Want to pick a real time or leave it here?",
      reason: "You stayed calm and made the standard clear.",
    },
    {
      prompt: 'Someone says, "I usually go for people who are more my type." What do you say?',
      opponentAnswer: "I can be your type if you give me a chance.",
      winningAnswer:
        "Then I will not audition for the role. If you are curious, cool. If not, we both save time.",
      reason: "You refused to chase approval while leaving a confident door open.",
    },
  ],
  survival: [
    {
      prompt:
        "You are lost with one bottle of water and two hours of daylight. What is your first move?",
      opponentAnswer: "Keep walking until I find a road.",
      winningAnswer:
        "Stop moving, mark my location, conserve water, and use daylight to find high ground for signal.",
      reason:
        "You prioritized orientation, energy, and rescue odds instead of panic movement.",
    },
    {
      prompt: "Your car breaks down on a freezing road with low phone battery. First move?",
      opponentAnswer: "Walk until I find help.",
      winningAnswer:
        "Stay with the car, make it visible, text location, save battery, and run heat in short intervals.",
      reason: "You chose visibility and conservation over risky wandering.",
    },
    {
      prompt: "A kitchen fire starts in a pan. What do you do immediately?",
      opponentAnswer: "Throw water on it fast.",
      winningAnswer:
        "Turn off heat, cover it with a lid if safe, never use water, and keep the exit clear.",
      reason: "You avoided the move that makes grease fires worse.",
    },
    {
      prompt: "You hear glass break downstairs at night and you are alone. What is your move?",
      opponentAnswer: "Grab something and go check it out.",
      winningAnswer:
        "Lock my room, stay quiet, call emergency services, give my location, and avoid clearing the house alone.",
      reason: "You prioritized distance, information, and backup over risky confrontation.",
    },
    {
      prompt: "Your friend is panicking in deep water and grabbing at you. What do you do?",
      opponentAnswer: "Swim straight to them and pull them back.",
      winningAnswer:
        "Keep distance, throw or extend something buoyant, call for help, and avoid becoming a second victim.",
      reason: "You chose a rescue method that does not put both people underwater.",
    },
  ],
  negotiation: [
    {
      prompt:
        "Your boss offers a promotion without a raise. What do you say in the moment?",
      opponentAnswer: "Thanks, I accept. We can talk money later.",
      winningAnswer:
        "I am excited about the responsibility. Can we define the compensation that matches the new scope?",
      reason:
        "You accepted the opportunity while anchoring the compensation conversation.",
    },
    {
      prompt: "A buyer says they have a cheaper offer. How do you respond?",
      opponentAnswer: "I can match it if you sign today.",
      winningAnswer:
        "If the offers are equal, take cheaper. If outcomes matter, let us compare risk, support, and total cost.",
      reason: "You reframed from price to value without sounding defensive.",
    },
    {
      prompt: "Someone asks for a favor but gives you no timeline or scope. What do you say?",
      opponentAnswer: "Sure, send it over.",
      winningAnswer:
        "I can help if we define the ask: what outcome, how much time, and when do you need it?",
      reason: "You kept generosity while preventing a vague commitment.",
    },
    {
      prompt: "A client asks for one more revision after the project is already approved. What do you say?",
      opponentAnswer: "No problem, I can do one more for free.",
      winningAnswer:
        "Happy to help. Since approval closed the scope, I can price this as a small add-on or trade it for another item.",
      reason: "You stayed helpful while protecting the boundary.",
    },
    {
      prompt: "A seller says the price is final, but you know the item has a flaw. What do you say?",
      opponentAnswer: "Come on, just lower it a bit.",
      winningAnswer:
        "I respect the price. With the flaw, my offer is lower because I am taking on repair risk. I can pay today.",
      reason: "You gave a clear reason and a clean close instead of begging.",
    },
  ],
  moral: [
    {
      prompt:
        "Your friend confesses they cheated on an exam and asks you not to tell. What do you do?",
      opponentAnswer: "I would stay out of it because it is not my problem.",
      winningAnswer:
        "I would tell them they have one chance to confess before I do.",
      reason:
        "You gave your friend agency while still protecting the integrity of the situation.",
    },
    {
      prompt: "You find a wallet with cash and an ID. What do you do?",
      opponentAnswer: "Keep the cash and return the wallet.",
      winningAnswer:
        "Return it intact or hand it to a trusted desk with proof. The cash is not mine to tax.",
      reason: "You solved the problem without rationalizing theft.",
    },
    {
      prompt: "A coworker tells an offensive joke and everyone laughs. What do you say?",
      opponentAnswer: "Laugh along so it is not awkward.",
      winningAnswer:
        "I would keep it short: that one is not for me. Then move the room back to work.",
      reason: "You challenged the moment without making yourself the whole scene.",
    },
    {
      prompt: "You can take credit for a mistake-free group project, but one teammate did most of it. What do you do?",
      opponentAnswer: "Accept the praise and thank the team generally.",
      winningAnswer:
        "I would name the teammate directly and say the strongest parts came from their work.",
      reason: "You protected fairness when nobody was forcing you to.",
    },
    {
      prompt: "Your friend wants you to lie to cover where they were last night. What do you say?",
      opponentAnswer: "Fine, but only this once.",
      winningAnswer:
        "I care about you, but I am not becoming part of the lie. I can help you handle the truth.",
      reason: "You supported the person without enabling the deception.",
    },
  ],
  social: [
    {
      prompt:
        "Your best friend posts an embarrassing photo of you. What do you say?",
      opponentAnswer: "Delete it now or we are done.",
      winningAnswer:
        "That one makes me uncomfortable. Can you take it down and ask me before posting next time?",
      reason:
        "You set a clear boundary without escalating the conflict.",
    },
    {
      prompt: "A group chat starts roasting someone who is not there. What do you do?",
      opponentAnswer: "Join in a little so I fit in.",
      winningAnswer:
        "I would not pile on. If there is a real issue, say it to them directly, not as a group sport.",
      reason: "You protected the social standard without sounding preachy.",
    },
    {
      prompt: "Someone leaves you on read, then acts normal in person. What do you say?",
      opponentAnswer: "Why are you ignoring me?",
      winningAnswer:
        "I would keep it light: I noticed the message got buried. Are we good, or should I read the silence?",
      reason: "You named the issue with confidence and room for honesty.",
    },
    {
      prompt: "A friend keeps making jokes at your expense because the group laughs. What do you say?",
      opponentAnswer: "Roast them back harder.",
      winningAnswer:
        "The joke landed once. Now it is getting old. Keep me out of the punchline.",
      reason: "You set a boundary with enough confidence to stop the pattern.",
    },
    {
      prompt: "Someone sends a screenshot of your private chat to others. What do you do?",
      opponentAnswer: "Screenshot their secrets back.",
      winningAnswer:
        "I would say directly: private messages stay private. Do not share mine again, and delete that thread.",
      reason: "You addressed the breach without escalating into the same behavior.",
    },
  ],
  crisis: [
    {
      prompt:
        "Your team missed a critical deadline. The client asks what happened. What do you say?",
      opponentAnswer: "We had some internal issues, but it should be fine soon.",
      winningAnswer:
        "We missed it, and I own the communication gap. Here is the recovery plan and exact next checkpoint.",
      reason:
        "You took accountability and immediately moved the conversation toward recovery.",
    },
    {
      prompt: "A bad post from your brand account goes viral. First public response?",
      opponentAnswer: "We were hacked, sorry.",
      winningAnswer:
        "We posted something wrong. It is removed, we are reviewing how it happened, and we will update today.",
      reason: "You avoided excuses and gave a clear accountability timeline.",
    },
    {
      prompt: "A customer says your product caused them a serious problem. What do you reply?",
      opponentAnswer: "That should not happen. Try restarting it.",
      winningAnswer:
        "I am sorry this happened. Stop using it for now, send details here, and I will escalate this immediately.",
      reason: "You prioritized safety, ownership, and escalation.",
    },
    {
      prompt: "Your venue loses power during a sold-out event. What do you announce first?",
      opponentAnswer: "Please stay calm, we are figuring it out.",
      winningAnswer:
        "Power is out. Stay where you are unless staff directs you. We are checking safety now and will update in five minutes.",
      reason: "You gave clear instructions, owned uncertainty, and set the next update time.",
    },
    {
      prompt: "A private internal document leaks online. What is your first public line?",
      opponentAnswer: "We cannot comment on leaked materials.",
      winningAnswer:
        "We are reviewing what was shared, protecting affected people first, and will correct anything inaccurate today.",
      reason: "You avoided stonewalling and put harm reduction before spin.",
    },
  ],
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
