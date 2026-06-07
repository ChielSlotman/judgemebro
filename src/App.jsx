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
  Users,
  X,
} from "lucide-react";
import { bots, categories, scenarios, viewerAnswers as seedViewerAnswers } from "./data.js";
import {
  findOrCreateRankedMatch,
  getPlayerPresenceId,
  getRankedBattleRoom,
  markRankedBattleJudged,
  recordBattleResult,
  recordViewerSubmission,
  submitRankedBattleAnswer,
  subscribeToRankedTicket,
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
          <img src="/assets/rank-gold.png" alt="" />
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
            <img src="/assets/rank-gold.png" alt="" />
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
            <img src="/assets/rank-gold.png" alt="" />
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
          onChange={(event) => setAnswer(clampAnswer(event.target.value))}
          placeholder="Type your answer..."
          aria-label="Your answer"
        />
        <span>{answer.length}/{MAX_CHARS}</span>
      </section>

      <button className="primary-button judge" type="button" onClick={onSubmit}>
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

  return (
    <main className="screen result-screen">
      <BrandHeader onHome={onHome} compact />
      <section className={`verdict-hero ${result.youWin ? "win" : "loss"}`}>
        <span className="section-label">AI judge has spoken</span>
        <h1>{result.youWin ? "You win" : "You lose"}</h1>
        <div className="point-burst">
          <img src="/assets/rank-gold.png" alt="" />
          <strong>{delta}</strong>
          <span>{result.mode === "bot" ? "unranked bot battle" : `new rating ${newRating} Gold`}</span>
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
        <p>{result.reason}</p>
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
        </div>
      </section>
    </main>
  );
}

function FriendBattleScreen({ category, joined, roomCode, onHome, onStart, onBot }) {
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
        <p>Send the link. Same prompt, 30s answers, AI verdict.</p>
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
          <img src="/assets/rank-gold.png" alt="" />
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

function StreamerScreen({ roomCode, onHome, onViewer, onOfficial }) {
  const [streamerAnswer, setStreamerAnswer] = useState(
    "Fair, but sparks are overrated. I prefer tension that actually builds.",
  );
  const [answers, setAnswers] = useState(seedViewerAnswers);
  const [selected, setSelected] = useState(seedViewerAnswers[0]);
  const [copied, setCopied] = useState(false);

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
    if (selected?.id === id) {
      setSelected(answers.find((answer) => answer.id !== id) ?? null);
    }
  }

  return (
    <main className="streamer-shell">
      <BrandHeader onHome={onHome} onLeave={onHome} compact />
      <section className="stream-top">
        <div>
          <span className="live-pill">Live room</span>
          <h1>Chat gets judged</h1>
          <p>Room {roomCode}. 241 viewers. Viewer answers are free until selected.</p>
        </div>
        <div className="stream-actions">
          <button className="outline-button" type="button" onClick={copyViewerLink}>
            <Copy size={20} />
            {copied ? "Copied link" : "Viewer link"}
          </button>
          <button className="primary-button lime small" type="button">
            Start round
          </button>
        </div>
      </section>
      <section className="stream-grid">
        <div className="stream-main">
          <div className="stream-meta">
            <span>Dating</span>
            <strong>18s</strong>
          </div>
          <h2>{getScenario("dating").prompt}</h2>
          <label>
            Streamer answer
            <textarea value={streamerAnswer} onChange={(event) => setStreamerAnswer(clampAnswer(event.target.value))} />
          </label>
        </div>
        <aside className="viewer-panel">
          <h2>Viewer answers</h2>
          {answers.map((answer) => (
            <article key={answer.id} className={selected?.id === answer.id ? "selected" : ""}>
              <strong>{answer.name}</strong>
              <p>{answer.text}</p>
              <div>
                <button type="button" onClick={() => setSelected(answer)}>Show</button>
                <button type="button" onClick={() => hideAnswer(answer.id)}>Hide</button>
                <button type="button" onClick={() => onOfficial(streamerAnswer, answer)}>Pick official</button>
              </div>
            </article>
          ))}
        </aside>
        <section className="broadcast-preview">
          <span>Showing on stream</span>
          <h2>{selected?.text ?? "Pick a viewer answer to show live."}</h2>
          <button className="primary-button judge small" type="button" onClick={() => selected && onOfficial(streamerAnswer, selected)}>
            Official battle
          </button>
        </section>
      </section>
    </main>
  );
}

function ViewerScreen({ roomCode, onHome }) {
  const [name, setName] = useState("Viewer 27");
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
        <span className="section-label">Dating</span>
        <h1>{getScenario("dating").prompt}</h1>
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
            disabled={submitted}
            onChange={(event) => setAnswer(clampAnswer(event.target.value))}
            placeholder="Submit something stream-worthy..."
          />
          <span>{answer.length}/{MAX_CHARS}</span>
        </label>
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
  const [battleMode, setBattleMode] = useState(initialInvite?.screen === "friend" ? "friend" : "ranked");
  const [botName, setBotName] = useState(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState("Opening real-player queue...");
  const [rankedRoom, setRankedRoom] = useState(null);
  const [rankedPresenceId, setRankedPresenceId] = useState(null);
  const isJudgingRef = useRef(false);

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
    if (screen !== "friend") return undefined;
    const timeout = window.setTimeout(() => setFriendJoined(true), 1800);
    return () => window.clearTimeout(timeout);
  }, [screen]);

  const rankedBots = useMemo(() => bots, []);

  function goHome() {
    resetPath();
    setScreen("home");
    setAnswer("");
    setTimer(24);
    setMatchElapsed(0);
    setFriendJoined(false);
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
    setScreen("battle");
  }

  function submitAnswer() {
    if (answer.trim().length === 0) return;
    if (rankedRoom) {
      submitRankedBattleAnswer({ room: rankedRoom, answer }).catch((error) => {
        console.warn("Ranked answer submit failed", error);
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
    setRating((current) => current + nextResult.points);
    isJudgingRef.current = false;
    setScreen("result");
  }

  function startFriend() {
    updatePath(friendBattlePath(DEFAULT_FRIEND_ROOM));
    setFriendRoomCode(DEFAULT_FRIEND_ROOM);
    setFriendJoined(false);
    setBattleMode("friend");
    setScreen("friend");
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
      category: categories[1],
      opponent: viewerAnswer.name,
      prompt: getScenario("dating").prompt,
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
        onRematch={() => startBattle(result.mode === "streamer" ? "ranked" : result.mode, botName)}
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
        onStreamer={() => setScreen("streamer")}
      />
    );
  }

  if (screen === "streamer") {
    return (
      <StreamerScreen
        roomCode={streamRoomCode}
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
      onStreamer={() => {
        resetPath();
        setStreamRoomCode(DEFAULT_STREAM_ROOM);
        setScreen("streamer");
      }}
      onProfile={() => setScreen("profile")}
    />
  );
}
