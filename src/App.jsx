import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Bolt,
  Bot,
  Briefcase,
  Check,
  ChevronRight,
  CircleDot,
  Clock,
  Copy,
  Flame,
  Gift,
  Gavel,
  Handshake,
  Heart,
  Link as LinkIcon,
  LogOut,
  MessageCircle,
  Radio,
  Scale,
  Send,
  Shield,
  Swords,
  Trophy,
  Mic,
  MicOff,
  Volume2,
  Users,
  X,
} from "lucide-react";
import { bots, categories } from "./data.js";
import { getBotAnswer } from "./lib/botEngine.js";
import {
  DAILY_RANKED_BATTLES,
  canStartRatedBattle,
  resolveDailyBattlesLeft,
  resolveStreakAfterBattle,
} from "./lib/dailyAllowance.js";
import {
  createFriendBattleRoom,
  createStreamerRoom,
  getFriendBattleAnswers,
  findOrCreateRankedMatch,
  getPlayerPresenceId,
  getRankedBattleAnswers,
  getRankedBattleRoom,
  getStreamerRoom,
  joinFriendBattleRoom,
  markFriendBattleJudged,
  markRankedBattleJudged,
  recordBattleResult,
  recordViewerSubmission,
  submitFriendBattleAnswer,
  submitRankedBattleAnswer,
  subscribeToFriendRoom,
  subscribeToRankedBattle,
  subscribeToRankedTicket,
  subscribeToStreamerAnswers,
  subscribeToStreamerRoom,
  updateStreamerAnswerState,
} from "./lib/gameRepository.js";
import { requestJudgeVerdict } from "./lib/judgeClient.js";
import { getScenario, randomScenarioRound } from "./lib/scenarioEngine.js";
import { hasSupabaseConfig, supabase } from "./lib/supabaseClient.js";

const iconMap = {
  Briefcase,
  Heart,
  Flame,
  Handshake,
  Scale,
  Users,
  Shield,
};

const MAX_CHARS = 280;
const DEFAULT_FRIEND_ROOM = "V7P2";
const DEFAULT_STREAM_ROOM = "BRO9";
const STORAGE_PREFIX = "judgemebro:";
const VOICE_SUPPORT =
  typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

function clampAnswer(value) {
  return value.slice(0, MAX_CHARS);
}

function recommendedBotsForCategory(categoryId) {
  const namesByCategory = {
    business: ["Cold CEO", "Chaos Carl", "The Monk"],
    negotiation: ["Cold CEO", "Smooth Talker", "Chaos Carl"],
    dating: ["Smooth Talker", "The Monk", "Chaos Carl"],
    social: ["Smooth Talker", "The Monk", "Chaos Carl"],
    moral: ["The Monk", "Cold CEO", "Chaos Carl"],
    survival: ["The Survivalist", "Cold CEO", "Chaos Carl"],
    crisis: ["The Survivalist", "Cold CEO", "The Monk"],
  };
  const names = namesByCategory[categoryId] ?? ["Cold CEO", "Chaos Carl", "The Monk"];
  return names.map((name) => bots.find((bot) => bot.name === name)).filter(Boolean);
}

function inviteBaseUrl() {
  if (typeof window === "undefined") return "https://judgemebro.com";
  return window.location.origin;
}

function friendBattlePath(roomCode) {
  return `/battle/${roomCode}`;
}

function streamerViewerPath(roomCode) {
  return `/stream/${roomCode}`;
}

function appScreenPath(screen, legalType = "terms") {
  if (screen === "auth-callback") return "/auth/callback";
  if (screen === "account") return "/account";
  if (screen === "profile") return "/profile";
  if (screen === "rewards") return "/rewards";
  if (screen === "legal") return legalType === "privacy" ? "/privacy" : "/terms";
  return "/";
}

function friendBattleLink(roomCode) {
  return `${inviteBaseUrl()}${friendBattlePath(roomCode)}`;
}

function streamerViewerLink(roomCode) {
  return `${inviteBaseUrl()}${streamerViewerPath(roomCode)}`;
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function parseInitialPath(pathname) {
  const friendMatch = pathname.match(/^\/battle\/([^/]+)\/?$/);
  if (friendMatch) return { screen: "friend", roomCode: friendMatch[1].toUpperCase() };

  const streamMatch = pathname.match(/^\/stream\/([^/]+)\/?$/);
  if (streamMatch) return { screen: "viewer", roomCode: streamMatch[1].toUpperCase() };

  if (pathname === "/account") return { screen: "account" };
  if (pathname === "/auth/callback") return { screen: "account", authCallback: true };
  if (pathname === "/profile") return { screen: "profile" };
  if (pathname === "/rewards") return { screen: "rewards" };
  if (pathname === "/terms") return { screen: "legal", legalType: "terms" };
  if (pathname === "/privacy") return { screen: "legal", legalType: "privacy" };

  return { screen: "home" };
}

function updatePath(path) {
  if (typeof window === "undefined") return;
  window.history.pushState({}, "", path);
}

function resetPath() {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, "", "/");
}

function setAppPath(screen, legalType = "terms") {
  updatePath(appScreenPath(screen, legalType));
}

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredNumber(key, fallback) {
  const stored = readStoredJson(key, fallback);
  return Number.isFinite(stored) ? stored : fallback;
}

function writeStoredJson(key, value) {
  if (typeof window === "undefined") return;
  if (value === null || value === undefined) {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    return;
  }
  window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function rankFromRating(rating) {
  if (rating >= 1800) return "Master";
  if (rating >= 1500) return "Diamond";
  if (rating >= 1300) return "Platinum";
  if (rating >= 1100) return "Gold";
  if (rating >= 900) return "Silver";
  return "Bronze";
}

function initialCategoryRatings() {
  return Object.fromEntries(categories.map((category) => [category.id, 1000]));
}

function categoryRatingRows(categoryRatings) {
  return categories.map((category) => ({
    ...category,
    rating: categoryRatings[category.id] ?? 1000,
  }));
}

function buildHistoryEntry(result) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    mode: result.mode,
    categoryId: result.category.id,
    categoryName: result.category.name,
    prompt: result.prompt,
    opponent: result.opponent,
    youWin: result.youWin,
    points: result.points,
    reason: result.reason,
    createdAt: new Date().toISOString(),
  };
}

function seedAnswersForScenario(scenario) {
  const promptKey = scenario.prompt.slice(0, 18).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return [
    {
      id: `seed-win-${promptKey}`,
      name: "Viewer 1",
      text: scenario.winningAnswer,
    },
    {
      id: `seed-risk-${promptKey}`,
      name: "Viewer 2",
      text: scenario.opponentAnswer,
    },
    {
      id: `seed-clean-${promptKey}`,
      name: "Viewer 3",
      text: "I would keep it calm, direct, and impossible to misread.",
    },
    {
      id: `seed-chaos-${promptKey}`,
      name: "Viewer 4",
      text: "I am choosing peace, but I am keeping receipts.",
    },
  ];
}

function pickCommentatorVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const premiumHints = [
    /natural/i,
    /neural/i,
    /enhanced/i,
    /premium/i,
    /online/i,
    /guy/i,
    /ryan/i,
    /liam/i,
    /brian/i,
    /aaron/i,
  ];
  const maleVoiceHints = [
    /\bdavid\b/i,
    /\bdaniel\b/i,
    /\balex\b/i,
    /\bfred\b/i,
    /\bmark\b/i,
    /\bpaul\b/i,
    /\bmale\b/i,
  ];

  const score = (voice) => {
    const name = voice.name || "";
    const premium = premiumHints.some((pattern) => pattern.test(name)) ? 35 : 0;
    const hinted = maleVoiceHints.some((pattern) => pattern.test(name)) ? 20 : 0;
    const englishUs = voice.lang.toLowerCase().startsWith("en-us") ? 2 : 0;
    const localPenalty = voice.localService ? 0 : 4;
    return premium + hinted + englishUs + localPenalty + (voice.default ? 1 : 0);
  };

  return [...(englishVoices.length ? englishVoices : voices)].sort((a, b) => score(b) - score(a))[0] ?? null;
}

function speakVerdict(result) {
  if (typeof window === "undefined" || !result) return;

  window.speechSynthesis?.cancel?.();
  if (
    import.meta.env.VITE_HOSTED_TTS_ENABLED !== "true" ||
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  ) {
    return;
  }

  const verdict = result.youWin ? "You win." : "You lose.";
  const points = result.mode === "bot" ? "Unranked bot battle." : `${result.points > 0 ? "Plus" : "Minus"} ${Math.abs(result.points)} points.`;
  const narration = `${verdict} ${points} ${result.reason}`;

  playHostedVerdict(narration).catch((error) => {
    console.warn("Hosted verdict voice unavailable", error);
  });
}

async function playHostedVerdict(narration) {
  if (import.meta.env.VITE_HOSTED_TTS_ENABLED !== "true") {
    throw new Error("Hosted TTS is disabled");
  }

  if (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
    throw new Error("Hosted TTS is only available on deployment");
  }

  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: narration }),
  });

  if (!response.ok) throw new Error("Hosted TTS unavailable");
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.onended = () => URL.revokeObjectURL(audioUrl);
  audio.onerror = () => URL.revokeObjectURL(audioUrl);
  await audio.play();
}

function speakBrowserVerdict(narration) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(narration);
  const voice = pickCommentatorVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-US";
  utterance.rate = 0.93;
  utterance.pitch = 0.68;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function appendVoiceAnswer(current, spokenText) {
  const spoken = spokenText.replace(/\s+/g, " ").trim();
  if (!spoken) return current;

  const answer = current.trim();
  if (answer.toLowerCase().endsWith(spoken.toLowerCase())) return current;

  return clampAnswer(`${answer ? `${answer} ` : ""}${spoken}`);
}

function useVoiceInput(setValue) {
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(VOICE_SUPPORT ? "" : "Voice input is not available in this browser.");
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
    };
  }, []);

  function startListening() {
    if (!VOICE_SUPPORT) {
      setVoiceStatus("Voice input is not available in this browser.");
      return;
    }
    if (isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let capturedTranscript = "";
    let endedWithError = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus("Listening. Say one short answer.");
    };

    recognition.onresult = (event) => {
      const finalChunks = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal && result[0]?.transcript) {
          finalChunks.push(result[0].transcript);
        }
      }

      const transcript = finalChunks.join(" ").trim();
      if (!transcript) return;

      capturedTranscript = transcript;
      setValue((current) => appendVoiceAnswer(current, transcript));
    };

    recognition.onerror = (event) => {
      endedWithError = true;
      setVoiceStatus(event.error === "not-allowed" ? "Mic permission blocked." : "Voice input stopped.");
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!endedWithError) {
        setVoiceStatus(capturedTranscript ? "Voice added." : "No speech captured. Tap Speak and try again.");
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop?.();
    setIsListening(false);
  }

  function toggleListening() {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }

  return { isListening, voiceStatus, toggleListening, voiceSupported: VOICE_SUPPORT };
}

function BrandHeader({ onHome, onProfile, onLeave, compact = false }) {
  return (
    <header className={`brand-header ${compact ? "compact" : ""}`}>
      <button className="brand-lockup" type="button" onClick={onHome}>
        <span>judgemebro</span>
        <small>.com</small>
      </button>
      <div className="header-actions">
        {onProfile ? (
          <button className="avatar-button" type="button" onClick={onProfile} aria-label="Open profile">
            <img src="/assets/avatar-you.png" alt="" />
            <span />
          </button>
        ) : null}
        {onLeave ? (
          <button className="ghost-button danger" type="button" onClick={onLeave}>
            <LogOut size={20} />
            Leave
          </button>
        ) : null}
      </div>
    </header>
  );
}

function StatBlock({ icon: Icon, value, label, accent = "lime" }) {
  return (
    <div className={`stat-block ${accent}`}>
      <Icon size={30} />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function CategoryTile({ category, selected, onSelect }) {
  const Icon = iconMap[category.icon] ?? CircleDot;

  return (
    <button
      className={`category-tile ${selected ? "selected" : ""}`}
      type="button"
      onClick={() => onSelect(category)}
      style={{ "--tile-image": `url(${category.image})` }}
    >
      <span className="tile-scrim" />
      <Icon size={36} />
      <strong>{category.name}</strong>
    </button>
  );
}

function HomeScreen({
  selectedCategory,
  setSelectedCategory,
  rating,
  battlesLeft,
  streak,
  onFind,
  onFriend,
  onStreamer,
  onProfile,
  onRewards,
  rewardClaimed,
}) {
  const rank = rankFromRating(rating);
  const rewardCopy = rewardClaimed ? "Reward claimed today. Come back tomorrow." : "Tap to claim today's extra battle.";

  return (
    <main className="screen home-screen">
      <BrandHeader onHome={() => {}} onProfile={onProfile} />

      <section className="hero-panel">
        <div className="speed-glow" />
        <h1>
          Get judged.
          <span>Get points.</span>
        </h1>
        <p>Can you make better decisions than other people?</p>
      </section>

      <section className="stats-row">
        <div className="rank-stat">
          <img src="/assets/rank-gold.svg" alt="" />
          <div>
            <strong>{rating}</strong>
            <span>{rank}</span>
          </div>
        </div>
        <StatBlock icon={Bolt} value={battlesLeft} label="Battles left today" />
        <StatBlock icon={Flame} value={streak} label="Day streak" accent="coral" />
      </section>

      <section className="live-strip" aria-label="Live activity">
        <div>
          <span className="live-dot" />
          <Users size={20} />
          <strong>382</strong>
          <span>online</span>
        </div>
        <div>
          <Clock size={20} />
          <span>avg round</span>
          <strong>31s</strong>
        </div>
        <div>
          <Trophy size={20} />
          <span>ranked</span>
        </div>
      </section>

      <section className="cta-stack">
        <button className="primary-button lime" type="button" onClick={onFind}>
          <Bolt size={34} />
          Find opponent
        </button>
        <div className="split-actions">
          <button className="outline-button" type="button" onClick={onFriend}>
            <LinkIcon size={24} />
            Challenge friend
          </button>
          <button className="outline-button coral" type="button" onClick={onStreamer}>
            <Radio size={24} />
            I am a streamer
          </button>
        </div>
      </section>

      <section className="category-section">
        <h2>Choose a category</h2>
        <div className="category-grid">
          {categories.map((category) => (
            <CategoryTile
              key={category.id}
              category={category}
              selected={selectedCategory.id === category.id}
              onSelect={setSelectedCategory}
            />
          ))}
        </div>
      </section>

      <button className="reward-strip" type="button" onClick={onRewards}>
        <Gift size={34} />
        <span>
          <strong>3-day streak</strong>
          {rewardCopy}
        </span>
        <ChevronRight size={26} />
      </button>
    </main>
  );
}

function AccountScreen({ user, authStatus, onGoogle, onEmailAuth, onDemo, onSignOut, onHome, onProfile, onLegal }) {
  const [authMode, setAuthMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");

  function submitEmailAuth(event) {
    event.preventDefault();
    onEmailAuth({
      mode: authMode,
      name: displayName,
      email,
      password,
    });
  }

  return (
    <main className="screen account-screen">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="auth-card">
        <span className="section-label">Account</span>
        <h1>{user ? "You are in" : authMode === "login" ? "Log in" : "Register"}</h1>
        <p>{user ? "Your rating, streak, and category stats are tied to this profile." : "Create an account, use Google, or jump in with a demo profile while testing."}</p>
        <div className="auth-user">
          <img src={user?.avatarUrl || "/assets/avatar-you.png"} alt="" />
          <div>
            <strong>{user?.name || "Guest player"}</strong>
            <span>{user?.email || "Not signed in yet"}</span>
          </div>
        </div>
        <button className="primary-button lime" type="button" onClick={onGoogle}>
          <BadgeCheck size={24} />
          Continue with Google
        </button>
        <div className="auth-tabs" role="tablist" aria-label="Account mode">
          <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>
            Login
          </button>
          <button className={authMode === "register" ? "active" : ""} type="button" onClick={() => setAuthMode("register")}>
            Register
          </button>
        </div>
        <form className="auth-form" onSubmit={submitEmailAuth}>
          {authMode === "register" ? (
            <label>
              Display name
              <input
                value={displayName}
                autoComplete="nickname"
                placeholder="Decision demon"
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              value={email}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              value={password}
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              placeholder="6+ characters"
              minLength={6}
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="outline-button" type="submit">
            {authMode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        <div className={`split-actions auth-actions ${user ? "" : "single"}`}>
          <button className="outline-button" type="button" onClick={onDemo}>Use demo profile</button>
          {user ? (
            <button className="outline-button coral" type="button" onClick={onSignOut}>Sign out</button>
          ) : null}
        </div>
        <p className="auth-status">{authStatus}</p>
      </section>
      <section className="legal-strip">
        <button type="button" onClick={() => onLegal("terms")}>Terms</button>
        <button type="button" onClick={() => onLegal("privacy")}>Privacy</button>
        <button type="button" onClick={onProfile}>View profile</button>
      </section>
    </main>
  );
}

function RewardScreen({ streak, battlesLeft, rewardClaimed, rewardDate, onClaim, onHome, onFind, onProfile }) {
  const rewards = [
    { title: "3-day streak", status: rewardClaimed ? "Claimed" : "Ready", detail: "Claim one extra ranked battle for today." },
    { title: "5-day streak", status: "Next", detail: "Unlock a fresh prompt pack preview." },
    { title: "7-day streak", status: "Locked", detail: "Double points token for one battle." },
  ];
  const rewardHint = rewardClaimed
    ? `Claimed for ${rewardDate}. New daily claim unlocks tomorrow.`
    : "Daily claim is ready. Take the extra ranked battle before you queue.";

  return (
    <main className="screen reward-screen">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="reward-hero">
        <Gift size={54} />
        <span className="section-label">Rewards</span>
        <h1>{streak}-day streak</h1>
        <p>{battlesLeft} ranked battles left today. {rewardHint}</p>
      </section>
      <section className="reward-list">
        {rewards.map((reward) => (
          <article key={reward.title} className={reward.status.toLowerCase()}>
            <div>
              <strong>{reward.title}</strong>
              <p>{reward.detail}</p>
            </div>
            <span>{reward.status}</span>
          </article>
        ))}
      </section>
      <section className="cta-stack">
        <button className="primary-button lime" type="button" disabled={rewardClaimed} onClick={onClaim}>
          {rewardClaimed ? "Reward claimed" : "Claim extra battle"}
        </button>
        <button className="primary-button lime" type="button" onClick={onFind}>Play for streak</button>
        <button className="outline-button" type="button" onClick={onProfile}>Profile stats</button>
      </section>
    </main>
  );
}

function LegalScreen({ type, onHome }) {
  const isPrivacy = type === "privacy";
  return (
    <main className="screen legal-screen">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="legal-page">
        <span className="section-label">{isPrivacy ? "Privacy" : "Terms"}</span>
        <h1>{isPrivacy ? "Privacy Policy" : "Terms and Conditions"}</h1>
        <p>Last updated June 7, 2026. This prototype lets players submit short answers, join rooms, and receive AI-assisted verdicts.</p>
        <article>
          <h2>{isPrivacy ? "What we store" : "Using the game"}</h2>
          <p>{isPrivacy ? "We may store display names, room codes, answers, verdicts, and lightweight gameplay stats so battles and streamer rooms can function." : "Do not submit personal, hateful, illegal, or unsafe content. AI verdicts are entertainment, not professional advice."}</p>
        </article>
        <article>
          <h2>{isPrivacy ? "Third-party services" : "Rankings and verdicts"}</h2>
          <p>{isPrivacy ? "The app can use Supabase, Vercel, Groq, and OpenAI-compatible services for auth, storage, hosting, and generated voice or verdicts." : "Ranked points are prototype scoring and can be reset while the platform is being built."}</p>
        </article>
        <article>
          <h2>Contact</h2>
          <p>For takedown, privacy, or account requests, contact the site owner for judgemebro.com.</p>
        </article>
      </section>
    </main>
  );
}

function BotChoiceCard({ bot, featured, disabled, onSelect }) {
  return (
    <button className={`bot-choice ${featured ? "featured" : ""}`} type="button" disabled={disabled} onClick={() => onSelect(bot.name)}>
      <span>{featured ? "Best fallback" : bot.strength}</span>
      <strong>{bot.name}</strong>
      <small>{bot.note}</small>
    </button>
  );
}

function MatchmakingScreen({ category, elapsed, botReady, matchmakingStatus, botChoices, onCancel, onBattle, onBot, onFriend }) {
  return (
    <main className="screen matchmaking-screen">
      <BrandHeader onHome={onCancel} onLeave={onCancel} compact />
      <section className="match-orbit">
        <p className="section-label">Finding your judge match</p>
        <h1>{category.name}</h1>
        <div className="orbit-avatars">
          <div className="avatar-ring cyan">
            <img src="/assets/avatar-you.png" alt="You" />
          </div>
          <Swords size={42} />
          <div className="avatar-ring coral">
            <img src="/assets/avatar-juno.png" alt="Opponent" />
          </div>
        </div>
        <div className="search-pulse">
          <span />
          <span />
          <span />
          <strong>{elapsed}s searching</strong>
        </div>
        <p className="matchmaking-status">{matchmakingStatus}</p>
      </section>

      <section className="rule-list">
        <div><Check size={18} /> Same dilemma</div>
        <div><Check size={18} /> Hidden answers</div>
        <div><Check size={18} /> AI verdict</div>
        <div><Check size={18} /> Ranked points</div>
      </section>

      <section className="match-actions">
        {elapsed >= 3 ? (
          <button className="primary-button lime" type="button" onClick={onBattle}>
            <Bolt size={26} />
            Start quick battle
          </button>
        ) : (
          <button className="primary-button muted" type="button" disabled>
            <Clock size={24} />
            Searching for opponent
          </button>
        )}
        <button className="outline-button" type="button" onClick={onFriend}>
          <LinkIcon size={22} />
          Send this battle to a friend
        </button>
        <section className={`bot-dock ${botReady ? "ready" : "locked"}`} aria-label="Bot fallback choices">
          <div>
            <Bot size={22} />
            <strong>{botReady ? "Bot fallback ready" : "Bot fallback unlocks at 5s"}</strong>
          </div>
          {botChoices.map((bot, index) => (
            <BotChoiceCard
              key={bot.name}
              bot={bot}
              featured={index === 0}
              disabled={!botReady}
              onSelect={onBot}
            />
          ))}
        </section>
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel search
        </button>
      </section>
    </main>
  );
}

function BattleScreen({
  category,
  scenario,
  timer,
  answer,
  setAnswer,
  rating,
  onSubmit,
  onLeave,
  opponent = "Juno",
  opponentRating = "1135",
}) {
  const { isListening, voiceStatus, toggleListening, voiceSupported } = useVoiceInput(setAnswer);
  const rank = rankFromRating(rating);
  const opponentRank = Number.isFinite(Number(opponentRating)) ? rankFromRating(Number(opponentRating)) : "Bot";

  return (
    <main className="screen battle-screen">
      <BrandHeader onHome={onLeave} onLeave={onLeave} />

      <section className="battle-meta">
        <div>
          <span className="section-label">Category</span>
          <strong className="category-live">
            <Users size={30} />
            {category.name}
          </strong>
        </div>
        <div className={`timer-block ${timer <= 8 ? "urgent" : ""}`}>
          <span className="section-label">Time left</span>
          <strong>{timer}s</strong>
          <span className="timer-ring" style={{ "--timer-progress": `${Math.max(timer, 0) / 24}turn` }} />
        </div>
      </section>

      <section className="faceoff">
        <div className="player-side cyan">
          <h2>You</h2>
          <div className="portrait">
            <img src="/assets/avatar-you.png" alt="You" />
            <span />
          </div>
          <div className="rating-line">
            <img src="/assets/rank-gold.svg" alt="" />
            <strong>{rating}</strong>
            <span>{rank}</span>
          </div>
        </div>
        <div className="versus">
          <span>Vs</span>
        </div>
        <div className="player-side coral">
          <h2>{opponent}</h2>
          <div className="portrait">
            <img src="/assets/avatar-juno.png" alt={opponent} />
            <span />
          </div>
          <div className="rating-line right">
            <strong>{opponentRating}</strong>
            <span>{opponentRank}</span>
            <img src="/assets/rank-gold.svg" alt="" />
          </div>
        </div>
      </section>

      <section className="typing-status">
        <div className="typing-dots">
          <span />
          <span />
          <span />
        </div>
        <strong>Opponent is typing...</strong>
        <p>Answers are hidden until the judge decides.</p>
      </section>

      <section className="scenario-card">
        <span className="section-label">Scenario</span>
        <h1>{scenario.prompt}</h1>
      </section>

      <section className="answer-box">
        <textarea
          value={answer}
          maxLength={MAX_CHARS}
          onChange={(event) => setAnswer(clampAnswer(event.target.value))}
          placeholder="Type your answer..."
          aria-label="Your answer"
        />
        <div className="answer-controls">
          <button
            className={`voice-button ${isListening ? "listening" : ""}`}
            type="button"
            disabled={!voiceSupported}
            onClick={toggleListening}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isListening ? <MicOff size={19} /> : <Mic size={19} />}
            {isListening ? "Stop" : "Speak"}
          </button>
          <span>{answer.length}/{MAX_CHARS}</span>
        </div>
      </section>
      {voiceStatus ? <p className={`voice-status ${isListening ? "active" : ""}`}>{voiceStatus}</p> : null}

      <button className="primary-button judge" type="button" disabled={answer.trim().length === 0} onClick={onSubmit}>
        <Gavel size={32} />
        Submit to judge
      </button>

      <section className="battle-rules">
        <span><MessageCircle size={20} /> Same prompt</span>
        <span><Shield size={20} /> Hidden answers</span>
        <span><Scale size={20} /> AI verdict</span>
      </section>
      <p className="fair-note">One prompt. Two answers. AI decides. <strong>Play fair. No roasting.</strong></p>
    </main>
  );
}

function WaitingScreen({ timer, category, onForceResult }) {
  return (
    <main className="screen waiting-screen">
      <BrandHeader onHome={() => {}} compact />
      <section className="judge-loader">
        <Gavel size={50} />
        <h1>Waiting for opponent</h1>
        <p>{category.name} battle is locked. Answers reveal when both players submit or the timer hits zero.</p>
        <div className="large-count">{timer}s</div>
        <div className="loading-bar"><span /></div>
        <button className="outline-button" type="button" onClick={onForceResult}>
          Simulate opponent submit
        </button>
      </section>
    </main>
  );
}

function verdictShareText(result, rating) {
  const outcome = result.youWin ? "won" : "lost";
  const delta = result.points > 0 ? `+${result.points}` : `${result.points}`;
  const ratingLine = result.mode === "bot" || result.mode === "streamer" ? "unranked" : `${rating} ${rankFromRating(rating)}`;
  return [
    `I just ${outcome} a ${result.category.name} dilemma on judgemebro.com.`,
    `Result: ${delta} (${ratingLine}).`,
    `Prompt: ${result.prompt}`,
    `Judge: ${result.reason}`,
    "Can you make a better decision?",
    "https://judgemebro.com",
  ].join("\n");
}

function ResultScreen({ result, rating, battlesLeft, onRematch, onRewards, onNew, onHome }) {
  const [shareStatus, setShareStatus] = useState("");
  const [shareText, setShareText] = useState("");
  const delta = result.points > 0 ? `+${result.points}` : `${result.points}`;
  const newRating = rating;
  const rank = rankFromRating(newRating);
  const canRunBack = canStartRatedBattle(result.mode, battlesLeft);
  const resultMeta =
    result.mode === "bot"
      ? "unranked bot battle"
      : result.mode === "streamer"
        ? "streamer battle"
        : `new rating ${newRating} ${rank}`;

  function shareVerdict() {
    const text = verdictShareText(result, newRating);
    setShareText(text);
    setShareStatus("Verdict ready");

    if (!navigator.clipboard) return;

    navigator.clipboard
      .writeText(text)
      .then(() => setShareStatus("Copied verdict"))
      .catch(() => setShareStatus("Verdict ready"));
  }

  return (
    <main className="screen result-screen">
      <BrandHeader onHome={onHome} compact />
      <section className={`verdict-hero ${result.youWin ? "win" : "loss"}`}>
        <div className="result-burst" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="section-label">AI judge has spoken</span>
        <h1>{result.youWin ? "You win" : "You lose"}</h1>
        <div className="point-burst">
          <img src="/assets/rank-gold.svg" alt="" />
          <strong>{delta}</strong>
          <span>{resultMeta}</span>
        </div>
      </section>

      <section className="result-scenario">
        <span className="section-label">{result.category.name}</span>
        <h2>{result.prompt}</h2>
      </section>

      <section className="answer-compare">
        <article className={result.youWin ? "winner" : ""}>
          <span>You</span>
          <p>{result.yourAnswer}</p>
        </article>
        <article className={!result.youWin ? "winner" : ""}>
          <span>{result.opponent}</span>
          <p>{result.opponentAnswer}</p>
        </article>
      </section>

      <section className="reason-box">
        <Gavel size={24} />
        <div>
          <p>{result.reason}</p>
          <small>Voice verdict is AI-generated.</small>
        </div>
      </section>

      <section className="cta-stack">
        <button className="primary-button lime" type="button" onClick={canRunBack ? onRematch : onRewards}>
          {canRunBack ? <Bolt size={28} /> : <Gift size={28} />}
          {canRunBack ? "Run it back" : "Get more battles"}
        </button>
        <div className="split-actions">
          <button className="outline-button" type="button" onClick={onNew}>
            New opponent
          </button>
          <button className="outline-button coral" type="button" onClick={shareVerdict}>
            {shareStatus || "Share verdict"}
          </button>
          <button className="outline-button" type="button" onClick={() => speakVerdict(result)}>
            <Volume2 size={22} />
            Replay voice
          </button>
        </div>
        {shareStatus ? <p className="share-status">{shareStatus}</p> : null}
        {shareText ? (
          <textarea className="share-text" value={shareText} readOnly aria-label="Share text" />
        ) : null}
      </section>
    </main>
  );
}

function FriendBattleScreen({ category, scenario, joined, roomCode, status, onHome, onStart, onBot }) {
  const [copied, setCopied] = useState(false);
  const link = friendBattleLink(roomCode);

  function copyLink() {
    setCopied(true);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
  }

  return (
    <main className="screen friend-screen">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="room-hero">
        <span className="section-label">Friend battle</span>
        <h1>Room {roomCode}</h1>
        <p>{status}</p>
      </section>
      <section className="link-box">
        <LinkIcon size={24} />
        <span>{link}</span>
        <button type="button" onClick={copyLink}>{copied ? "Copied" : "Copy"}</button>
      </section>
      <section className="friend-slots">
        <div className="slot ready">
          <img src="/assets/avatar-you.png" alt="" />
          <div>
            <strong>You</strong>
            <span>Ready</span>
          </div>
        </div>
        <div className={`slot ${joined ? "ready" : ""}`}>
          <img src="/assets/avatar-juno.png" alt="" />
          <div>
            <strong>{joined ? "Maya joined" : "Friend joining..."}</strong>
            <span>{joined ? "Ready" : "Preview locked until both players enter"}</span>
          </div>
        </div>
      </section>
      <section className="scenario-card compact-scenario">
        <span className="section-label">{category.name}</span>
        <h1>{joined ? scenario.prompt : "Dilemma unlocks when your friend joins."}</h1>
      </section>
      <section className="cta-stack">
        <button className="primary-button lime" type="button" disabled={!joined} onClick={onStart}>
          <Swords size={26} />
          Start battle
        </button>
        <button className="outline-button coral" type="button" onClick={onBot}>
          <Bot size={22} />
          Play bot instead
        </button>
      </section>
    </main>
  );
}

function ProfileScreen({
  user,
  rating,
  streak,
  history,
  categoryRatings,
  onHome,
  onFind,
  onFriend,
  onStreamer,
  onAccount,
  onLegal,
}) {
  const wins = history.filter((entry) => entry.youWin).length;
  const losses = history.length - wins;
  const rows = categoryRatingRows(categoryRatings);
  const bestCategory = history.length ? rows.reduce((best, row) => (row.rating > best.rating ? row : best), rows[0]) : null;
  const rank = rankFromRating(rating);
  const progress = Math.min(100, Math.max(8, ((rating - 900) / 400) * 100));
  const recent = history.slice(0, 4);

  return (
    <main className="screen profile-screen">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="profile-card">
        <img src={user?.avatarUrl || "/assets/avatar-you.png"} alt="Profile" />
        <h1>{user?.name || "Guest bro"}</h1>
        <div className="profile-rating">
          <img src="/assets/rank-gold.svg" alt="" />
          <strong>{rating}</strong>
          <span>{rank}</span>
        </div>
        <div className="rank-progress"><span style={{ width: `${progress}%` }} /></div>
        <p>{wins}W / {losses}L. {streak}-day streak. Best category: {bestCategory?.name || "Unranked"}.</p>
        <div className="profile-kpis">
          <span><strong>{history.length}</strong> Battles</span>
          <span><strong>{wins}</strong> Wins</span>
          <span><strong>{bestCategory?.rating ?? 1000}</strong> Best</span>
        </div>
      </section>
      <section className="category-ratings">
        {rows.map((category) => (
          <div key={category.id}>
            <span>{category.name}</span>
            <strong>{category.rating}</strong>
          </div>
        ))}
      </section>
      <section className="profile-history">
        <div className="profile-section-title">
          <span>Recent battles</span>
          <strong>{history.length ? "Live stats" : "No battles yet"}</strong>
        </div>
        {recent.length ? (
          recent.map((entry) => (
            <article key={entry.id} className={entry.youWin ? "win" : "loss"}>
              <div>
                <strong>{entry.youWin ? "Won" : "Lost"} vs {entry.opponent}</strong>
                <span>{entry.categoryName} · {entry.mode}</span>
                <p>{entry.prompt || "Prompt details saved for future battles."}</p>
              </div>
              <b>{entry.points > 0 ? "+" : ""}{entry.points}</b>
            </article>
          ))
        ) : (
          <p className="empty-history">Play one round and your record starts here.</p>
        )}
      </section>
      <section className="cta-stack">
        <button className="primary-button lime" type="button" onClick={onFind}>Find opponent</button>
        <div className="split-actions">
          <button className="outline-button" type="button" onClick={onFriend}>Challenge friend</button>
          <button className="outline-button coral" type="button" onClick={onStreamer}>Streamer mode</button>
        </div>
        <div className="split-actions">
          <button className="outline-button" type="button" onClick={onAccount}>Account</button>
          <button className="outline-button" type="button" onClick={() => onLegal("terms")}>Terms</button>
        </div>
      </section>
    </main>
  );
}

function normalizeViewerAnswer(answer) {
  return {
    id: answer.id,
    name: answer.display_name ?? answer.name,
    text: answer.answer ?? answer.text,
  };
}

function StreamerScreen({ roomCode, category, scenario, roundIndex, setCategory, onHome, onViewer, onOfficial, onNextScenario }) {
  const [streamerAnswer, setStreamerAnswer] = useState(() => scenario.winningAnswer);
  const [answers, setAnswers] = useState(() => seedAnswersForScenario(scenario));
  const [selected, setSelected] = useState(() => seedAnswersForScenario(scenario)[0]);
  const [copied, setCopied] = useState(false);
  const [streamStatus, setStreamStatus] = useState("Viewer answers are free until selected.");
  const [roundNumber, setRoundNumber] = useState(1);
  const currentScenario = scenario;

  useEffect(() => {
    const seededAnswers = seedAnswersForScenario(currentScenario);
    setStreamerAnswer(currentScenario.winningAnswer);
    setAnswers(seededAnswers);
    setSelected(seededAnswers[0]);
  }, [currentScenario]);

  useEffect(() => {
    let cancelled = false;

    createStreamerRoom({
      roomCode,
      roomName: "Kai's room",
      categoryId: category.id,
      currentPrompt: currentScenario.prompt,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.skipped) {
          setStreamStatus("Viewer answers are live for this room. No AI cost until selected.");
          return;
        }
        if (result.error) {
          setStreamStatus("Viewer room is running in local mode.");
          return;
        }
        setStreamStatus("Viewer room is live. Answers appear here without AI cost.");
      })
      .catch((error) => {
        console.warn("Streamer room sync failed", error);
        if (!cancelled) setStreamStatus("Viewer room is running in local mode.");
      });

    return () => {
      cancelled = true;
    };
  }, [roomCode, category.id, currentScenario.prompt]);

  useEffect(() => {
    const subscription = subscribeToStreamerAnswers(roomCode, (payload) => {
      const nextAnswer = normalizeViewerAnswer(payload.new);
      if (!nextAnswer.id || payload.new?.hidden) return;

      setAnswers((current) => {
        const withoutExisting = current.filter((answer) => answer.id !== nextAnswer.id);
        return [nextAnswer, ...withoutExisting].slice(0, 24);
      });
    });

    return () => subscription.unsubscribe();
  }, [roomCode]);

  function copyViewerLink() {
    const link = streamerViewerLink(roomCode);
    setCopied(true);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
  }

  function hideAnswer(id) {
    setAnswers((current) => current.filter((answer) => answer.id !== id));
    updateStreamerAnswerState({ answerId: id, hidden: true }).catch((error) => {
      console.warn("Streamer answer hide failed", error);
    });
    if (selected?.id === id) {
      setSelected(answers.find((answer) => answer.id !== id) ?? null);
    }
  }

  function showAnswer(answer) {
    setSelected(answer);
    updateStreamerAnswerState({ answerId: answer.id, selectedForStream: true }).catch((error) => {
      console.warn("Streamer answer show failed", error);
    });
  }

  function pickOfficial(answer) {
    updateStreamerAnswerState({ answerId: answer.id, selectedForOfficialBattle: true }).catch((error) => {
      console.warn("Streamer official pick failed", error);
    });
    onOfficial(streamerAnswer, answer);
  }

  function startNextRound() {
    const currentIndex = categories.findIndex((item) => item.id === category.id);
    const nextCategory = categories[(currentIndex + 1) % categories.length];
    const nextScenario = getScenario(nextCategory.id, roundIndex + 1);
    setCategory(nextCategory);
    onNextScenario(nextCategory.id);
    setRoundNumber((value) => value + 1);
    setStreamerAnswer(nextScenario.winningAnswer);
    setStreamStatus("New round live. Viewer answers stay free until selected.");
  }

  return (
    <main className="streamer-shell">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="stream-top">
        <div>
          <span className="live-pill">Live room</span>
          <h1>Chat gets judged</h1>
          <p>Room {roomCode}. 241 viewers. {streamStatus}</p>
        </div>
        <div className="stream-actions">
          <button className="outline-button" type="button" onClick={copyViewerLink}>
            <Copy size={20} />
            {copied ? "Copied link" : "Viewer link"}
          </button>
          <button className="outline-button" type="button" onClick={onViewer}>
            <Users size={20} />
            Preview viewer
          </button>
          <button className="primary-button lime small" type="button" onClick={startNextRound}>
            Start round
          </button>
        </div>
      </section>
      <section className="stream-grid">
        <div className="stream-main">
          <div className="stream-meta">
            <span>{category.name}</span>
            <strong>18s</strong>
          </div>
          <h2>{currentScenario.prompt}</h2>
          <div className="stream-category-row" aria-label="Streamer category">
            {categories.map((item) => (
              <button
                key={item.id}
                className={item.id === category.id ? "active" : ""}
                type="button"
                onClick={() => {
                  const nextScenario = getScenario(item.id, roundIndex + 1);
                  setCategory(item);
                  onNextScenario(item.id);
                  setRoundNumber((value) => value + 1);
                  setStreamerAnswer(nextScenario.winningAnswer);
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="room-code-card">
            <span>Viewer code</span>
            <strong>{roomCode}</strong>
            <small>{streamerViewerLink(roomCode)}</small>
          </div>
          <label>
            Streamer answer - round {roundNumber}
            <textarea
              value={streamerAnswer}
              maxLength={MAX_CHARS}
              onChange={(event) => setStreamerAnswer(clampAnswer(event.target.value))}
            />
          </label>
        </div>
        <aside className="viewer-panel">
          <h2>Viewer answers</h2>
          {answers.map((answer) => (
            <article key={answer.id} className={selected?.id === answer.id ? "selected" : ""}>
              <strong>{answer.name}</strong>
              <p>{answer.text}</p>
              <div>
                <button type="button" onClick={() => showAnswer(answer)}>Show</button>
                <button type="button" onClick={() => hideAnswer(answer.id)}>Hide</button>
                <button type="button" onClick={() => pickOfficial(answer)}>Pick official</button>
              </div>
            </article>
          ))}
        </aside>
        <section className="broadcast-preview">
          <span>Showing on stream</span>
          <h2>{selected?.text ?? "Pick a viewer answer to show live."}</h2>
          <button className="primary-button judge small" type="button" onClick={() => selected && pickOfficial(selected)}>
            Official battle
          </button>
        </section>
      </section>
    </main>
  );
}

function ViewerScreen({ roomCode, category, scenario, onHome }) {
  const [name, setName] = useState("Viewer 27");
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [roomState, setRoomState] = useState(() => ({
    roomName: "Kai's room",
    category,
    prompt: scenario.prompt,
  }));
  const [roomStatus, setRoomStatus] = useState("Connected to the live room.");
  const { isListening, voiceStatus, toggleListening, voiceSupported } = useVoiceInput(setAnswer);

  useEffect(() => {
    let cancelled = false;

    getStreamerRoom(roomCode)
      .then((result) => {
        if (cancelled) return;
        if (result.skipped) {
          setRoomStatus("Preview mode. Viewer answers still submit when the room is live.");
          return;
        }
        if (result.error) {
          setRoomStatus("Could not refresh room state. Showing the invite preview.");
          return;
        }
        const nextState = normalizeStreamerRoom(result.room);
        if (nextState) {
          setRoomState(nextState);
          setRoomStatus("Synced with the streamer room.");
        } else {
          setRoomStatus("Room not live yet. Waiting for the streamer.");
        }
      })
      .catch((error) => {
        console.warn("Streamer room lookup failed", error);
        if (!cancelled) setRoomStatus("Could not refresh room state. Showing the invite preview.");
      });

    const subscription = subscribeToStreamerRoom(roomCode, (payload) => {
      const nextState = normalizeStreamerRoom(payload.new);
      if (!nextState) return;
      setRoomState(nextState);
      setSubmitted(false);
      setAnswer("");
      setRoomStatus("New streamer round is live.");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [roomCode]);

  function submitViewerAnswer() {
    setSubmitted(true);
    recordViewerSubmission({
      roomCode,
      displayName: name,
      answer,
    }).catch((error) => {
      console.warn("Viewer answer persistence failed", error);
    });
  }

  return (
    <main className="screen viewer-screen">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="room-hero">
        <span className="live-pill">Live</span>
        <h1>{roomState.roomName}</h1>
        <p>Room {roomCode}. 241 viewers. {roomStatus}</p>
      </section>
      <section className="scenario-card">
        <span className="section-label">{roomState.category.name}</span>
        <h1>{roomState.prompt}</h1>
      </section>
      <section className="viewer-form">
        <label>
          Display name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Your answer
          <textarea
            value={answer}
            maxLength={MAX_CHARS}
            disabled={submitted}
            onChange={(event) => setAnswer(clampAnswer(event.target.value))}
            placeholder="Submit something stream-worthy..."
          />
          <span>{answer.length}/{MAX_CHARS}</span>
        </label>
        <button
          className={`voice-button wide ${isListening ? "listening" : ""}`}
          type="button"
          disabled={submitted || !voiceSupported}
          onClick={toggleListening}
        >
          {isListening ? <MicOff size={19} /> : <Mic size={19} />}
          {isListening ? "Stop voice input" : "Speak answer"}
        </button>
        {voiceStatus ? <p className={`voice-status ${isListening ? "active" : ""}`}>{voiceStatus}</p> : null}
        <button className="primary-button lime" type="button" disabled={submitted || answer.trim().length === 0} onClick={submitViewerAnswer}>
          <Send size={24} />
          {submitted ? "Answer submitted" : "Submit to streamer"}
        </button>
        <p>Shown to the streamer. Not AI judged unless selected.</p>
      </section>
    </main>
  );
}

export function App() {
  const initialRoute = useMemo(() => parseInitialPath(window.location.pathname), []);
  const [screen, setScreen] = useState(initialRoute.screen);
  const [selectedCategory, setSelectedCategory] = useState(categories[5]);
  const [scenarioRound, setScenarioRound] = useState(0);
  const [friendRoomCode, setFriendRoomCode] = useState(
    initialRoute.screen === "friend" ? initialRoute.roomCode : DEFAULT_FRIEND_ROOM,
  );
  const [streamRoomCode, setStreamRoomCode] = useState(
    initialRoute.screen === "viewer" ? initialRoute.roomCode : DEFAULT_STREAM_ROOM,
  );
  const [matchElapsed, setMatchElapsed] = useState(0);
  const [timer, setTimer] = useState(24);
  const [answer, setAnswer] = useState("");
  const [rating, setRating] = useState(() => readStoredNumber("rating", 1128));
  const [streak, setStreak] = useState(() => readStoredNumber("streak", 3));
  const [lastStreakPlayDate, setLastStreakPlayDate] = useState(() => readStoredJson("streak-last-play-date", ""));
  const [battleAllowanceDate, setBattleAllowanceDate] = useState(() => readStoredJson("battles-left-date", todayKey()));
  const [battlesLeft, setBattlesLeft] = useState(() => {
    const storedDate = readStoredJson("battles-left-date", "");
    const storedBattlesLeft = readStoredNumber("battles-left", DAILY_RANKED_BATTLES);
    return resolveDailyBattlesLeft({ storedDate, storedBattlesLeft, today: todayKey() });
  });
  const [rewardClaimDate, setRewardClaimDate] = useState(() => {
    const storedDate = readStoredJson("reward-claim-date", "");
    if (storedDate) return storedDate;
    return readStoredJson("reward-claimed", false) ? todayKey() : "";
  });
  const [battleHistory, setBattleHistory] = useState(() => readStoredJson("battle-history", []));
  const [categoryRatings, setCategoryRatings] = useState(() =>
    readStoredJson("category-ratings", initialCategoryRatings()),
  );
  const [user, setUser] = useState(() => readStoredJson("user", null));
  const [authStatus, setAuthStatus] = useState(
    initialRoute.authCallback
      ? "Checking your sign-in session..."
      : hasSupabaseConfig
        ? "Google sign-in and email login are ready."
        : "Demo profile is available. Supabase Auth is not configured locally.",
  );
  const [legalType, setLegalType] = useState(initialRoute.legalType ?? "terms");
  const [result, setResult] = useState(null);
  const [friendJoined, setFriendJoined] = useState(false);
  const [friendPersistence, setFriendPersistence] = useState(initialRoute.screen === "friend" ? "checking" : "fallback");
  const [friendRole, setFriendRole] = useState(initialRoute.screen === "friend" ? "guest" : "host");
  const [friendRoom, setFriendRoom] = useState(null);
  const [friendPresenceId, setFriendPresenceId] = useState(null);
  const [friendStatus, setFriendStatus] = useState("Send the link. Same prompt, 30s answers, AI verdict.");
  const [battleMode, setBattleMode] = useState(initialRoute.screen === "friend" ? "friend" : "ranked");
  const [botName, setBotName] = useState(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState("Opening the judge queue...");
  const [rankedRoom, setRankedRoom] = useState(null);
  const [rankedPresenceId, setRankedPresenceId] = useState(null);
  const isJudgingRef = useRef(false);
  const narratedResultRef = useRef(null);
  const completedResultRef = useRef(null);

  const botReady = matchElapsed >= 5;
  const currentScenario = getScenario(selectedCategory.id, scenarioRound);
  const rewardClaimed = rewardClaimDate === todayKey();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  }, [screen]);

  useEffect(() => {
    writeStoredJson("user", user);
  }, [user]);

  useEffect(() => {
    writeStoredJson("rating", rating);
  }, [rating]);

  useEffect(() => {
    writeStoredJson("streak", streak);
    writeStoredJson("streak-last-play-date", lastStreakPlayDate);
  }, [streak, lastStreakPlayDate]);

  useEffect(() => {
    writeStoredJson("battles-left", battlesLeft);
    writeStoredJson("battles-left-date", battleAllowanceDate);
  }, [battlesLeft, battleAllowanceDate]);

  useEffect(() => {
    writeStoredJson("reward-claim-date", rewardClaimDate);
    writeStoredJson("reward-claimed", rewardClaimDate === todayKey());
  }, [rewardClaimDate]);

  useEffect(() => {
    writeStoredJson("battle-history", battleHistory);
  }, [battleHistory]);

  useEffect(() => {
    writeStoredJson("category-ratings", categoryRatings);
  }, [categoryRatings]);

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    const authCode = new URLSearchParams(window.location.search).get("code");

    if (initialRoute.authCallback && authCode) {
      setAuthStatus("Finishing Google sign-in...");
      supabase.auth.exchangeCodeForSession(authCode).then(({ error }) => {
        if (cancelled) return;
        if (error) {
          setAuthStatus(`Google sign-in failed: ${error.message}`);
          return;
        }
        window.history.replaceState({}, "", "/account");
        setAuthStatus("Signed in with Google.");
      });
    } else if (initialRoute.authCallback) {
      setAuthStatus("Checking your sign-in session...");
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session?.user) {
        if (initialRoute.authCallback) setAuthStatus("No active sign-in session found. Try Google again.");
        return;
      }
      const nextUser = data.session.user;
      setUser({
        name: nextUser.user_metadata?.full_name || nextUser.email?.split("@")[0] || "Player",
        email: nextUser.email,
        avatarUrl: nextUser.user_metadata?.avatar_url,
      });
      setAuthStatus("Signed in with Google.");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setAuthStatus("Signed out.");
        }
        return;
      }
      setUser({
        name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Player",
        email: session.user.email,
        avatarUrl: session.user.user_metadata?.avatar_url,
      });
      setAuthStatus("Signed in with Google.");
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (screen !== "matchmaking") return undefined;
    const interval = window.setInterval(() => setMatchElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    if (screen !== "matchmaking" || battleMode !== "ranked") return undefined;

    let cancelled = false;
    let subscription = { unsubscribe: () => {} };
    const scenario = currentScenario;

    findOrCreateRankedMatch({
      category: selectedCategory,
      prompt: scenario.prompt,
      playerName: "You",
    })
      .then((match) => {
        if (cancelled) return;

        if (match.skipped) {
          setMatchmakingStatus("Queue is quiet. A quick battle is ready.");
          return;
        }

        if (match.error) {
          setMatchmakingStatus("Queue is taking too long. A quick battle is ready.");
          return;
        }

        if (match.matched && match.room) {
          const opponentName =
            match.room.host_presence_id === match.playerPresenceId ? match.room.guest_name : match.room.host_name;
          setRankedRoom(match.room);
          setRankedPresenceId(match.playerPresenceId);
          setMatchmakingStatus("Real player matched. Starting battle...");
          window.setTimeout(() => startBattle("ranked", opponentName), 450);
          return;
        }

        setMatchmakingStatus("Live queue open. Waiting for another player...");
        subscription = subscribeToRankedTicket(match.ticket?.id, async (payload) => {
          const roomId = payload.new?.battle_room_id;
          if (!roomId) return;

          const nextRoom = await getRankedBattleRoom(roomId);
          if (cancelled || !nextRoom.room) return;

          setRankedRoom(nextRoom.room);
          setRankedPresenceId(match.playerPresenceId);
          setMatchmakingStatus("Real player matched. Starting battle...");
          const opponentName =
            nextRoom.room.host_presence_id === match.playerPresenceId ? nextRoom.room.guest_name : nextRoom.room.host_name;
          window.setTimeout(() => startBattle("ranked", opponentName), 450);
        });
      })
      .catch((error) => {
        console.warn("Ranked matchmaking failed", error);
        if (!cancelled) setMatchmakingStatus("Queue is taking too long. A quick battle is ready.");
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [screen, battleMode, selectedCategory, currentScenario]);

  useEffect(() => {
    if (!["battle", "waiting"].includes(screen)) return undefined;
    if (timer <= 0) {
      finishRound();
      return undefined;
    }
    const interval = window.setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [screen, timer]);

  useEffect(() => {
    if (screen !== "friend" || friendPersistence !== "fallback" || friendRole !== "host") return undefined;
    const timeout = window.setTimeout(() => setFriendJoined(true), 1800);
    return () => window.clearTimeout(timeout);
  }, [screen, friendPersistence, friendRole]);

  useEffect(() => {
    if (screen !== "friend" || friendPersistence !== "checking") return undefined;

    let cancelled = false;
    const scenario = currentScenario;
    const action =
      friendRole === "host"
        ? createFriendBattleRoom({
            roomCode: friendRoomCode,
            category: selectedCategory,
            prompt: scenario.prompt,
            hostName: "You",
          })
        : joinFriendBattleRoom({ roomCode: friendRoomCode, guestName: "Friend" });

    action
      .then((result) => {
        if (cancelled) return;

        if (result.skipped) {
          setFriendPersistence("fallback");
          setFriendJoined(false);
          setFriendStatus(
            friendRole === "host"
              ? "Send the link. Same prompt, 30s answers, AI verdict."
              : "Room is not live yet. Waiting for the host.",
          );
          return;
        }

        if (result.missing) {
          setFriendPersistence("fallback");
          setFriendJoined(false);
          setFriendStatus("Room is not live yet. Showing the invite preview.");
          return;
        }

        if (result.error) {
          setFriendPersistence("fallback");
          setFriendJoined(false);
          setFriendStatus("Friend room is running in preview mode.");
          return;
        }

        setFriendPersistence("real");
        setFriendRoom(result.room);
        setFriendPresenceId(result.playerPresenceId);
        setFriendJoined(Boolean(result.room?.guest_presence_id));
        setFriendStatus(
          result.room?.guest_presence_id
            ? "Friend joined. Same prompt, 30s answers, AI verdict."
            : "Room is live. Send the link and wait for your friend.",
        );
      })
      .catch((error) => {
        console.warn("Friend room sync failed", error);
        if (!cancelled) {
          setFriendPersistence("fallback");
          setFriendStatus("Friend room is running in preview mode.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [screen, friendPersistence, friendRole, friendRoomCode, selectedCategory, currentScenario]);

  useEffect(() => {
    if (screen !== "friend" || friendPersistence !== "real") return undefined;

    const subscription = subscribeToFriendRoom(friendRoomCode, (payload) => {
      const room = payload.new;
      setFriendRoom(room);
      setFriendJoined(Boolean(room?.guest_presence_id));
      setFriendStatus(
        room?.guest_presence_id
          ? "Friend joined. Same prompt, 30s answers, AI verdict."
          : "Room is live. Send the link and wait for your friend.",
      );
    });

    return () => subscription.unsubscribe();
  }, [screen, friendPersistence, friendRoomCode]);

  useEffect(() => {
    if (screen !== "waiting" || !rankedRoom?.id) return undefined;

    const subscription = subscribeToRankedBattle(rankedRoom.id, (payload) => {
      const room = payload.new;
      setRankedRoom(room);
      handleSyncedBattleRoom("ranked", room);
    });

    handleSyncedBattleRoom("ranked", rankedRoom);
    return () => subscription.unsubscribe();
  }, [screen, rankedRoom?.id]);

  useEffect(() => {
    if (screen !== "waiting" || battleMode !== "friend" || friendPersistence !== "real") return undefined;

    const subscription = subscribeToFriendRoom(friendRoomCode, (payload) => {
      const room = payload.new;
      setFriendRoom(room);
      handleSyncedBattleRoom("friend", room);
    });

    if (friendRoom) handleSyncedBattleRoom("friend", friendRoom);
    return () => subscription.unsubscribe();
  }, [screen, battleMode, friendPersistence, friendRoomCode, friendRoom?.room_code]);

  useEffect(() => {
    if (screen !== "result" || !result) return;
    const resultKey = `${result.mode}:${result.category.id}:${result.yourAnswer}:${result.opponentAnswer}:${result.youWin}`;
    if (narratedResultRef.current === resultKey) return;
    narratedResultRef.current = resultKey;
    window.setTimeout(() => speakVerdict(result), 180);
  }, [screen, result]);

  const rankedBots = useMemo(() => bots, []);
  const fallbackBots = useMemo(() => recommendedBotsForCategory(selectedCategory.id), [selectedCategory.id]);

  function goHome() {
    resetPath();
    setScreen("home");
    setAnswer("");
    setTimer(24);
    setMatchElapsed(0);
    setFriendJoined(false);
    setFriendPersistence("fallback");
    setFriendRoom(null);
    setFriendPresenceId(null);
    setFriendStatus("Send the link. Same prompt, 30s answers, AI verdict.");
    setRankedRoom(null);
    setRankedPresenceId(null);
    isJudgingRef.current = false;
  }

  function openLegal(type = "terms") {
    setLegalType(type);
    setAppPath("legal", type);
    setScreen("legal");
  }

  function openScreen(nextScreen) {
    setAppPath(nextScreen);
    setScreen(nextScreen);
  }

  function nextScenario(categoryId = selectedCategory.id) {
    setScenarioRound((current) => randomScenarioRound(categoryId, current));
  }

  function queueFreshScenario(categoryId = selectedCategory.id) {
    setScenarioRound((current) => randomScenarioRound(categoryId, current));
  }

  function claimStreakReward() {
    if (rewardClaimed) return;
    setRewardClaimDate(todayKey());
    setBattleAllowanceDate(todayKey());
    setBattlesLeft((current) => current + 1);
  }

  async function signInWithGoogle() {
    if (!hasSupabaseConfig || !supabase) {
      setUser({ name: "Demo Player", email: "demo@judgemebro.com", avatarUrl: "/assets/avatar-you.png" });
      setAuthStatus("Google OAuth needs Supabase Auth config. Demo profile is active for now.");
      return;
    }

    setAuthStatus("Opening Google sign-in...");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setAuthStatus(`Google sign-in failed: ${error.message}`);
  }

  async function emailAuth({ mode, name, email, password }) {
    const cleanEmail = email.trim();
    const cleanName = name.trim();
    if (!cleanEmail || !password) {
      setAuthStatus("Enter an email and password first.");
      return;
    }

    if (!hasSupabaseConfig || !supabase) {
      setUser({
        name: cleanName || cleanEmail.split("@")[0] || "Demo Player",
        email: cleanEmail,
        avatarUrl: "/assets/avatar-you.png",
      });
      setAuthStatus("Supabase Auth is not configured locally, so this account is saved as a demo profile.");
      return;
    }

    setAuthStatus(mode === "register" ? "Creating account..." : "Logging in...");
    const authCall =
      mode === "register"
        ? supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: { full_name: cleanName || cleanEmail.split("@")[0] },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : supabase.auth.signInWithPassword({ email: cleanEmail, password });

    const { data, error } = await authCall;
    if (error) {
      setAuthStatus(`${mode === "register" ? "Registration" : "Login"} failed: ${error.message}`);
      return;
    }

    if (data.user) {
      setUser({
        name: data.user.user_metadata?.full_name || cleanEmail.split("@")[0] || "Player",
        email: data.user.email || cleanEmail,
        avatarUrl: data.user.user_metadata?.avatar_url || "/assets/avatar-you.png",
      });
    }
    setAuthStatus(mode === "register" ? "Account created. Check email if confirmation is required." : "Logged in.");
  }

  function signInDemo() {
    setUser({ name: "Demo Player", email: "demo@judgemebro.com", avatarUrl: "/assets/avatar-you.png" });
    setAuthStatus("Demo profile active. Google can be connected in Supabase Auth.");
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setAuthStatus("Signed out.");
  }

  function latestAnswerFor(answers, presenceId) {
    return answers.find((item) => item.player_presence_id === presenceId) ?? null;
  }

  function applyCompletedResult(nextResult, { persist = true } = {}) {
    if (completedResultRef.current) return;
    completedResultRef.current = nextResult;
    setResult(nextResult);
    if (persist) {
      recordBattleResult(nextResult).catch((error) => {
        console.warn("Battle result persistence failed", error);
      });
    }
    setRating((current) => current + nextResult.points);
    setCategoryRatings((current) => ({
      ...current,
      [nextResult.category.id]: Math.max(
        0,
        (current[nextResult.category.id] ?? 1000) + (nextResult.youWin ? 16 : -14),
      ),
    }));
    setBattleHistory((current) => [buildHistoryEntry(nextResult), ...current].slice(0, 20));
    setBattlesLeft((current) => Math.max(0, current - (nextResult.mode === "bot" ? 0 : 1)));
    if (nextResult.mode !== "bot" && nextResult.mode !== "streamer") {
      const today = todayKey();
      setStreak((current) =>
        resolveStreakAfterBattle({
          currentStreak: current,
          lastPlayedDate: lastStreakPlayDate,
          today,
        }),
      );
      setLastStreakPlayDate(today);
    }
    setScenarioRound((current) => randomScenarioRound(selectedCategory.id, current));
    isJudgingRef.current = false;
    setScreen("result");
  }

  async function handleJudgedRoom(mode, room) {
    if (completedResultRef.current) return;
    const localPresenceId = mode === "friend" ? friendPresenceId ?? getPlayerPresenceId() : rankedPresenceId ?? getPlayerPresenceId();
    const answersResult =
      mode === "friend" ? await getFriendBattleAnswers(room.room_code) : await getRankedBattleAnswers(room.id);
    const answers = answersResult.answers ?? [];
    const localAnswer = latestAnswerFor(answers, localPresenceId);
    const opponentPresenceId = room.host_presence_id === localPresenceId ? room.guest_presence_id : room.host_presence_id;
    const opponentAnswer = latestAnswerFor(answers, opponentPresenceId);
    const opponentName = room.host_presence_id === localPresenceId ? room.guest_name || "Friend" : room.host_name || "Opponent";
    const youWin = room.ai_winner_presence_id === localPresenceId;
    const points = Math.abs(room.point_delta || 18) * (youWin ? 1 : -1);

    applyCompletedResult(
      {
        mode,
        category: selectedCategory,
        prompt: room.prompt || currentScenario.prompt,
        opponent: opponentName,
        yourAnswer: localAnswer?.answer || answer || "No answer submitted.",
        opponentAnswer: opponentAnswer?.answer || "No answer submitted.",
        youWin,
        points,
        reason: room.ai_reason || "The AI judge picked the stronger answer.",
        judgeSource: "synced-room",
      },
      { persist: true },
    );
  }

  async function handleSyncedBattleRoom(mode, room) {
    if (!room || completedResultRef.current) return;
    if (room.status === "judged") {
      await handleJudgedRoom(mode, room);
      return;
    }
    const readyToJudge = room.host_submitted && room.guest_submitted && ["active", "judging"].includes(room.status);
    if (!readyToJudge) return;

    const localPresenceId = mode === "friend" ? friendPresenceId ?? getPlayerPresenceId() : rankedPresenceId ?? getPlayerPresenceId();
    if (room.host_presence_id !== localPresenceId) return;

    const answersResult =
      mode === "friend" ? await getFriendBattleAnswers(room.room_code) : await getRankedBattleAnswers(room.id);
    const answers = answersResult.answers ?? [];
    const hostAnswer = latestAnswerFor(answers, room.host_presence_id);
    const guestAnswer = latestAnswerFor(answers, room.guest_presence_id);
    if (!hostAnswer || !guestAnswer) return;

    await finishRound({
      room,
      yourAnswer: hostAnswer.answer,
      opponentAnswer: guestAnswer.answer,
      opponent: room.guest_name || "Friend",
    });
  }

  function startMatchmaking() {
    if (!canStartRatedBattle("ranked", battlesLeft)) {
      setAppPath("rewards");
      setScreen("rewards");
      return;
    }

    resetPath();
    queueFreshScenario(selectedCategory.id);
    setBattleAllowanceDate(todayKey());
    setScreen("matchmaking");
    setMatchElapsed(0);
    setBattleMode("ranked");
    setBotName(null);
    setRankedRoom(null);
    setRankedPresenceId(getPlayerPresenceId());
    setMatchmakingStatus("Opening the judge queue...");
  }

  function startBattle(mode = "ranked", nextBotName = null) {
    resetPath();
    setBattleMode(mode);
    setBotName(nextBotName);
    setTimer(24);
    setAnswer("");
    setResult(null);
    narratedResultRef.current = null;
    completedResultRef.current = null;
    isJudgingRef.current = false;
    setScreen("battle");
  }

  function submitAnswer() {
    if (answer.trim().length === 0) return;
    if (battleMode === "bot") {
      finishRound();
      return;
    }
    if (rankedRoom) {
      submitRankedBattleAnswer({ room: rankedRoom, answer }).catch((error) => {
        console.warn("Ranked answer submit failed", error);
      });
    }
    if (battleMode === "friend") {
      submitFriendBattleAnswer({
        roomCode: friendRoomCode,
        answer,
        playerName: "You",
      }).catch((error) => {
        console.warn("Friend answer submit failed", error);
      });
    }
    setScreen("waiting");
    if (!rankedRoom && !(battleMode === "friend" && friendPersistence === "real")) {
      window.setTimeout(() => finishRound(), 1600);
    }
  }

  async function finishRound(options = {}) {
    if (isJudgingRef.current || completedResultRef.current) return;
    isJudgingRef.current = true;
    const scenario = currentScenario;
    const nextResult = await requestJudgeVerdict({
      category: selectedCategory,
      prompt: options.room?.prompt ?? scenario.prompt,
      yourAnswer: options.yourAnswer ?? answer,
      opponentAnswer: options.opponentAnswer ?? (battleMode === "bot" ? getBotAnswer(botName, scenario) : scenario.opponentAnswer),
      mode: battleMode,
      opponent: options.opponent ?? botName ?? "Juno",
    });
    const roomForRanked = options.room ?? rankedRoom;
    const roomForFriend = options.room ?? friendRoom;
    if (roomForRanked && battleMode === "ranked") {
      const localPresenceId = rankedPresenceId ?? getPlayerPresenceId();
      const opponentPresenceId =
        roomForRanked.host_presence_id === localPresenceId ? roomForRanked.guest_presence_id : roomForRanked.host_presence_id;
      const winnerPresenceId = nextResult.youWin ? localPresenceId : opponentPresenceId;
      markRankedBattleJudged({
        roomId: roomForRanked.id,
        winnerPresenceId,
        reason: nextResult.reason,
        pointDelta: nextResult.points,
      }).catch((error) => {
        console.warn("Ranked verdict persistence failed", error);
      });
    }
    if (battleMode === "friend" && roomForFriend) {
      const localPresenceId = friendPresenceId ?? getPlayerPresenceId();
      const opponentPresenceId =
        roomForFriend.host_presence_id === localPresenceId ? roomForFriend.guest_presence_id : roomForFriend.host_presence_id;
      const winnerPresenceId = nextResult.youWin ? localPresenceId : opponentPresenceId;
      markFriendBattleJudged({
        roomCode: friendRoomCode,
        winnerPresenceId,
        reason: nextResult.reason,
        pointDelta: nextResult.points,
      }).catch((error) => {
        console.warn("Friend verdict persistence failed", error);
      });
    }
    applyCompletedResult(nextResult);
  }

  function startFriend() {
    const nextRoomCode = createRoomCode();
    updatePath(friendBattlePath(nextRoomCode));
    queueFreshScenario(selectedCategory.id);
    setFriendRoomCode(nextRoomCode);
    setFriendJoined(false);
    setFriendPersistence("checking");
    setFriendRole("host");
    setFriendRoom(null);
    setFriendPresenceId(getPlayerPresenceId());
    setFriendStatus("Creating friend room...");
    setBattleMode("friend");
    setScreen("friend");
  }

  function startStreamer() {
    resetPath();
    setStreamRoomCode(createRoomCode());
    setSelectedCategory(categories[1]);
    setScenarioRound(randomScenarioRound(categories[1].id));
    setScreen("streamer");
  }

  async function officialStreamerBattle(streamerAnswer, viewerAnswer) {
    if (isJudgingRef.current) return;
    isJudgingRef.current = true;
    const nextResult = await requestJudgeVerdict({
      mode: "streamer",
      category: selectedCategory,
      opponent: viewerAnswer.name,
      prompt: currentScenario.prompt,
      yourAnswer: streamerAnswer,
      opponentAnswer: viewerAnswer.text,
    });
    setResult(nextResult);
    recordBattleResult(nextResult).catch((error) => {
      console.warn("Streamer battle persistence failed", error);
    });
    isJudgingRef.current = false;
    setScreen("result");
  }

  if (screen === "matchmaking") {
    return (
      <MatchmakingScreen
        category={selectedCategory}
        elapsed={matchElapsed}
        botReady={botReady}
        matchmakingStatus={matchmakingStatus}
        botChoices={fallbackBots}
        onCancel={goHome}
        onBattle={() => startBattle("ranked")}
        onBot={(nextBotName) => startBattle("bot", nextBotName)}
        onFriend={startFriend}
      />
    );
  }

  if (screen === "battle") {
    return (
      <BattleScreen
        category={selectedCategory}
        scenario={currentScenario}
        timer={timer}
        answer={answer}
        setAnswer={setAnswer}
        rating={rating}
        onSubmit={submitAnswer}
        onLeave={goHome}
        opponent={botName ?? "Juno"}
        opponentRating={botName ? "Bot" : "1135"}
      />
    );
  }

  if (screen === "waiting") {
    return <WaitingScreen timer={timer} category={selectedCategory} onForceResult={finishRound} />;
  }

  if (screen === "result" && result) {
    return (
      <ResultScreen
        result={result}
        rating={rating}
        battlesLeft={battlesLeft}
        onRematch={() => {
          if (result.mode === "streamer") {
            setScreen("streamer");
            return;
          }
          startBattle(result.mode, botName);
        }}
        onRewards={() => openScreen("rewards")}
        onNew={startMatchmaking}
        onHome={goHome}
      />
    );
  }

  if (screen === "friend") {
    return (
      <FriendBattleScreen
        category={selectedCategory}
        scenario={currentScenario}
        joined={friendJoined}
        roomCode={friendRoomCode}
        status={friendStatus}
        onHome={goHome}
        onStart={() => startBattle("friend")}
        onBot={() => startBattle("bot", rankedBots[1].name)}
      />
    );
  }

  if (screen === "profile") {
    return (
      <ProfileScreen
        user={user}
        rating={rating}
        streak={streak}
        history={battleHistory}
        categoryRatings={categoryRatings}
        onHome={goHome}
        onFind={startMatchmaking}
        onFriend={startFriend}
        onStreamer={startStreamer}
        onAccount={() => openScreen("account")}
        onLegal={openLegal}
      />
    );
  }

  if (screen === "account") {
    return (
      <AccountScreen
        user={user}
        authStatus={authStatus}
        onGoogle={signInWithGoogle}
        onEmailAuth={emailAuth}
        onDemo={signInDemo}
        onSignOut={signOut}
        onHome={goHome}
        onProfile={() => openScreen("profile")}
        onLegal={openLegal}
      />
    );
  }

  if (screen === "rewards") {
    return (
      <RewardScreen
        streak={streak}
        battlesLeft={battlesLeft}
        rewardClaimed={rewardClaimed}
        rewardDate={rewardClaimDate || todayKey()}
        onClaim={claimStreakReward}
        onHome={goHome}
        onFind={startMatchmaking}
        onProfile={() => openScreen("profile")}
      />
    );
  }

  if (screen === "legal") {
    return <LegalScreen type={legalType} onHome={goHome} />;
  }

  if (screen === "streamer") {
    return (
      <StreamerScreen
        roomCode={streamRoomCode}
        category={selectedCategory}
        scenario={currentScenario}
        roundIndex={scenarioRound}
        setCategory={setSelectedCategory}
        onHome={goHome}
        onNextScenario={nextScenario}
        onViewer={() => {
          updatePath(streamerViewerPath(streamRoomCode));
          setScreen("viewer");
        }}
        onOfficial={officialStreamerBattle}
      />
    );
  }

  if (screen === "viewer") {
    return (
      <ViewerScreen
        roomCode={streamRoomCode}
        category={selectedCategory}
        scenario={currentScenario}
        onHome={() => {
          resetPath();
          setScreen("streamer");
        }}
      />
    );
  }

  return (
    <HomeScreen
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      rating={rating}
      battlesLeft={battlesLeft}
      streak={streak}
      onFind={startMatchmaking}
      onFriend={startFriend}
      onStreamer={startStreamer}
      onProfile={() => openScreen("profile")}
      onRewards={() => openScreen("rewards")}
      rewardClaimed={rewardClaimed}
    />
  );
}

function normalizeStreamerRoom(room) {
  if (!room) return null;
  const category = categories.find((item) => item.id === room.category_id) ?? categories[1];
  return {
    roomName: room.room_name || "Kai's room",
    category,
    prompt: room.current_prompt || getScenario(category.id).prompt,
  };
}

