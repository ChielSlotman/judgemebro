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
import { bots, categories, scenarios, viewerAnswers as seedViewerAnswers } from "./data.js";
import {
  createFriendBattleRoom,
  createStreamerRoom,
  findOrCreateRankedMatch,
  getPlayerPresenceId,
  getRankedBattleRoom,
  joinFriendBattleRoom,
  markFriendBattleJudged,
  markRankedBattleJudged,
  recordBattleResult,
  recordViewerSubmission,
  submitFriendBattleAnswer,
  submitRankedBattleAnswer,
  subscribeToFriendRoom,
  subscribeToRankedTicket,
  subscribeToStreamerAnswers,
  updateStreamerAnswerState,
} from "./lib/gameRepository.js";
import { requestJudgeVerdict } from "./lib/judgeClient.js";

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
const VOICE_SUPPORT =
  typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

function clampAnswer(value) {
  return value.slice(0, MAX_CHARS);
}

function getScenario(categoryId) {
  return scenarios[categoryId] ?? scenarios.social;
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

function parseInvitePath(pathname) {
  const friendMatch = pathname.match(/^\/battle\/([^/]+)\/?$/);
  if (friendMatch) return { screen: "friend", roomCode: friendMatch[1].toUpperCase() };

  const streamMatch = pathname.match(/^\/stream\/([^/]+)\/?$/);
  if (streamMatch) return { screen: "viewer", roomCode: streamMatch[1].toUpperCase() };

  return null;
}

function updatePath(path) {
  if (typeof window === "undefined") return;
  window.history.pushState({}, "", path);
}

function resetPath() {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, "", "/");
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
  const verdict = result.youWin ? "You win." : "You lose.";
  const points = result.mode === "bot" ? "Unranked bot battle." : `${result.points > 0 ? "Plus" : "Minus"} ${Math.abs(result.points)} points.`;
  const narration = `${verdict} ${points} ${result.reason}`;

  playHostedVerdict(narration).catch(() => {
    speakBrowserVerdict(narration);
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

function HomeScreen({ selectedCategory, setSelectedCategory, onFind, onFriend, onStreamer, onProfile }) {
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
            <strong>1128</strong>
            <span>Gold</span>
          </div>
        </div>
        <StatBlock icon={Bolt} value="4" label="Battles left today" />
        <StatBlock icon={Flame} value="3" label="Day streak" accent="coral" />
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

      <button className="reward-strip" type="button" onClick={onProfile}>
        <Gift size={34} />
        <span>
          <strong>3-day streak</strong>
          Keep it up to unlock your next reward.
        </span>
        <ChevronRight size={26} />
      </button>
    </main>
  );
}

function MatchmakingScreen({ category, elapsed, botReady, matchmakingStatus, onCancel, onBattle, onBot, onFriend }) {
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
            Enter real battle
          </button>
        ) : (
          <button className="primary-button muted" type="button" disabled>
            <Clock size={24} />
            Looking for a real player
          </button>
        )}
        <button className="outline-button" type="button" onClick={onFriend}>
          <LinkIcon size={22} />
          Send this battle to a friend
        </button>
        <button className="outline-button coral" type="button" disabled={!botReady} onClick={onBot}>
          <Bot size={22} />
          {botReady ? "Play a bot now" : "Bot fallback unlocks at 5s"}
        </button>
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel search
        </button>
      </section>
    </main>
  );
}

function BattleScreen({
  category,
  timer,
  answer,
  setAnswer,
  onSubmit,
  onLeave,
  opponent = "Juno",
  opponentRating = "1135",
}) {
  const scenario = getScenario(category.id);
  const { isListening, voiceStatus, toggleListening, voiceSupported } = useVoiceInput(setAnswer);

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
        <div className="timer-block">
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
            <strong>1128</strong>
            <span>Gold</span>
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
            <span>Gold</span>
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

function ResultScreen({ result, rating, onRematch, onNew, onHome, onShare }) {
  const delta = result.points > 0 ? `+${result.points}` : `${result.points}`;
  const newRating = rating;
  const resultMeta =
    result.mode === "bot"
      ? "unranked bot battle"
      : result.mode === "streamer"
        ? "streamer battle"
        : `new rating ${newRating} Gold`;

  return (
    <main className="screen result-screen">
      <BrandHeader onHome={onHome} compact />
      <section className={`verdict-hero ${result.youWin ? "win" : "loss"}`}>
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
        <button className="primary-button lime" type="button" onClick={onRematch}>
          <Bolt size={28} />
          Run it back
        </button>
        <div className="split-actions">
          <button className="outline-button" type="button" onClick={onNew}>
            New opponent
          </button>
          <button className="outline-button coral" type="button" onClick={onShare}>
            Share verdict
          </button>
          <button className="outline-button" type="button" onClick={() => speakVerdict(result)}>
            <Volume2 size={22} />
            Replay voice
          </button>
        </div>
      </section>
    </main>
  );
}

function FriendBattleScreen({ category, joined, roomCode, status, onHome, onStart, onBot }) {
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
            <span>1128 Gold, ready</span>
          </div>
        </div>
        <div className={`slot ${joined ? "ready" : ""}`}>
          <img src="/assets/avatar-juno.png" alt="" />
          <div>
            <strong>{joined ? "Maya joined" : "Friend joining..."}</strong>
            <span>{joined ? "1135 Gold, ready" : "Preview locked until both players enter"}</span>
          </div>
        </div>
      </section>
      <section className="scenario-card compact-scenario">
        <span className="section-label">{category.name}</span>
        <h1>{joined ? getScenario(category.id).prompt : "Dilemma unlocks when your friend joins."}</h1>
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

function ProfileScreen({ onHome, onFind, onFriend, onStreamer }) {
  return (
    <main className="screen profile-screen">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="profile-card">
        <img src="/assets/avatar-you.png" alt="Profile" />
        <h1>chiel</h1>
        <div className="profile-rating">
          <img src="/assets/rank-gold.svg" alt="" />
          <strong>1128</strong>
          <span>Gold</span>
        </div>
        <div className="rank-progress"><span /></div>
        <p>12W / 7L. Best category: Negotiation.</p>
      </section>
      <section className="category-ratings">
        {categories.map((category, index) => (
          <div key={category.id}>
            <span>{category.name}</span>
            <strong>{[1184, 1042, 970, 1210, 1105, 997, 1132][index]}</strong>
          </div>
        ))}
      </section>
      <section className="cta-stack">
        <button className="primary-button lime" type="button" onClick={onFind}>Find opponent</button>
        <div className="split-actions">
          <button className="outline-button" type="button" onClick={onFriend}>Challenge friend</button>
          <button className="outline-button coral" type="button" onClick={onStreamer}>Streamer mode</button>
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

function StreamerScreen({ roomCode, category, setCategory, onHome, onViewer, onOfficial }) {
  const [streamerAnswer, setStreamerAnswer] = useState(() => getScenario(category.id).winningAnswer);
  const [answers, setAnswers] = useState(seedViewerAnswers);
  const [selected, setSelected] = useState(seedViewerAnswers[0]);
  const [copied, setCopied] = useState(false);
  const [streamStatus, setStreamStatus] = useState("Viewer answers are free until selected.");
  const [roundNumber, setRoundNumber] = useState(1);
  const currentScenario = getScenario(category.id);

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
          setStreamStatus("Viewer answers stay local until Supabase env is connected.");
          return;
        }
        if (result.error) {
          setStreamStatus("Streamer room sync had an issue. Local viewer list is active.");
          return;
        }
        setStreamStatus("Supabase room live. Viewer answers appear here without AI cost.");
      })
      .catch((error) => {
        console.warn("Streamer room sync failed", error);
        if (!cancelled) setStreamStatus("Streamer room sync had an issue. Local viewer list is active.");
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
    onViewer();
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
    setCategory(nextCategory);
    setRoundNumber((value) => value + 1);
    setStreamerAnswer(getScenario(nextCategory.id).winningAnswer);
    setSelected(seedViewerAnswers[0]);
    setAnswers(seedViewerAnswers);
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
                  setCategory(item);
                  setRoundNumber((value) => value + 1);
                  setStreamerAnswer(getScenario(item.id).winningAnswer);
                }}
              >
                {item.name}
              </button>
            ))}
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

function ViewerScreen({ roomCode, category, onHome }) {
  const [name, setName] = useState("Viewer 27");
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { isListening, voiceStatus, toggleListening, voiceSupported } = useVoiceInput(setAnswer);
  const currentScenario = getScenario(category.id);

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
        <h1>Kai's room</h1>
        <p>Room {roomCode}. 241 viewers.</p>
      </section>
      <section className="scenario-card">
        <span className="section-label">{category.name}</span>
        <h1>{currentScenario.prompt}</h1>
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
  const initialInvite = useMemo(() => parseInvitePath(window.location.pathname), []);
  const [screen, setScreen] = useState(initialInvite?.screen ?? "home");
  const [selectedCategory, setSelectedCategory] = useState(categories[5]);
  const [friendRoomCode, setFriendRoomCode] = useState(
    initialInvite?.screen === "friend" ? initialInvite.roomCode : DEFAULT_FRIEND_ROOM,
  );
  const [streamRoomCode, setStreamRoomCode] = useState(
    initialInvite?.screen === "viewer" ? initialInvite.roomCode : DEFAULT_STREAM_ROOM,
  );
  const [matchElapsed, setMatchElapsed] = useState(0);
  const [timer, setTimer] = useState(24);
  const [answer, setAnswer] = useState("");
  const [rating, setRating] = useState(1128);
  const [result, setResult] = useState(null);
  const [friendJoined, setFriendJoined] = useState(initialInvite?.screen === "friend");
  const [friendPersistence, setFriendPersistence] = useState(initialInvite?.screen === "friend" ? "checking" : "fallback");
  const [friendRole, setFriendRole] = useState(initialInvite?.screen === "friend" ? "guest" : "host");
  const [friendRoom, setFriendRoom] = useState(null);
  const [friendPresenceId, setFriendPresenceId] = useState(null);
  const [friendStatus, setFriendStatus] = useState("Send the link. Same prompt, 30s answers, AI verdict.");
  const [battleMode, setBattleMode] = useState(initialInvite?.screen === "friend" ? "friend" : "ranked");
  const [botName, setBotName] = useState(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState("Opening real-player queue...");
  const [rankedRoom, setRankedRoom] = useState(null);
  const [rankedPresenceId, setRankedPresenceId] = useState(null);
  const isJudgingRef = useRef(false);
  const narratedResultRef = useRef(null);

  const botReady = matchElapsed >= 5;

  useEffect(() => {
    if (screen !== "matchmaking") return undefined;
    const interval = window.setInterval(() => setMatchElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    if (screen !== "matchmaking" || battleMode !== "ranked") return undefined;

    let cancelled = false;
    let subscription = { unsubscribe: () => {} };
    const scenario = getScenario(selectedCategory.id);

    findOrCreateRankedMatch({
      category: selectedCategory,
      prompt: scenario.prompt,
      playerName: "You",
    })
      .then((match) => {
        if (cancelled) return;

        if (match.skipped) {
          setMatchmakingStatus("Real queue waits for Supabase env. Prototype opponent is ready.");
          return;
        }

        if (match.error) {
          setMatchmakingStatus("Real queue had an issue. Prototype opponent is ready.");
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

        setMatchmakingStatus("Real Supabase queue open. Waiting for another player...");
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
        if (!cancelled) setMatchmakingStatus("Real queue had an issue. Prototype opponent is ready.");
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [screen, battleMode, selectedCategory]);

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
    if (screen !== "friend" || friendPersistence !== "fallback") return undefined;
    const timeout = window.setTimeout(() => setFriendJoined(true), 1800);
    return () => window.clearTimeout(timeout);
  }, [screen, friendPersistence]);

  useEffect(() => {
    if (screen !== "friend" || friendPersistence !== "checking") return undefined;

    let cancelled = false;
    const scenario = getScenario(selectedCategory.id);
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
          setFriendStatus("Send the link. Same prompt, 30s answers, AI verdict.");
          return;
        }

        if (result.missing) {
          setFriendPersistence("fallback");
          setFriendStatus("Room not found in Supabase yet. Showing prototype room.");
          return;
        }

        if (result.error) {
          setFriendPersistence("fallback");
          setFriendStatus("Friend room sync had an issue. Showing prototype room.");
          return;
        }

        setFriendPersistence("real");
        setFriendRoom(result.room);
        setFriendPresenceId(result.playerPresenceId);
        setFriendJoined(Boolean(result.room?.guest_presence_id));
        setFriendStatus(
          result.room?.guest_presence_id
            ? "Friend joined. Same prompt, 30s answers, AI verdict."
            : "Supabase room live. Send the link and wait for your friend.",
        );
      })
      .catch((error) => {
        console.warn("Friend room sync failed", error);
        if (!cancelled) {
          setFriendPersistence("fallback");
          setFriendStatus("Friend room sync had an issue. Showing prototype room.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [screen, friendPersistence, friendRole, friendRoomCode, selectedCategory]);

  useEffect(() => {
    if (screen !== "friend" || friendPersistence !== "real") return undefined;

    const subscription = subscribeToFriendRoom(friendRoomCode, (payload) => {
      const room = payload.new;
      setFriendRoom(room);
      setFriendJoined(Boolean(room?.guest_presence_id));
      setFriendStatus(
        room?.guest_presence_id
          ? "Friend joined. Same prompt, 30s answers, AI verdict."
          : "Supabase room live. Send the link and wait for your friend.",
      );
    });

    return () => subscription.unsubscribe();
  }, [screen, friendPersistence, friendRoomCode]);

  useEffect(() => {
    if (screen !== "result" || !result) return;
    const resultKey = `${result.mode}:${result.category.id}:${result.yourAnswer}:${result.opponentAnswer}:${result.youWin}`;
    if (narratedResultRef.current === resultKey) return;
    narratedResultRef.current = resultKey;
    window.setTimeout(() => speakVerdict(result), 180);
  }, [screen, result]);

  const rankedBots = useMemo(() => bots, []);

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

  function startMatchmaking() {
    setScreen("matchmaking");
    setMatchElapsed(0);
    setBattleMode("ranked");
    setBotName(null);
    setRankedRoom(null);
    setRankedPresenceId(getPlayerPresenceId());
    setMatchmakingStatus("Opening real-player queue...");
  }

  function startBattle(mode = "ranked", nextBotName = null) {
    setBattleMode(mode);
    setBotName(nextBotName);
    setTimer(24);
    setAnswer("");
    setResult(null);
    narratedResultRef.current = null;
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
    window.setTimeout(() => finishRound(), 1600);
  }

  async function finishRound() {
    if (isJudgingRef.current) return;
    isJudgingRef.current = true;
    const scenario = getScenario(selectedCategory.id);
    const nextResult = await requestJudgeVerdict({
      category: selectedCategory,
      prompt: scenario.prompt,
      yourAnswer: answer,
      opponentAnswer: battleMode === "bot" ? scenario.winningAnswer : scenario.opponentAnswer,
      mode: battleMode,
      opponent: botName ?? "Juno",
    });
    setResult(nextResult);
    recordBattleResult(nextResult).catch((error) => {
      console.warn("Battle result persistence failed", error);
    });
    if (rankedRoom) {
      const localPresenceId = rankedPresenceId ?? getPlayerPresenceId();
      const opponentPresenceId =
        rankedRoom.host_presence_id === localPresenceId ? rankedRoom.guest_presence_id : rankedRoom.host_presence_id;
      const winnerPresenceId = nextResult.youWin ? localPresenceId : opponentPresenceId;
      markRankedBattleJudged({
        roomId: rankedRoom.id,
        winnerPresenceId,
        reason: nextResult.reason,
        pointDelta: nextResult.points,
      }).catch((error) => {
        console.warn("Ranked verdict persistence failed", error);
      });
    }
    if (battleMode === "friend" && friendRoom) {
      const localPresenceId = friendPresenceId ?? getPlayerPresenceId();
      const opponentPresenceId =
        friendRoom.host_presence_id === localPresenceId ? friendRoom.guest_presence_id : friendRoom.host_presence_id;
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
    setRating((current) => current + nextResult.points);
    isJudgingRef.current = false;
    setScreen("result");
  }

  function startFriend() {
    const nextRoomCode = createRoomCode();
    updatePath(friendBattlePath(nextRoomCode));
    setFriendRoomCode(nextRoomCode);
    setFriendJoined(false);
    setFriendPersistence("checking");
    setFriendRole("host");
    setFriendRoom(null);
    setFriendPresenceId(getPlayerPresenceId());
    setFriendStatus("Creating Supabase friend room...");
    setBattleMode("friend");
    setScreen("friend");
  }

  function startStreamer() {
    resetPath();
    setStreamRoomCode(createRoomCode());
    setSelectedCategory(categories[1]);
    setScreen("streamer");
  }

  function shareVerdict() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText("I just got judged on judgemebro.com. Run it back?").catch(() => {});
    }
  }

  async function officialStreamerBattle(streamerAnswer, viewerAnswer) {
    if (isJudgingRef.current) return;
    isJudgingRef.current = true;
    const nextResult = await requestJudgeVerdict({
      mode: "streamer",
      category: selectedCategory,
      opponent: viewerAnswer.name,
      prompt: getScenario(selectedCategory.id).prompt,
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
        onCancel={goHome}
        onBattle={() => startBattle("ranked")}
        onBot={() => startBattle("bot", rankedBots[0].name)}
        onFriend={startFriend}
      />
    );
  }

  if (screen === "battle") {
    return (
      <BattleScreen
        category={selectedCategory}
        timer={timer}
        answer={answer}
        setAnswer={setAnswer}
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
        onRematch={() => {
          if (result.mode === "streamer") {
            setScreen("streamer");
            return;
          }
          startBattle(result.mode, botName);
        }}
        onNew={startMatchmaking}
        onHome={goHome}
        onShare={shareVerdict}
      />
    );
  }

  if (screen === "friend") {
    return (
      <FriendBattleScreen
        category={selectedCategory}
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
        onHome={goHome}
        onFind={startMatchmaking}
        onFriend={startFriend}
        onStreamer={startStreamer}
      />
    );
  }

  if (screen === "streamer") {
    return (
      <StreamerScreen
        roomCode={streamRoomCode}
        category={selectedCategory}
        setCategory={setSelectedCategory}
        onHome={goHome}
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
      onFind={startMatchmaking}
      onFriend={startFriend}
      onStreamer={startStreamer}
      onProfile={() => setScreen("profile")}
    />
  );
}

