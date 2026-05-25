import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ============================================================================
// STORAGE LAYER — uses localStorage so progress persists across browser
// sessions on any device. Falls back to in-memory if localStorage is blocked.
// ============================================================================
const memoryStore = {};
const storage = {
  async get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {}
    return memoryStore[key] !== undefined ? memoryStore[key] : fallback;
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
    memoryStore[key] = value;
  },
};

const SAVE_KEY = "lvlup-save-v1";
const defaultSave = {
  name: "Champ",
  xp: 0,
  level: 1,
  coins: 0,
  streakDaily: 0,
  lastPlayedDate: "",
  badges: [],
  spelling: {
    mastered: [],
    needsPractice: [],
    attempts: {},
  },
  math: {
    masteredFacts: [],
    difficulty: 1, // 1 = easy, 2 = medium, 3 = hard
    streakInSession: 0,
    correctTotal: 0,
    wrongTotal: 0,
  },
  shop: {
    avatar: "🏈",
    theme: "neon",
    owned: ["🏈", "neon"],
  },
  stats: {
    totalCorrect: 0,
    totalWrong: 0,
    bestStreak: 0,
    totalSecondsLearned: 0,
    secondsToday: 0,
    timeByDay: {}, // { "YYYY-MM-DD": seconds }
  },
  crunchlab: {
    completed: [],
    inProgress: {},
  },
};

// ============================================================================
// CURRICULUM — built straight from the project's Letterland Grade 2 units
// and Wake County 2nd-grade math standards (bridge to 3rd grade).
// ============================================================================

const SPELLING_PACKS = {
  "ir-er-ur": {
    name: "Spinner Squad",
    emoji: "🌀",
    pattern: "Words with ir, er, ur",
    color: "#7c3aed",
    words: ["nurse","Thursday","curve","twirl","hurting","disturb","third","whirl","turned","thirty","shirt","thirteen","curb","dirty","squirt","thirsty","burned","birthday","first","curly","swirl","Saturday"],
  },
  "ear-er-or": {
    name: "Power Words",
    emoji: "⚡",
    pattern: "Words with er, ear, or sounds",
    color: "#06b6d4",
    words: ["sister","second","tiger","earth","person","brother","heard","number","another","wonder","above","doctor","winter","search","other","learn","farther","favor","color","thunder","computer","early","actor"],
  },
  "y-endings": {
    name: "Why Endings?",
    emoji: "🤔",
    pattern: "Words ending in y (i or long-i sounds)",
    color: "#f59e0b",
    words: ["try","worry","borrow","spy","mirror","sorry","hurry","carrot","reply","sleepy","carry","hungry","berry","marry","tricky","sky","narrow","dry","scurry","sorrow","furry","cherry","fry","cry","sly","sneaky"],
  },
  "oo-double": {
    name: "Zoom Zone",
    emoji: "🚀",
    pattern: "Words with the oo sound",
    color: "#10b981",
    words: ["spoon","balloon","school","smooth","loose","proof","rooster","prove","choose","lose","noon","bloom","tooth","boot","move","cartoon","tomorrow","goose","whom","moose","tool","raccoon","pool","zoom","broom"],
  },
  "ea-short": {
    name: "Bread Brigade",
    emoji: "🍞",
    pattern: "Words with the short ea sound",
    color: "#dc2626",
    words: ["head","bread","feather","heavy","spread","breakfast","ready","weather","breath","instead","sweat","meadow","steady","dead","ahead","deaf","pleasant","healthy","thread","meant","read"],
  },
  "es-plurals": {
    name: "Plural Power",
    emoji: "📚",
    pattern: "Plurals ending in es and ies",
    color: "#ec4899",
    words: ["babies","places","hurries","freezes","reaches","pages","wishes","stories","catches","tries","cities","fixes","dishes","cries","lunches","copies","glasses","flies","faces","brushes","bridges","closes","carries","boxes","dresses","classes","messes"],
  },
  "ow-ou": {
    name: "Loud Crowd",
    emoji: "💥",
    pattern: "Words with the ow and ou sounds",
    color: "#f97316",
    words: ["clown","allow","grouchy","power","mountain","countless","found","cloudy","growl","vowel","around","downtown","shower","fountain","howl","proud","drowsy","about","couch","towel","crowded","sound","drown","cloudless","owl","plow","ouch"],
  },
  "ear-eer": {
    name: "Steady Steer",
    emoji: "🦌",
    pattern: "Words with ear and eer sounds",
    color: "#8b5cf6",
    words: ["ear","hear","steering","nearly","appear","fearful","tears","deer","clearly","fear","cheerful","beard","year","tearful","steered","yearly","clearing","clear","nearby","appears","cheering","dear","cheer","veer","hearing","near","steer","rear"],
  },
  "comparatives": {
    name: "Stronger, Fastest",
    emoji: "🏆",
    pattern: "Words ending in er and est",
    color: "#eab308",
    words: ["smaller","higher","wetter","later","noisier","happier","tall","taller","tallest","stronger","strongest","sweeter","sweetest","tinier","tiniest","wider","widest","nearer","nearest","louder","loudest","funnier","funniest","hotter","hottest","wiser","wisest","farther","farthest","biggest"],
  },
  "contractions": {
    name: "Smash Words",
    emoji: "💢",
    pattern: "Contractions (smashed-together words)",
    color: "#0ea5e9",
    words: ["we're","doesn't","I've","who's","there's","shouldn't","where's","they've","let's","you're","weren't","won't","they're","what's","we've","aren't","wouldn't","wasn't","here's","you've","that's","can't","haven't","isn't","it's","hadn't","couldn't"],
  },
  "double-cons": {
    name: "Double Trouble",
    emoji: "🎯",
    pattern: "Words with double consonants",
    color: "#22c55e",
    words: ["happen","rabbit","sudden","button","tennis","bottom","moment","kitten","label","hiccup","puppet","gallon","traffic","lesson","mitten","ribbon","command","silent","equal","zebra","basket"],
  },
  "le-endings": {
    name: "Little Wiggle",
    emoji: "🐍",
    pattern: "Words ending in le",
    color: "#a855f7",
    words: ["table","puzzle","able","syllable","title","uncle","middle","candle","needle","staple","apple","eagle","cradle","single","bugle","handle","maple","little","cuddle","pickle","rattle","mumble","idle","fable","cable","ripple"],
  },
};

// Math word problem templates — sports, Mark Rober, gaming
const wordProblemTemplates = {
  add100: [
    (a, b) => ({
      q: `🏀 In game 1, the Lakers scored ${a} points. In game 2, they scored ${b} more. How many points total?`,
      ans: a + b,
    }),
    (a, b) => ({
      q: `⚽ Messi has ${a} career goals. He scores ${b} more this season. How many now?`,
      ans: a + b,
    }),
    (a, b) => ({
      q: `🚀 Mark Rober's marble run has ${a} marbles. He adds ${b} more from his squirrel maze. Total marbles?`,
      ans: a + b,
    }),
    (a, b) => ({
      q: `🎮 You have ${a} V-Bucks. You earn ${b} more from a battle pass. Total V-Bucks?`,
      ans: a + b,
    }),
  ],
  sub100: [
    (a, b) => ({
      q: `🏈 The Chiefs had ${a} fans cheering. ${b} left to get snacks. How many still cheering?`,
      ans: a - b,
    }),
    (a, b) => ({
      q: `🎮 Your Minecraft world had ${a} blocks. A creeper blew up ${b}. How many blocks left?`,
      ans: a - b,
    }),
    (a, b) => ({
      q: `🧪 Mark Rober's glitter bomb spit out ${a} pieces of glitter. ${b} stuck to the porch pirate. How many flew away?`,
      ans: a - b,
    }),
  ],
  add1000: [
    (a, b) => ({
      q: `🏟️ The stadium sold ${a} tickets on Saturday and ${b} on Sunday. Total tickets sold?`,
      ans: a + b,
    }),
    (a, b) => ({
      q: `🤖 Mark Rober's robot drove ${a} feet. Then it drove ${b} more feet. How far in total?`,
      ans: a + b,
    }),
    (a, b) => ({
      q: `🎯 You scored ${a} points in Roblox on Friday and ${b} on Saturday. Weekend total?`,
      ans: a + b,
    }),
  ],
  sub1000: [
    (a, b) => ({
      q: `🏆 The team needed ${a} fans to set a record. ${b} showed up. How many more needed?`,
      ans: a - b,
    }),
    (a, b) => ({
      q: `🚀 The rocket launches at altitude ${a} ft. It dropped ${b} ft. New altitude?`,
      ans: a - b,
    }),
  ],
  multTimes2: [
    (a) => ({ q: `🏀 ${a} teams play, with 2 captains each. How many captains?`, ans: a * 2 }),
    (a) => ({ q: `🎮 You unlock ${a} skins worth 2 coins each. Total coins?`, ans: a * 2 }),
    (a) => ({ q: `🚲 Mark Rober has ${a} bikes. How many wheels in total?`, ans: a * 2 }),
  ],
  multTimes5: [
    (a) => ({ q: `⏰ ${a} hands on the clock, each pointing for 5 minutes. Total minutes?`, ans: a * 5 }),
    (a) => ({ q: `🏈 A team makes ${a} field goals (3 pts) and ${a} extra points (2 pts each = 5 pts a pair). How many points from the extras only?`, ans: a * 5 }),
    (a) => ({ q: `🪐 ${a} planets are in 5-planet star systems. How many planets total?`, ans: a * 5 }),
  ],
  multTimes3: [
    (a) => ({ q: `🏀 ${a} players each score 3-pointers. If each makes one, how many points?`, ans: a * 3 }),
    (a) => ({ q: `🧪 Each science experiment uses 3 beakers. With ${a} experiments, how many beakers?`, ans: a * 3 }),
  ],
  multTimes4: [
    (a) => ({ q: `🏎️ Each go-kart has 4 wheels. With ${a} karts, how many wheels?`, ans: a * 4 }),
    (a) => ({ q: `🎮 Each controller has 4 buttons on top. With ${a} controllers, how many buttons?`, ans: a * 4 }),
  ],
  time: [
    () => {
      const h = 1 + Math.floor(Math.random() * 11);
      const m = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
      const display = `${h}:${m.toString().padStart(2, "0")}`;
      const options = [];
      const correct = `${h} ${m === 0 ? "o'clock" : m === 15 ? "fifteen" : m === 30 ? "thirty" : "forty-five"}`;
      return {
        q: `⏰ A clock reads ${display}. How do you say this time?`,
        options: [correct, `${h - 1 || 12} ${m === 0 ? "o'clock" : m === 15 ? "fifteen" : m === 30 ? "thirty" : "forty-five"}`, `${h} ${m === 0 ? "fifteen" : m === 15 ? "thirty" : m === 30 ? "o'clock" : "fifteen"}`].sort(() => Math.random() - 0.5),
        ans: correct,
      };
    },
  ],
  money: [
    () => {
      const q = Math.floor(Math.random() * 3) + 1;
      const d = Math.floor(Math.random() * 4);
      const n = Math.floor(Math.random() * 4);
      const total = q * 25 + d * 10 + n * 5;
      return {
        q: `💰 You have ${q} quarter${q > 1 ? "s" : ""}, ${d} dime${d !== 1 ? "s" : ""}, and ${n} nickel${n !== 1 ? "s" : ""}. How many cents total?`,
        ans: total,
      };
    },
  ],
};

// ============================================================================
// BADGES — funny, themed, achievement-driven
// ============================================================================
const ALL_BADGES = [
  { id: "first_word", name: "Rookie Speller", emoji: "🥉", desc: "Spell your first word right" },
  { id: "first_math", name: "Calculator Brain", emoji: "🧮", desc: "Solve your first math problem" },
  { id: "hat_trick", name: "Hat Trick", emoji: "🎩", desc: "Get 3 correct in a row" },
  { id: "streak_10", name: "On Fire", emoji: "🔥", desc: "Hit a 10-answer streak" },
  { id: "streak_20", name: "ICE COLD", emoji: "🥶", desc: "20 correct in a row. Unreal." },
  { id: "rober_lab", name: "Rober Lab Engineer", emoji: "🧪", desc: "Complete an engineering set" },
  { id: "level5", name: "Level 5 Pro", emoji: "⭐", desc: "Reach Level 5" },
  { id: "level10", name: "Double Digits", emoji: "🌟", desc: "Reach Level 10" },
  { id: "level20", name: "Legendary", emoji: "👑", desc: "Reach Level 20" },
  { id: "math_master", name: "Math Master", emoji: "📐", desc: "Master 25 math facts" },
  { id: "word_wizard", name: "Word Wizard", emoji: "🧙", desc: "Master 25 spelling words" },
  { id: "speed_demon", name: "Speed Demon", emoji: "⚡", desc: "Beat the Clock with 10 right" },
  { id: "coin_baron", name: "Coin Baron", emoji: "💎", desc: "Earn 500 coins total" },
];

// ============================================================================
// SHOP ITEMS
// ============================================================================
const AVATARS = [
  { id: "🏈", name: "Football", cost: 0 },
  { id: "🏀", name: "Basketball", cost: 30 },
  { id: "⚽", name: "Soccer Ball", cost: 30 },
  { id: "⚾", name: "Baseball", cost: 30 },
  { id: "🎮", name: "Gamer", cost: 50 },
  { id: "🚀", name: "Rocket", cost: 75 },
  { id: "🤖", name: "Robot", cost: 100 },
  { id: "🧪", name: "Scientist", cost: 100 },
  { id: "👑", name: "Champion", cost: 200 },
  { id: "🐉", name: "Dragon", cost: 250 },
  { id: "🦖", name: "T-Rex", cost: 250 },
  { id: "🛸", name: "UFO", cost: 300 },
];

const THEMES = {
  neon: { name: "Neon Arcade", cost: 0, bg: "#0a0e1a", panel: "#111827", accent: "#00ffff", accent2: "#ff00ff", text: "#ffffff" },
  stadium: { name: "Stadium Lights", cost: 75, bg: "#0d1f3c", panel: "#1e3a5f", accent: "#ffd700", accent2: "#ff6b00", text: "#ffffff" },
  lab: { name: "Mad Scientist", cost: 100, bg: "#0f1f17", panel: "#1a3327", accent: "#00ff88", accent2: "#88ff00", text: "#ffffff" },
  gamer: { name: "Pro Gamer", cost: 150, bg: "#1a0033", panel: "#2a0055", accent: "#ff00aa", accent2: "#00ffff", text: "#ffffff" },
  rocket: { name: "Rocket Launch", cost: 200, bg: "#1a0a2e", panel: "#2d1b69", accent: "#ff4500", accent2: "#ffd700", text: "#ffffff" },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const xpForLevel = (lvl) => 50 + (lvl - 1) * 25; // grows gradually
const totalXpToLevel = (lvl) => {
  let total = 0;
  for (let i = 1; i < lvl; i++) total += xpForLevel(i);
  return total;
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const shuffleString = (s) => {
  const arr = s.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join("");
  return result === s && s.length > 1 ? shuffleString(s) : result;
};

// Voice preference order — most natural / neural first
const VOICE_PRIORITY = [
  "Google US English",
  "Google UK English Female",
  "Google UK English Male",
  "Samantha",
  "Alex",
  "Karen",
  "Daniel",
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Microsoft Guy Online (Natural)",
  "en-US-Neural2",
];

let _bestVoice    = null;
let _voicesReady  = false;

// Warm up the voice list as early as possible — Chrome loads remote
// voices asynchronously and they won't be available on the first call.
const warmVoices = () => {
  if (!window.speechSynthesis) return;
  const tryLoad = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      _bestVoice   = null; // force re-pick with full list
      _voicesReady = true;
    }
  };
  tryLoad();
  window.speechSynthesis.onvoiceschanged = () => {
    _bestVoice   = null;
    _voicesReady = true;
    tryLoad();
  };
  // Chrome inside iframes sometimes needs a nudge — speak a silent
  // utterance so the engine initialises and remote voices load.
  try {
    const silent = new SpeechSynthesisUtterance("");
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
  } catch (e) {}
};
// Run immediately when the module loads
if (typeof window !== "undefined") warmVoices();

const getBestVoice = () => {
  // Never serve a cached voice that was picked before remote voices loaded
  if (_bestVoice && _voicesReady) return _bestVoice;

  const voices = window.speechSynthesis?.getVoices() || [];
  if (!voices.length) return null;

  // 1. Try our priority list (natural / neural voices)
  for (const name of VOICE_PRIORITY) {
    const v = voices.find((v) => v.name === name || v.name.startsWith(name));
    if (v) { _bestVoice = v; return v; }
  }

  // 2. Any non-local en-US voice (remote = higher quality in Chrome)
  const enUS = voices.filter((v) => v.lang.startsWith("en-US") || v.lang === "en_US");
  const remote = enUS.find((v) => !v.localService);
  if (remote) { _bestVoice = remote; return remote; }

  // 3. Any English voice that isn't the eSpeak robot
  const decent = voices.find(
    (v) => v.lang.startsWith("en") && !v.name.toLowerCase().includes("espeak")
  );
  if (decent) { _bestVoice = decent; return decent; }

  // 4. Absolute fallback — whatever Chrome gives us
  _bestVoice = voices[0];
  return _bestVoice;
};

const speak = (text) => {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.rate  = 0.82;
    u.pitch = 1.05;
    u.lang  = "en-US";

    const doSpeak = () => {
      const v = getBestVoice();
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    };

    // If voices are already warmed up, speak immediately.
    // Otherwise wait up to 1.5 s for Chrome to finish loading remote voices.
    if (_voicesReady || window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      let fired = false;
      const fire = () => { if (!fired) { fired = true; doSpeak(); } };
      window.speechSynthesis.onvoiceschanged = () => {
        _bestVoice = null;
        _voicesReady = true;
        fire();
      };
      setTimeout(fire, 1500); // give up waiting and use whatever's available
    }
  } catch (e) {}
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// ============================================================================
// REUSABLE UI COMPONENTS
// ============================================================================
const Confetti = ({ trigger }) => {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    const newPieces = Array.from({ length: 50 }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1.5 + Math.random() * 1,
      rotate: Math.random() * 360,
      emoji: pickRandom(["🎉", "⭐", "💥", "⚡", "🏆", "🎯", "✨"]),
    }));
    setPieces(newPieces);
    const t = setTimeout(() => setPieces([]), 3000);
    return () => clearTimeout(t);
  }, [trigger]);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: "-30px",
            left: `${p.left}%`,
            fontSize: "28px",
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
};

const ProgressBar = ({ value, max, accent, height = 16 }) => (
  <div style={{
    width: "100%",
    height,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    overflow: "hidden",
    border: "2px solid rgba(255,255,255,0.15)",
    position: "relative",
  }}>
    <div style={{
      width: `${Math.min(100, (value / max) * 100)}%`,
      height: "100%",
      background: `linear-gradient(90deg, ${accent}, ${accent}dd)`,
      borderRadius: 999,
      boxShadow: `0 0 15px ${accent}aa`,
      transition: "width 0.6s cubic-bezier(.2,.8,.2,1)",
    }} />
  </div>
);

// ============================================================================
// MAIN APP
// ============================================================================
export default function App() {
  const [save, setSave] = useState(null);
  const [screen, setScreen] = useState("home"); // home, spelling, math, shop, badges, settings
  const [confettiKey, setConfettiKey] = useState(0);
  const [toast, setToast] = useState(null); // {msg, type}
  const [levelUpAnim, setLevelUpAnim] = useState(false);

  // ── Time tracking ────────────────────────────────────────────
  // Screens that count as "active learning" time
  const LEARNING_SCREENS = ["spelling", "math", "crunchlab"];
  const pendingSecondsRef = useRef(0);   // in-memory accumulator between flushes
  const tickIntervalRef   = useRef(null);
  const sessionSecondsRef = useRef(0);   // live session counter for the HUD
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Flush accumulated seconds into persisted save
  const flushTime = useCallback(() => {
    const delta = pendingSecondsRef.current;
    if (delta === 0) return;
    pendingSecondsRef.current = 0;
    const today = todayStr();
    setSave((s) => {
      if (!s) return s;
      const timeByDay = { ...(s.stats.timeByDay || {}) };
      timeByDay[today] = (timeByDay[today] || 0) + delta;
      // Keep only last 30 days to cap storage size
      const keys = Object.keys(timeByDay).sort();
      if (keys.length > 30) keys.slice(0, keys.length - 30).forEach((k) => delete timeByDay[k]);
      return {
        ...s,
        stats: {
          ...s.stats,
          totalSecondsLearned: (s.stats.totalSecondsLearned || 0) + delta,
          secondsToday:        (s.stats.secondsToday        || 0) + delta,
          timeByDay,
        },
      };
    });
  }, []);

  // Start / stop the tick based on whether user is on a learning screen
  useEffect(() => {
    const isLearning = LEARNING_SCREENS.includes(screen);
    if (isLearning) {
      tickIntervalRef.current = setInterval(() => {
        pendingSecondsRef.current += 1;
        sessionSecondsRef.current += 1;
        setSessionSeconds(sessionSecondsRef.current);
        // Flush to save every 30 seconds
        if (pendingSecondsRef.current % 30 === 0) flushTime();
      }, 1000);
    } else {
      // Leaving a learning screen — flush whatever is pending
      flushTime();
      clearInterval(tickIntervalRef.current);
    }
    return () => clearInterval(tickIntervalRef.current);
  }, [screen, flushTime]);

  // Flush on tab hide / page close
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) flushTime();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flushTime();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushTime]);

  // Load save on mount
  useEffect(() => {
    (async () => {
      const loaded = await storage.get(SAVE_KEY, defaultSave);
      // backfill missing fields
      const merged = { ...defaultSave, ...loaded,
        spelling:   { ...defaultSave.spelling,   ...(loaded.spelling   || {}) },
        math:       { ...defaultSave.math,        ...(loaded.math       || {}) },
        shop:       { ...defaultSave.shop,        ...(loaded.shop       || {}) },
        stats:      { ...defaultSave.stats,       ...(loaded.stats      || {}) },
        crunchlab:  { ...defaultSave.crunchlab,   ...(loaded.crunchlab  || {}) },
      };
      // Daily streak logic
      const today = todayStr();
      if (merged.lastPlayedDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const ystr = yesterday.toISOString().slice(0, 10);
        if (merged.lastPlayedDate === ystr) {
          merged.streakDaily = (merged.streakDaily || 0) + 1;
        } else if (merged.lastPlayedDate && merged.lastPlayedDate !== today) {
          merged.streakDaily = 1;
        } else if (!merged.lastPlayedDate) {
          merged.streakDaily = 1;
        }
        merged.lastPlayedDate = today;
        merged.stats.secondsToday = 0;   // fresh day → reset today counter
        // reset session math streak each day
        merged.math.streakInSession = 0;
      }
      setSave(merged);
    })();
  }, []);

  // Persist save whenever it changes
  useEffect(() => {
    if (save) storage.set(SAVE_KEY, save);
  }, [save]);

  const theme = THEMES[save?.shop?.theme || "neon"];

  const showToast = (msg, type = "success") => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 2200);
  };

  const fireConfetti = () => setConfettiKey((k) => k + 1);

  const grantBadge = useCallback((badgeId) => {
    setSave((s) => {
      if (s.badges.includes(badgeId)) return s;
      const b = ALL_BADGES.find((x) => x.id === badgeId);
      if (b) {
        setTimeout(() => showToast(`🏅 BADGE UNLOCKED: ${b.name}!`, "badge"), 600);
        setTimeout(() => fireConfetti(), 800);
      }
      return { ...s, badges: [...s.badges, badgeId] };
    });
  }, []);

  const addXP = useCallback((amount, coinAmount = 0) => {
    setSave((s) => {
      const newXP = s.xp + amount;
      const newCoins = s.coins + coinAmount;
      const newTotalEarned = (s.stats.totalCorrect || 0) * 5; // approximate
      // Check level up
      let newLevel = s.level;
      while (newXP >= totalXpToLevel(newLevel + 1)) {
        newLevel++;
      }
      const leveledUp = newLevel > s.level;
      if (leveledUp) {
        setLevelUpAnim(true);
        setTimeout(() => setLevelUpAnim(false), 2500);
        setTimeout(() => fireConfetti(), 200);
        if (newLevel >= 5) setTimeout(() => grantBadge("level5"), 100);
        if (newLevel >= 10) setTimeout(() => grantBadge("level10"), 100);
        if (newLevel >= 20) setTimeout(() => grantBadge("level20"), 100);
      }
      if (newCoins >= 500) setTimeout(() => grantBadge("coin_baron"), 100);
      return { ...s, xp: newXP, coins: newCoins, level: newLevel };
    });
  }, [grantBadge]);

  if (!save) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0a0e1a",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 24 }}>⚡ Loading your lab...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.panel} 100%)`,
      color: theme.text,
      fontFamily: "'Nunito', system-ui, sans-serif",
      padding: 16,
      transition: "background 0.5s",
    }}>
      <GlobalStyles theme={theme} />

      <Confetti trigger={confettiKey} />

      {/* Level up overlay */}
      {levelUpAnim && (
        <div style={{
          position: "fixed", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          zIndex: 9998, pointerEvents: "none",
        }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(28px, 6vw, 56px)",
            color: theme.accent,
            textShadow: `0 0 30px ${theme.accent}, 0 0 60px ${theme.accent}`,
            animation: "levelUpPop 2.5s ease-out forwards",
            textAlign: "center",
            lineHeight: 1.3,
          }}>
            LEVEL UP!<br/>
            <span style={{ color: theme.accent2, fontSize: "0.7em" }}>
              LV {save.level}
            </span>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%",
          transform: "translateX(-50%)",
          background: toast.type === "badge" ? theme.accent2 : theme.accent,
          color: theme.bg,
          padding: "12px 24px",
          borderRadius: 999,
          fontWeight: 900,
          zIndex: 10000,
          boxShadow: `0 4px 30px ${theme.accent}88`,
          animation: "toastIn 0.4s",
          fontSize: 16,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Header save={save} theme={theme} onSettings={() => setScreen("settings")}
          sessionSeconds={sessionSeconds} isLearning={["spelling","math","crunchlab"].includes(screen)} />

        {screen === "home" && (
          <HomeScreen save={save} theme={theme} setScreen={setScreen} />
        )}
        {screen === "spelling" && (
          <SpellingModule save={save} setSave={setSave} theme={theme}
            addXP={addXP} grantBadge={grantBadge} showToast={showToast}
            fireConfetti={fireConfetti} back={() => setScreen("home")} />
        )}
        {screen === "math" && (
          <MathModule save={save} setSave={setSave} theme={theme}
            addXP={addXP} grantBadge={grantBadge} showToast={showToast}
            fireConfetti={fireConfetti} back={() => setScreen("home")}
            goToCrunchLab={() => setScreen("crunchlab")} />
        )}
        {screen === "shop" && (
          <Shop save={save} setSave={setSave} theme={theme}
            showToast={showToast} back={() => setScreen("home")} />
        )}
        {screen === "badges" && (
          <BadgesScreen save={save} theme={theme} back={() => setScreen("home")} />
        )}
        {screen === "settings" && (
          <Settings save={save} setSave={setSave} theme={theme} back={() => setScreen("home")} />
        )}
        {screen === "crunchlab" && (
          <CrunchLabScreen save={save} setSave={setSave} theme={theme}
            addXP={addXP} grantBadge={grantBadge} showToast={showToast}
            fireConfetti={fireConfetti} back={() => setScreen("home")} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GLOBAL STYLES
// ============================================================================
function GlobalStyles({ theme }) {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&family=Press+Start+2P&family=Fredoka:wght@500;700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      input, button { font-family: inherit; }
      input:focus, button:focus { outline: 3px solid ${theme.accent}; outline-offset: 2px; }
      @keyframes confettiFall {
        to { top: 110%; transform: rotate(720deg); }
      }
      @keyframes levelUpPop {
        0% { transform: scale(0); opacity: 0; }
        20% { transform: scale(1.3); opacity: 1; }
        30% { transform: scale(1); }
        80% { transform: scale(1); opacity: 1; }
        100% { transform: scale(1.5); opacity: 0; }
      }
      @keyframes toastIn {
        from { transform: translate(-50%, -100px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
      @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 0 0 0 ${theme.accent}66; }
        50% { box-shadow: 0 0 0 12px ${theme.accent}00; }
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-8px); }
        40% { transform: translateX(8px); }
        60% { transform: translateX(-6px); }
        80% { transform: translateX(6px); }
      }
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .card-tap:active { transform: scale(0.97); }
      .card-tap { transition: transform 0.12s; }
      .pixel-font { font-family: 'Press Start 2P', monospace; }
      .display-font { font-family: 'Fredoka', sans-serif; font-weight: 700; }
    `}</style>
  );
}

// ── Time formatting helpers ──────────────────────────────────
const fmtTime = (secs) => {
  if (!secs || secs < 60) return `${secs || 0}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
};

// ============================================================================
// HEADER (always visible top bar with level, XP, coins, streak)
// ============================================================================
function Header({ save, theme, onSettings, sessionSeconds, isLearning }) {
  const xpInLevel = save.xp - totalXpToLevel(save.level);
  const xpNeeded = xpForLevel(save.level);

  return (
    <div style={{
      background: `linear-gradient(135deg, ${theme.panel}, ${theme.panel}dd)`,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      border: `2px solid ${theme.accent}33`,
      boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
      animation: "slideUp 0.5s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{
          fontSize: 48,
          width: 64,
          height: 64,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${theme.accent}33, ${theme.accent2}33)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `3px solid ${theme.accent}`,
          boxShadow: `0 0 20px ${theme.accent}66`,
        }}>
          {save.shop.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div className="pixel-font" style={{
            fontSize: 11,
            color: theme.accent,
            letterSpacing: 1,
            marginBottom: 4,
          }}>
            PLAYER • {save.name.toUpperCase()}
          </div>
          <div className="display-font" style={{
            fontSize: "clamp(20px, 4vw, 26px)",
            fontWeight: 900,
            lineHeight: 1,
          }}>
            LEVEL <span style={{ color: theme.accent }}>{save.level}</span>
          </div>
        </div>
        <button onClick={onSettings} style={{
          background: "transparent",
          border: `2px solid ${theme.accent}44`,
          color: theme.text,
          width: 44, height: 44,
          borderRadius: 12,
          fontSize: 20,
          cursor: "pointer",
        }} aria-label="Settings">⚙️</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, opacity: 0.7 }}>
          <span>XP</span>
          <span>{xpInLevel} / {xpNeeded}</span>
        </div>
        <ProgressBar value={xpInLevel} max={xpNeeded} accent={theme.accent} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <StatChip label="COINS" value={save.coins} icon="🪙" color={theme.accent2} />
        <StatChip label="STREAK" value={save.streakDaily} icon="🔥" color="#ff6b00" />
        <StatChip label="BADGES" value={save.badges.length} icon="🏅" color={theme.accent} />
      </div>

      {/* Time row — always visible, two chips side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <StatChip label="TODAY" value={fmtTime(save.stats?.secondsToday || 0)} icon="⏱️" color="#a78bfa" small />
        <StatChip label="ALL TIME" value={fmtTime(save.stats?.totalSecondsLearned || 0)} icon="🕰️" color="#a78bfa" small />
      </div>

      {/* Live session timer — only shown while actively learning */}
      {isLearning && (
        <div style={{
          marginTop: 10,
          background: "rgba(0,0,0,0.25)",
          borderRadius: 10,
          padding: "7px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid rgba(167,139,250,0.3)",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#a78bfa",
            boxShadow: "0 0 8px #a78bfaaa",
            animation: "pulseGlow 1.5s infinite",
            flexShrink: 0,
          }} />
          <span className="pixel-font" style={{ fontSize: 9, color: "#a78bfa", letterSpacing: 1 }}>
            SESSION
          </span>
          <span style={{ fontWeight: 900, color: "#a78bfa", fontSize: 15, marginLeft: 2 }}>
            {fmtTime(sessionSeconds)}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>
            learning time active
          </span>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, icon, color, small }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.25)",
      borderRadius: 12,
      padding: "8px 4px",
      textAlign: "center",
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{
        fontWeight: 900,
        fontSize: small ? 13 : 20,
        color,
        lineHeight: 1.2,
        padding: small ? "2px 0" : 0,
      }}>{value}</div>
      <div className="pixel-font" style={{ fontSize: 8, opacity: 0.7, letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

// ============================================================================
// HOME SCREEN
// ============================================================================
function HomeScreen({ save, theme, setScreen }) {
  const cards = [
    { id: "spelling", title: "SPELLING", emoji: "✏️", desc: "Word packs & challenges", color: theme.accent },
    { id: "math", title: "MATH", emoji: "🧮", desc: "Add, subtract, multiply!", color: theme.accent2 },
    { id: "crunchlab", title: "CRUNCHLAB", emoji: "🧪", desc: "Science missions unlocked!", color: "#00ff88" },
    { id: "badges", title: "BADGES", emoji: "🏅", desc: `${save.badges.length} / ${ALL_BADGES.length} unlocked`, color: "#ffd700" },
    { id: "shop", title: "SHOP", emoji: "🛒", desc: `${save.coins} coins to spend`, color: "#ff6b00" },
  ];
  return (
    <div style={{ animation: "slideUp 0.5s" }}>
      <div style={{
        textAlign: "center",
        padding: "20px 0 24px",
      }}>
        <div className="pixel-font" style={{
          fontSize: "clamp(10px, 2.5vw, 14px)",
          color: theme.accent,
          letterSpacing: 2,
          marginBottom: 8,
        }}>
          ⚡ BRAIN BLAST ⚡
        </div>
        <div className="display-font" style={{
          fontSize: "clamp(22px, 5vw, 32px)",
          fontWeight: 900,
        }}>
          Ready to crush it, {save.name}?
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}>
        {cards.map((c) => (
          <button
            key={c.id}
            className="card-tap"
            onClick={() => setScreen(c.id)}
            style={{
              background: `linear-gradient(135deg, ${theme.panel}, ${theme.panel}aa)`,
              border: `3px solid ${c.color}`,
              borderRadius: 20,
              padding: 20,
              cursor: "pointer",
              color: theme.text,
              textAlign: "left",
              minHeight: 140,
              display: "flex", flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: `0 8px 24px rgba(0,0,0,0.3), 0 0 0 0 ${c.color}`,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3), 0 0 30px ${c.color}66`}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3), 0 0 0 0 ${c.color}`}
          >
            <div style={{ fontSize: 44, marginBottom: 4 }}>{c.emoji}</div>
            <div>
              <div className="display-font" style={{ fontSize: 22, fontWeight: 900, color: c.color }}>
                {c.title}
              </div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{c.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{
        marginTop: 20,
        padding: 16,
        background: `linear-gradient(135deg, ${theme.accent}22, ${theme.accent2}22)`,
        borderRadius: 16,
        border: `1px dashed ${theme.accent}66`,
        textAlign: "center",
        fontSize: 14,
      }}>
        💡 <strong>Mark Rober says:</strong> "The secret to leveling up is just trying.
        Get it wrong? That's how engineers think — try again, smarter."
      </div>
    </div>
  );
}

// ============================================================================
// SPELLING MODULE
// ============================================================================
function SpellingModule({ save, setSave, theme, addXP, grantBadge, showToast, fireConfetti, back }) {
  const [phase, setPhase] = useState("pick-pack"); // pick-pack, pick-mode, play
  const [pack, setPack] = useState(null);
  const [mode, setMode] = useState("hear"); // hear, blank, scramble
  const [queue, setQueue] = useState([]);
  const [currentWord, setCurrentWord] = useState(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null); // {type, text}
  const [streak, setStreak] = useState(0);
  const [packCorrect, setPackCorrect] = useState(0);
  const [blankIdx, setBlankIdx] = useState(0);
  const [scrambled, setScrambled] = useState("");
  const inputRef = useRef(null);

  const masteredSet = useMemo(() => new Set(save.spelling.mastered), [save.spelling.mastered]);

  const startPack = (packKey) => {
    setPack(packKey);
    const p = SPELLING_PACKS[packKey];
    // Prioritize needs-practice from this pack, then unmastered words
    const needs = save.spelling.needsPractice.filter((w) => p.words.includes(w));
    const remaining = p.words.filter((w) => !masteredSet.has(w) && !needs.includes(w));
    const ordered = [...needs, ...remaining];
    const finalQueue = ordered.length ? ordered : [...p.words]; // if all mastered, do a victory lap
    setQueue([...finalQueue].sort(() => Math.random() - 0.5).slice(0, 10));
    setPhase("pick-mode");
    setPackCorrect(0);
  };

  const startMode = (m) => {
    setMode(m);
    setPhase("play");
    nextWord(queue, m);
  };

  const nextWord = (q, m = mode) => {
    if (q.length === 0) {
      // Pack done
      if (packCorrect >= 5) {
        grantBadge("rober_lab");
      }
      setPhase("pack-done");
      return;
    }
    const word = q[0];
    setCurrentWord(word);
    setInput("");
    setFeedback(null);
    if (m === "blank") {
      // hide a vowel or middle letter
      const idx = Math.max(1, Math.min(word.length - 2, Math.floor(word.length / 2)));
      setBlankIdx(idx);
    }
    if (m === "scramble") {
      setScrambled(shuffleString(word));
    }
    if (m === "hear") {
      setTimeout(() => speak(word), 300);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const submit = () => {
    if (!currentWord) return;
    const guess = input.trim().toLowerCase();
    const correct = currentWord.toLowerCase();
    if (!guess) return;

    const isRight = guess === correct;
    if (isRight) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setFeedback({ type: "correct", text: pickRandom(["🎯 Perfect!", "💥 Boom!", "⚡ Crushed it!", "🏆 Got it!", "🔥 Nailed!"]) });
      addXP(10, 2);

      // Update save
      setSave((s) => {
        const newMastered = s.spelling.mastered.includes(currentWord)
          ? s.spelling.mastered
          : [...s.spelling.mastered, currentWord];
        const newNeeds = s.spelling.needsPractice.filter((w) => w !== currentWord);
        const attempts = { ...s.spelling.attempts, [currentWord]: (s.spelling.attempts[currentWord] || 0) + 1 };
        const wordWizard = newMastered.length >= 25;
        if (wordWizard) setTimeout(() => grantBadge("word_wizard"), 200);
        if (newMastered.length === 1) setTimeout(() => grantBadge("first_word"), 200);
        return {
          ...s,
          spelling: {
            mastered: newMastered,
            needsPractice: newNeeds,
            attempts,
          },
          stats: {
            ...s.stats,
            totalCorrect: s.stats.totalCorrect + 1,
            bestStreak: Math.max(s.stats.bestStreak, newStreak),
          },
        };
      });

      if (newStreak === 3) grantBadge("hat_trick");
      if (newStreak === 10) grantBadge("streak_10");
      if (newStreak === 20) grantBadge("streak_20");

      setPackCorrect((c) => c + 1);

      setTimeout(() => {
        const newQueue = queue.slice(1);
        setQueue(newQueue);
        nextWord(newQueue);
      }, 1100);
    } else {
      setStreak(0);
      setFeedback({ type: "wrong", text: `Almost! It's "${currentWord}"` });
      // Add to needs practice and re-queue
      setSave((s) => ({
        ...s,
        spelling: {
          ...s.spelling,
          needsPractice: s.spelling.needsPractice.includes(currentWord)
            ? s.spelling.needsPractice
            : [...s.spelling.needsPractice, currentWord],
        },
        stats: { ...s.stats, totalWrong: s.stats.totalWrong + 1 },
      }));
      setTimeout(() => {
        // re-queue word at the end so it comes back
        const newQueue = [...queue.slice(1), currentWord];
        setQueue(newQueue);
        nextWord(newQueue);
      }, 3500);
    }
  };

  if (phase === "pick-pack") {
    return (
      <div style={{ animation: "slideUp 0.4s" }}>
        <BackBar back={back} title="✏️ SPELLING PACKS" theme={theme} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {Object.entries(SPELLING_PACKS).map(([key, p]) => {
            const masteredCount = p.words.filter((w) => masteredSet.has(w)).length;
            const pct = Math.round((masteredCount / p.words.length) * 100);
            return (
              <button
                key={key}
                className="card-tap"
                onClick={() => startPack(key)}
                style={{
                  background: `linear-gradient(135deg, ${p.color}22, ${theme.panel})`,
                  border: `2px solid ${p.color}`,
                  borderRadius: 16,
                  padding: 16,
                  color: theme.text,
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: `0 6px 20px rgba(0,0,0,0.25)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 32 }}>{p.emoji}</span>
                  <div className="display-font" style={{ fontSize: 18, fontWeight: 900, color: p.color }}>
                    {p.name}
                  </div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10, minHeight: 32 }}>
                  {p.pattern}
                </div>
                <ProgressBar value={masteredCount} max={p.words.length} accent={p.color} height={10} />
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                  {masteredCount} / {p.words.length} mastered ({pct}%)
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === "pick-mode") {
    const modes = [
      { id: "hear", emoji: "🔊", title: "Hear It", desc: "Listen, then type" },
      { id: "blank", emoji: "🧩", title: "Fill Blank", desc: "Complete the word" },
      { id: "scramble", emoji: "🔀", title: "Unscramble", desc: "Sort the letters" },
    ];
    return (
      <div style={{ animation: "slideUp 0.4s" }}>
        <BackBar back={() => setPhase("pick-pack")} title="Choose Your Challenge" theme={theme} />
        <div style={{ textAlign: "center", marginBottom: 16, fontSize: 14, opacity: 0.8 }}>
          📦 Pack: <strong>{SPELLING_PACKS[pack].name}</strong> • {queue.length} words queued
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {modes.map((m) => (
            <button
              key={m.id}
              className="card-tap"
              onClick={() => startMode(m.id)}
              style={{
                background: theme.panel,
                border: `3px solid ${theme.accent}`,
                borderRadius: 18,
                padding: 18,
                color: theme.text,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 16,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 40 }}>{m.emoji}</span>
              <div>
                <div className="display-font" style={{ fontSize: 20, fontWeight: 900 }}>{m.title}</div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "pack-done") {
    return (
      <div style={{ animation: "slideUp 0.4s", textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 80, marginBottom: 12 }}>🏆</div>
        <div className="display-font" style={{ fontSize: 32, fontWeight: 900, color: theme.accent, marginBottom: 8 }}>
          PACK COMPLETE!
        </div>
        <div style={{ fontSize: 18, marginBottom: 24 }}>
          You got {packCorrect} right in this round. 💪
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <BigButton onClick={() => { setPhase("pick-pack"); }} theme={theme}>
            More Packs
          </BigButton>
          <BigButton onClick={back} theme={theme} variant="ghost">
            Home
          </BigButton>
        </div>
      </div>
    );
  }

  // PLAY PHASE
  const packData = SPELLING_PACKS[pack];
  const totalThisRound = 10;
  const progressInRound = totalThisRound - queue.length;

  return (
    <div style={{ animation: "slideUp 0.4s" }}>
      <BackBar back={back} title={`${packData.emoji} ${packData.name}`} theme={theme} />

      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
        <span>Progress</span>
        <span>Streak: 🔥 {streak}</span>
      </div>
      <div style={{ marginBottom: 20 }}>
        <ProgressBar value={progressInRound} max={totalThisRound} accent={packData.color} height={8} />
      </div>

      <div style={{
        background: theme.panel,
        borderRadius: 20,
        padding: 24,
        border: `2px solid ${packData.color}`,
        textAlign: "center",
        minHeight: 280,
      }}>
        {mode === "hear" && (
          <>
            <div style={{ marginBottom: 16, fontSize: 14, opacity: 0.7 }}>
              Tap to hear the word, then type it.
            </div>
            <button
              onClick={() => speak(currentWord)}
              style={{
                fontSize: 60,
                width: 100, height: 100,
                borderRadius: 50,
                background: `linear-gradient(135deg, ${packData.color}, ${packData.color}aa)`,
                border: "none",
                color: theme.bg,
                cursor: "pointer",
                margin: "0 auto 20px",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "pulseGlow 2s infinite",
              }}
              aria-label="Hear the word"
            >
              🔊
            </button>
          </>
        )}

        {mode === "blank" && currentWord && (
          <>
            <div style={{ marginBottom: 16, fontSize: 14, opacity: 0.7 }}>
              Fill in the missing letter!
            </div>
            <div className="display-font" style={{
              fontSize: "clamp(36px, 8vw, 56px)",
              fontWeight: 900,
              letterSpacing: 4,
              marginBottom: 20,
              color: packData.color,
            }}>
              {currentWord.split("").map((ch, i) =>
                i === blankIdx ? <span key={i} style={{ color: theme.accent2 }}>_</span> : <span key={i}>{ch}</span>
              )}
            </div>
            <button
              onClick={() => speak(currentWord)}
              style={{
                fontSize: 14, padding: "8px 14px",
                background: "transparent", border: `1px solid ${packData.color}`,
                color: theme.text, borderRadius: 999, cursor: "pointer",
                marginBottom: 16,
              }}
            >🔊 Hear it</button>
          </>
        )}

        {mode === "scramble" && (
          <>
            <div style={{ marginBottom: 16, fontSize: 14, opacity: 0.7 }}>
              Unscramble these letters!
            </div>
            <div className="display-font" style={{
              fontSize: "clamp(32px, 8vw, 52px)",
              fontWeight: 900,
              letterSpacing: 8,
              marginBottom: 20,
              color: packData.color,
              textTransform: "uppercase",
            }}>
              {scrambled}
            </div>
            <button
              onClick={() => speak(currentWord)}
              style={{
                fontSize: 14, padding: "8px 14px",
                background: "transparent", border: `1px solid ${packData.color}`,
                color: theme.text, borderRadius: 999, cursor: "pointer",
                marginBottom: 16,
              }}
            >🔊 Hint (hear word)</button>
          </>
        )}

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={!!feedback}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          placeholder="type here..."
          style={{
            width: "100%",
            maxWidth: 320,
            padding: "14px 18px",
            fontSize: 22,
            fontWeight: 700,
            borderRadius: 14,
            border: `3px solid ${feedback?.type === "correct" ? "#22c55e" : feedback?.type === "wrong" ? "#ef4444" : packData.color}`,
            background: "rgba(255,255,255,0.08)",
            color: theme.text,
            textAlign: "center",
            marginBottom: 16,
            animation: feedback?.type === "wrong" ? "shake 0.4s" : "none",
          }}
        />

        {!feedback && (
          <BigButton onClick={submit} theme={theme} disabled={!input.trim()}>
            CHECK ✓
          </BigButton>
        )}

        {feedback && (
          <div style={{
            fontSize: 24,
            fontWeight: 900,
            color: feedback.type === "correct" ? "#22c55e" : "#ef4444",
            animation: "bounce 0.5s",
          }}>
            {feedback.text}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MATH MODULE
// ============================================================================
function MathModule({ save, setSave, theme, addXP, grantBadge, showToast, fireConfetti, back, goToCrunchLab }) {
  const [phase, setPhase] = useState("pick-topic"); // pick-topic, pick-mode, play, done
  const [topic, setTopic] = useState(null);
  const [mode, setMode] = useState("relaxed"); // relaxed, beatClock
  const [question, setQuestion] = useState(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [streak, setStreak] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [difficulty, setDifficulty] = useState(save.math.difficulty);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [rightStreak, setRightStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const topics = useMemo(() => [
    { id: "add100", name: "Add within 100", emoji: "➕", color: "#22c55e" },
    { id: "sub100", name: "Subtract within 100", emoji: "➖", color: "#ef4444" },
    { id: "add1000", name: "Add within 1000", emoji: "🔢", color: "#3b82f6" },
    { id: "sub1000", name: "Subtract within 1000", emoji: "🎯", color: "#f97316" },
    { id: "multTimes2", name: "×2 Tables", emoji: "✌️", color: "#a855f7" },
    { id: "multTimes3", name: "×3 Tables", emoji: "🥉", color: "#ec4899" },
    { id: "multTimes4", name: "×4 Tables", emoji: "🍀", color: "#10b981" },
    { id: "multTimes5", name: "×5 Tables", emoji: "🖐️", color: "#06b6d4" },
    { id: "time", name: "Telling Time", emoji: "⏰", color: "#eab308" },
    { id: "money", name: "Money Math", emoji: "💰", color: "#84cc16" },
    { id: "word-mix", name: "Word Problems", emoji: "📖", color: "#f59e0b" },
  ], []);

  // Generate a question for a topic at given difficulty
  const generateQuestion = useCallback((t, diff) => {
    const useWord = Math.random() < 0.4 || t === "word-mix";
    let pickTopic = t;
    if (t === "word-mix") {
      pickTopic = pickRandom(["add100", "sub100", "add1000", "sub1000", "multTimes2", "multTimes5"]);
    }

    // Build ranges based on difficulty (1 = easiest)
    const ranges = {
      add100: { 1: [10, 40], 2: [20, 70], 3: [30, 99] },
      sub100: { 1: [10, 40], 2: [20, 70], 3: [30, 99] },
      add1000: { 1: [100, 400], 2: [200, 700], 3: [300, 950] },
      sub1000: { 1: [100, 400], 2: [200, 700], 3: [300, 950] },
      multTimes2: { 1: [1, 6], 2: [1, 10], 3: [1, 12] },
      multTimes3: { 1: [1, 6], 2: [1, 10], 3: [1, 12] },
      multTimes4: { 1: [1, 6], 2: [1, 10], 3: [1, 12] },
      multTimes5: { 1: [1, 6], 2: [1, 10], 3: [1, 12] },
    };

    if (pickTopic === "time") {
      return wordProblemTemplates.time[0]();
    }
    if (pickTopic === "money") {
      return wordProblemTemplates.money[0]();
    }

    const r = ranges[pickTopic][diff] || [1, 10];

    if (pickTopic.startsWith("mult")) {
      const a = Math.floor(Math.random() * (r[1] - r[0] + 1)) + r[0];
      const multBy = pickTopic === "multTimes2" ? 2 : pickTopic === "multTimes3" ? 3 : pickTopic === "multTimes4" ? 4 : 5;
      if (useWord && wordProblemTemplates[pickTopic]) {
        const tmpl = pickRandom(wordProblemTemplates[pickTopic]);
        return tmpl(a);
      }
      return { q: `${a} × ${multBy} = ?`, ans: a * multBy };
    }

    let a = Math.floor(Math.random() * (r[1] - r[0] + 1)) + r[0];
    let b = Math.floor(Math.random() * (r[1] - r[0] + 1)) + r[0];
    if (pickTopic === "sub100" || pickTopic === "sub1000") {
      if (b > a) [a, b] = [b, a]; // ensure no negatives
    }
    if (useWord && wordProblemTemplates[pickTopic]) {
      const tmpl = pickRandom(wordProblemTemplates[pickTopic]);
      return tmpl(a, b);
    }
    const op = pickTopic.startsWith("add") ? "+" : "−";
    return { q: `${a} ${op} ${b} = ?`, ans: pickTopic.startsWith("add") ? a + b : a - b };
  }, []);

  const newQuestion = useCallback((t = topic, d = difficulty) => {
    const q = generateQuestion(t, d);
    setQuestion(q);
    setInput("");
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [topic, difficulty, generateQuestion]);

  // Use ref to access fresh sessionCorrect inside the timer closure
  const sessionCorrectRef = useRef(0);
  useEffect(() => { sessionCorrectRef.current = sessionCorrect; }, [sessionCorrect]);

  // Timer for beat-the-clock
  useEffect(() => {
    if (phase === "play" && mode === "beatClock") {
      setTimeLeft(60);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            if (sessionCorrectRef.current >= 10) grantBadge("speed_demon");
            setPhase("done");
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [phase, mode, grantBadge]);

  const startTopic = (t) => {
    setTopic(t);
    setPhase("pick-mode");
  };

  const startMode = (m) => {
    setMode(m);
    setPhase("play");
    setSessionCorrect(0);
    setSessionTotal(0);
    setStreak(0);
    setRightStreak(0);
    setWrongStreak(0);
    newQuestion(topic, difficulty);
  };

  const submit = () => {
    if (!question) return;
    const guess = question.options ? input : input.trim();
    if (!guess) return;
    const isRight = question.options
      ? guess === question.ans
      : Number(guess) === Number(question.ans);

    setSessionTotal((t) => t + 1);

    if (isRight) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setRightStreak((r) => r + 1);
      setWrongStreak(0);
      setFeedback({ type: "correct", text: pickRandom(["🎯 Boom!", "💥 Yes!", "⚡ Fast!", "🏆 Got it!", "🔥 Nice!"]) });
      addXP(10 + difficulty * 2, 2 + difficulty);
      setSessionCorrect((c) => c + 1);

      const factKey = question.q;
      setSave((s) => {
        const masteredFacts = s.math.masteredFacts.includes(factKey)
          ? s.math.masteredFacts
          : [...s.math.masteredFacts, factKey];
        if (masteredFacts.length === 1) setTimeout(() => grantBadge("first_math"), 200);
        if (masteredFacts.length >= 25) setTimeout(() => grantBadge("math_master"), 200);
        return {
          ...s,
          math: {
            ...s.math,
            masteredFacts: masteredFacts.slice(-200), // cap to keep things fast
            streakInSession: newStreak,
            correctTotal: s.math.correctTotal + 1,
          },
          stats: {
            ...s.stats,
            totalCorrect: s.stats.totalCorrect + 1,
            bestStreak: Math.max(s.stats.bestStreak, newStreak),
          },
        };
      });

      if (newStreak === 3) grantBadge("hat_trick");
      if (newStreak === 10) grantBadge("streak_10");
      if (newStreak === 20) grantBadge("streak_20");

      // Adaptive bump
      if (rightStreak + 1 >= 3 && difficulty < 3) {
        const newDiff = difficulty + 1;
        setDifficulty(newDiff);
        setSave((s) => ({ ...s, math: { ...s.math, difficulty: newDiff } }));
        showToast(`📈 LEVEL UP! Difficulty ${newDiff}`, "success");
        setRightStreak(0);
      }

      setTimeout(() => newQuestion(topic, difficulty), 1200);
    } else {
      setStreak(0);
      setWrongStreak((w) => w + 1);
      setRightStreak(0);
      const encouragement = pickRandom([
        `Close! Answer was ${question.ans}. That's how engineers think — try the next one!`,
        `Not quite! It's ${question.ans}. Every wrong answer teaches your brain something.`,
        `Answer: ${question.ans}. Mark Rober missed 100s before nailing the glitter bomb!`,
        `So close! ${question.ans}. Your brain just leveled up by making that mistake.`,
        `It was ${question.ans}. Engineers love mistakes — they're how you find the right answer.`,
      ]);
      setFeedback({ type: "wrong", text: encouragement });
      setSave((s) => ({
        ...s,
        math: { ...s.math, wrongTotal: s.math.wrongTotal + 1, streakInSession: 0 },
        stats: { ...s.stats, totalWrong: s.stats.totalWrong + 1 },
      }));

      // Adaptive step back
      if (wrongStreak + 1 >= 2 && difficulty > 1) {
        const newDiff = difficulty - 1;
        setDifficulty(newDiff);
        setSave((s) => ({ ...s, math: { ...s.math, difficulty: newDiff } }));
        showToast(`💪 Stepping back — you got this!`, "success");
        setWrongStreak(0);
      }

      setTimeout(() => newQuestion(topic, difficulty), 3500);
    }
  };

  if (phase === "pick-topic") {
    // Figure out next unlocked and upcoming locked missions for the teaser
    const completedIds = save.crunchlab?.completed || [];
    const unlockedMissions = CRUNCH_CHALLENGES.filter((c) => save.level >= c.unlockLevel);
    const lockedMissions   = CRUNCH_CHALLENGES.filter((c) => save.level < c.unlockLevel);
    const nextMission      = unlockedMissions.find((c) => !completedIds.includes(c.id));
    const nextLocked       = lockedMissions[0];
    const completedCount   = completedIds.length;
    const totalMissions    = CRUNCH_CHALLENGES.length;

    return (
      <div style={{ animation: "slideUp 0.4s" }}>
        <BackBar back={back} title="🧮 MATH TOPICS" theme={theme} />
        <div style={{ marginBottom: 12, fontSize: 14, opacity: 0.7, textAlign: "center" }}>
          Difficulty auto-adjusts as you play. Just pick a topic!
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 28 }}>
          {topics.map((t) => (
            <button
              key={t.id}
              className="card-tap"
              onClick={() => startTopic(t.id)}
              style={{
                background: `linear-gradient(135deg, ${t.color}22, ${theme.panel})`,
                border: `2px solid ${t.color}`,
                borderRadius: 14,
                padding: 14,
                color: theme.text,
                cursor: "pointer",
                textAlign: "left",
                minHeight: 88,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 4 }}>{t.emoji}</div>
              <div className="display-font" style={{ fontSize: 15, fontWeight: 900, color: t.color, lineHeight: 1.2 }}>
                {t.name}
              </div>
            </button>
          ))}
        </div>

        {/* ── CrunchLab Challenge Section ──────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, #071a0e 0%, #0d2b18 60%, #071a0e 100%)",
          border: "2px solid #00ff88",
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: "0 0 50px #00ff8822, inset 0 1px 0 rgba(0,255,136,0.15)",
        }}>
          {/* Header bar */}
          <div style={{
            background: "linear-gradient(90deg, #00ff8822, #00ff8811, #00ff8822)",
            borderBottom: "1px solid #00ff8833",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>🧪</span>
              <div>
                <div className="pixel-font" style={{
                  fontSize: 10, color: "#00ff88", letterSpacing: 2, marginBottom: 2,
                }}>
                  MARK ROBER'S
                </div>
                <div className="display-font" style={{
                  fontSize: 20, fontWeight: 900, color: "#00ff88", lineHeight: 1,
                }}>
                  CrunchLab Challenges
                </div>
              </div>
            </div>
            <div style={{
              background: "rgba(0,255,136,0.12)",
              border: "1px solid #00ff8855",
              borderRadius: 999,
              padding: "4px 14px",
              fontSize: 12,
              fontWeight: 900,
              color: "#00ff88",
              whiteSpace: "nowrap",
            }}>
              {completedCount} / {totalMissions} done
            </div>
          </div>

          <div style={{ padding: "18px 20px 20px" }}>
            {/* Blurb */}
            <div style={{
              fontSize: 13,
              lineHeight: 1.7,
              opacity: 0.8,
              marginBottom: 18,
            }}>
              Real science and engineering challenges straight from Mark Rober's lab — unlocked as you level up! Each mission has a mystery problem, a brain-bending question, and a secret science fact at the end. 🚀
            </div>

            {/* NEXT AVAILABLE mission — big launch card */}
            {nextMission ? (
              <div style={{
                background: `linear-gradient(135deg, ${nextMission.color}18, rgba(0,0,0,0.35))`,
                border: `2px solid ${nextMission.color}`,
                borderRadius: 18,
                padding: 18,
                marginBottom: 16,
                boxShadow: `0 0 30px ${nextMission.color}22`,
              }}>
                <div className="pixel-font" style={{
                  fontSize: 8, color: nextMission.color, letterSpacing: 2, marginBottom: 10,
                }}>
                  ▶ NEXT MISSION
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                  <div style={{
                    fontSize: 44, width: 64, height: 64, borderRadius: 16, flexShrink: 0,
                    background: `${nextMission.color}22`,
                    border: `2px solid ${nextMission.color}88`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 20px ${nextMission.color}44`,
                  }}>
                    {nextMission.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="display-font" style={{
                      fontSize: 20, fontWeight: 900, color: nextMission.color, marginBottom: 4,
                    }}>
                      {nextMission.name}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
                      {nextMission.tagline}
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
                      {nextMission.questions.map((_, i) => {
                        const prog = save.crunchlab?.inProgress?.[nextMission.id] || 0;
                        return (
                          <div key={i} style={{
                            width: 12, height: 12, borderRadius: "50%",
                            background: i < prog ? nextMission.color : "rgba(255,255,255,0.12)",
                            border: `2px solid ${nextMission.color}55`,
                            boxShadow: i < prog ? `0 0 8px ${nextMission.color}` : "none",
                          }} />
                        );
                      })}
                      <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 4, alignSelf: "center" }}>
                        {nextMission.questions.length} questions
                      </span>
                    </div>
                  </div>
                </div>
                {/* Preview of first question */}
                <div style={{
                  background: "rgba(0,0,0,0.3)",
                  border: `1px dashed ${nextMission.color}55`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 14,
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontStyle: "italic",
                  opacity: 0.9,
                }}>
                  <span style={{ color: nextMission.color, fontWeight: 900, fontStyle: "normal" }}>Q1 preview: </span>
                  {nextMission.questions[0].q}
                </div>
                <button
                  onClick={goToCrunchLab}
                  className="card-tap"
                  style={{
                    width: "100%",
                    background: `linear-gradient(135deg, ${nextMission.color}, ${nextMission.color}bb)`,
                    border: "none",
                    borderRadius: 14,
                    padding: "14px 20px",
                    color: "#000",
                    fontSize: 16,
                    fontWeight: 900,
                    cursor: "pointer",
                    letterSpacing: 0.5,
                    boxShadow: `0 6px 24px ${nextMission.color}55`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  🚀 Launch Mission
                </button>
              </div>
            ) : unlockedMissions.length > 0 ? (
              // All unlocked missions complete
              <div style={{
                background: "linear-gradient(135deg, #22c55e22, rgba(0,0,0,0.3))",
                border: "2px solid #22c55e",
                borderRadius: 18,
                padding: 20,
                textAlign: "center",
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
                <div className="display-font" style={{ fontSize: 22, fontWeight: 900, color: "#22c55e" }}>
                  All missions complete!
                </div>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
                  You've crushed every unlocked CrunchLab challenge. Level up to unlock more!
                </div>
                <button onClick={goToCrunchLab} style={{
                  marginTop: 14, background: "transparent",
                  border: "2px solid #22c55e", color: "#22c55e",
                  padding: "10px 20px", borderRadius: 12,
                  fontWeight: 900, cursor: "pointer", fontSize: 14,
                }}>
                  Replay missions 🔁
                </button>
              </div>
            ) : null}

            {/* COMING UP — locked missions teaser strip */}
            {lockedMissions.length > 0 && (
              <div>
                <div className="pixel-font" style={{
                  fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 10,
                }}>
                  🔒 COMING UP AS YOU LEVEL UP
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {lockedMissions.slice(0, 4).map((ch) => (
                    <div key={ch.id} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      opacity: 0.55,
                    }}>
                      <span style={{ fontSize: 24, filter: "grayscale(1) brightness(0.5)" }}>
                        {ch.emoji}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{ch.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{ch.tagline}</div>
                      </div>
                      <div style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 999,
                        padding: "3px 10px",
                        fontSize: 10,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                        color: "rgba(255,255,255,0.5)",
                      }}>
                        🔒 Lv {ch.unlockLevel}
                      </div>
                    </div>
                  ))}
                  {lockedMissions.length > 4 && (
                    <div style={{
                      textAlign: "center", fontSize: 12, opacity: 0.4, padding: "4px 0",
                    }}>
                      + {lockedMissions.length - 4} more missions waiting for you...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "pick-mode") {
    return (
      <div style={{ animation: "slideUp 0.4s" }}>
        <BackBar back={() => setPhase("pick-topic")} title="Pick Mode" theme={theme} />
        <div style={{ display: "grid", gap: 12 }}>
          <button
            className="card-tap"
            onClick={() => startMode("relaxed")}
            style={{
              background: theme.panel,
              border: `3px solid #22c55e`,
              borderRadius: 18, padding: 20,
              color: theme.text, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 16,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 44 }}>🧠</span>
            <div>
              <div className="display-font" style={{ fontSize: 22, fontWeight: 900 }}>Relaxed</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>Take your time. No timer.</div>
            </div>
          </button>
          <button
            className="card-tap"
            onClick={() => startMode("beatClock")}
            style={{
              background: theme.panel,
              border: `3px solid #ef4444`,
              borderRadius: 18, padding: 20,
              color: theme.text, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 16,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 44 }}>⏱️</span>
            <div>
              <div className="display-font" style={{ fontSize: 22, fontWeight: 900 }}>Beat the Clock</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>60 seconds. Earn double coins!</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div style={{ animation: "slideUp 0.4s", textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 80, marginBottom: 12 }}>{sessionCorrect >= 10 ? "🏆" : "⚡"}</div>
        <div className="display-font" style={{ fontSize: 32, fontWeight: 900, color: theme.accent, marginBottom: 8 }}>
          TIME'S UP!
        </div>
        <div style={{ fontSize: 22, marginBottom: 6 }}>
          ✅ {sessionCorrect} correct out of {sessionTotal}
        </div>
        <div style={{ fontSize: 16, opacity: 0.75, marginBottom: 24 }}>
          {sessionCorrect >= 15 ? "🤯 ABSOLUTE LEGEND" :
           sessionCorrect >= 10 ? "🔥 Speed demon mode!" :
           sessionCorrect >= 5 ? "💪 Solid run!" :
           "🚀 Every rep gets you stronger."}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <BigButton onClick={() => { setPhase("pick-mode"); }} theme={theme}>Play Again</BigButton>
          <BigButton onClick={back} theme={theme} variant="ghost">Home</BigButton>
        </div>
      </div>
    );
  }

  // PLAY
  return (
    <div style={{ animation: "slideUp 0.4s" }}>
      <BackBar back={back} title={topics.find((t) => t.id === topic)?.name} theme={theme} />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          🔥 Streak: <strong>{streak}</strong> • ⚙️ Diff: <strong>{difficulty}</strong>
        </div>
        {mode === "beatClock" && (
          <div style={{
            background: timeLeft < 10 ? "#ef4444" : theme.accent,
            color: theme.bg,
            padding: "4px 12px",
            borderRadius: 999,
            fontWeight: 900,
            fontSize: 16,
            animation: timeLeft < 10 ? "shake 0.5s infinite" : "none",
          }}>
            ⏱ {timeLeft}s
          </div>
        )}
      </div>

      <div style={{
        background: theme.panel,
        borderRadius: 20,
        padding: 24,
        border: `2px solid ${theme.accent}`,
        textAlign: "center",
        minHeight: 280,
      }}>
        <div className="display-font" style={{
          fontSize: question?.q?.length > 50 ? "clamp(18px, 4vw, 24px)" : "clamp(24px, 6vw, 36px)",
          fontWeight: 700,
          marginBottom: 16,
          lineHeight: 1.3,
          color: theme.text,
        }}>
          {question?.q}
        </div>

        {question?.q && question.q.length > 30 && (
          <button
            onClick={() => speak(question.q.replace(/[🏀⚽🏈🚀🎮🧪🤖⏰💰🏆🎯🏟️🪐🏎️📖🔢➕➖✌️🥉🍀🖐️]/g, ""))}
            style={{
              fontSize: 13, padding: "6px 12px",
              background: "transparent", border: `1px solid ${theme.accent}66`,
              color: theme.text, borderRadius: 999, cursor: "pointer",
              marginBottom: 16,
            }}
          >🔊 Read it to me</button>
        )}

        {question?.options ? (
          <div style={{ display: "grid", gap: 10, maxWidth: 400, margin: "0 auto 16px" }}>
            {question.options.map((opt) => (
              <button
                key={opt}
                onClick={() => { setInput(opt); setTimeout(submit, 50); }}
                disabled={!!feedback}
                style={{
                  background: feedback && opt === question.ans ? "#22c55e" :
                              feedback && opt === input && opt !== question.ans ? "#ef4444" :
                              "rgba(255,255,255,0.08)",
                  border: `2px solid ${theme.accent}66`,
                  borderRadius: 12,
                  padding: "14px 20px",
                  color: theme.text,
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: feedback ? "default" : "pointer",
                  textAlign: "center",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={!!feedback}
              placeholder="?"
              style={{
                width: 180,
                padding: "18px 12px",
                fontSize: 36,
                fontWeight: 900,
                borderRadius: 14,
                border: `3px solid ${feedback?.type === "correct" ? "#22c55e" : feedback?.type === "wrong" ? "#ef4444" : theme.accent}`,
                background: "rgba(255,255,255,0.08)",
                color: theme.text,
                textAlign: "center",
                marginBottom: 16,
                animation: feedback?.type === "wrong" ? "shake 0.4s" : "none",
              }}
            />
            <div>
              {!feedback && (
                <BigButton onClick={submit} theme={theme} disabled={!input.trim()}>
                  GO ⚡
                </BigButton>
              )}
            </div>
          </>
        )}

        {feedback && (
          <div style={{
            fontSize: feedback.text.length > 30 ? 15 : 22,
            fontWeight: 700,
            color: feedback.type === "correct" ? "#22c55e" : "#fbbf24",
            marginTop: 12,
            lineHeight: 1.4,
            padding: "0 8px",
            animation: "bounce 0.5s",
          }}>
            {feedback.text}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CRUNCHLAB CHALLENGES — 20 engineering/science missions, level-gated
// ============================================================================
const CRUNCH_CHALLENGES = [
  {
    id: "glitter_bomb",
    name: "Glitter Bomb v1.0",
    emoji: "✨",
    unlockLevel: 1,
    color: "#ff00cc",
    tagline: "Design Mark Rober's legendary package-thief trap!",
    scienceFact: "Mark's glitter bomb used a custom circuit board, 4 phones, and over 1 POUND of glitter. Engineers call this 'payload deployment.' 🤯",
    questions: [
      { q: "Mark needs 4 glitter canisters. Each holds 35 grams. How many grams of glitter total?", ans: 140, hint: "4 groups of 35", unit: "grams" },
      { q: "The trap spins for 8 seconds and releases 25 pieces of glitter per second. How many total pieces fly out?", ans: 200, hint: "8 × 25", unit: "pieces" },
      { q: "Mark made 3 versions of the glitter bomb. Version 1 cost $150, version 2 cost $200, version 3 cost $175. Total cost?", ans: 525, hint: "Add all three together", unit: "dollars" },
    ],
  },
  {
    id: "squirrel_maze",
    name: "Squirrel Obstacle Course",
    emoji: "🐿️",
    unlockLevel: 1,
    color: "#ff8800",
    tagline: "Build the ultimate squirrel ninja warrior course!",
    scienceFact: "Squirrels can jump 10 feet horizontally and 5 feet vertically. Mark used this to engineer obstacles they literally couldn't beat — but they did anyway! 😂",
    questions: [
      { q: "Mark's obstacle course has 6 sections. Each section is 4 feet long. How long is the full course?", ans: 24, hint: "6 × 4", unit: "feet" },
      { q: "A squirrel ran the course 12 times in one day. If each run took 3 minutes, how many minutes total?", ans: 36, hint: "12 × 3", unit: "minutes" },
      { q: "Mark put 48 nuts as rewards along the course. Squirrels collected 29. How many are left?", ans: 19, hint: "48 − 29", unit: "nuts" },
    ],
  },
  {
    id: "dart_board",
    name: "Auto-Bullseye Dartboard",
    emoji: "🎯",
    unlockLevel: 2,
    color: "#ff4444",
    tagline: "Engineer a dartboard that MOVES to catch every dart!",
    scienceFact: "Mark's automatic bullseye dartboard uses 6 cameras tracking the dart at 1000 frames per second and 4 motors to reposition the board in under 0.4 seconds! 🎯",
    questions: [
      { q: "The dartboard has 6 cameras. Each records 1000 frames per second. How many frames do ALL cameras record each second?", ans: 6000, hint: "6 × 1000", unit: "frames" },
      { q: "The board moved 315 times on Monday and 248 times on Tuesday. How many total moves?", ans: 563, hint: "315 + 248", unit: "moves" },
      { q: "A regulation dartboard is 18 inches wide. Mark's motorized frame adds 6 inches on each side. Total width?", ans: 30, hint: "18 + 6 + 6", unit: "inches" },
    ],
  },
  {
    id: "worlds_largest_nerf",
    name: "World's Largest NERF Gun",
    emoji: "🔫",
    unlockLevel: 2,
    color: "#00ccff",
    tagline: "Scale up a NERF blaster to the size of a car!",
    scienceFact: "Mark's giant NERF gun fires darts at 40 mph using pressurized air — the same principle used in pneumatic nail guns on construction sites! 🏗️",
    questions: [
      { q: "A regular NERF dart is 3 inches long. Mark's giant dart is 5 times longer. How long is the giant dart?", ans: 15, hint: "3 × 5", unit: "inches" },
      { q: "The giant NERF gun weighs 175 pounds. A regular NERF gun weighs 2 pounds. How much heavier?", ans: 173, hint: "175 − 2", unit: "pounds" },
      { q: "Mark fired 4 shots, then 3 more. How many total shots?", ans: 7, hint: "4 + 3", unit: "shots" },
    ],
  },
  {
    id: "rocket_ship",
    name: "Backyard Rocket Science",
    emoji: "🚀",
    unlockLevel: 3,
    color: "#ff6600",
    tagline: "Calculate thrust, fuel, and launch trajectories!",
    scienceFact: "Rockets use Newton's 3rd Law: every action has an equal and opposite reaction. When hot gas shoots DOWN, the rocket goes UP! Mark tested this with a 30-foot water rocket. 🌊",
    questions: [
      { q: "Mark's water rocket uses 5 gallons per launch. He launches it 4 times. How many gallons total?", ans: 20, hint: "5 × 4", unit: "gallons" },
      { q: "The rocket reached 450 feet high. It came back down 380 feet before Mark caught it. How high was it when he caught it?", ans: 70, hint: "450 − 380", unit: "feet" },
      { q: "Each launch needs 45 seconds of setup. For 6 launches, total setup time?", ans: 270, hint: "45 × 6", unit: "seconds" },
    ],
  },
  {
    id: "marble_run",
    name: "World Record Marble Run",
    emoji: "⚪",
    unlockLevel: 3,
    color: "#aa44ff",
    tagline: "Design a marble run using gravity, speed, and engineering!",
    scienceFact: "Gravity accelerates objects at 9.8 meters per second squared. That's why a marble on a steeper ramp goes FASTER — more gravity pulling it down the slope! 📐",
    questions: [
      { q: "Mark's marble run has 12 ramps. Each is 3 feet long. Total length of all ramps?", ans: 36, hint: "12 × 3", unit: "feet" },
      { q: "Mark used 250 regular marbles and 18 special gold marbles. How many total?", ans: 268, hint: "250 + 18", unit: "marbles" },
      { q: "The marble drops 8 inches on each ramp. Across 12 ramps, total drop?", ans: 96, hint: "8 × 12", unit: "inches" },
    ],
  },
  {
    id: "sand_castle",
    name: "World's Largest Sand Castle",
    emoji: "🏰",
    unlockLevel: 4,
    color: "#f0c040",
    tagline: "Engineering the tallest, strongest sand castle ever built!",
    scienceFact: "Engineers use a ratio of 8 parts sand to 1 part water for the strongest sand castles. Too wet = crumbles. Too dry = falls apart. Finding the right ratio IS engineering! ⚗️",
    questions: [
      { q: "Mark's team used 700 buckets of sand. Each bucket weighed 5 pounds. Total weight?", ans: 3500, hint: "700 × 5", unit: "pounds" },
      { q: "Building took 3 days: 8 hours, then 9 hours, then 7 hours. Total hours worked?", ans: 24, hint: "8 + 9 + 7", unit: "hours" },
      { q: "The castle is 54 feet tall. Normal sandcastles are 3 feet tall. How many times taller?", ans: 18, hint: "54 ÷ 3 — count 3s up to 54", unit: "times taller" },
    ],
  },
  {
    id: "trebuchet",
    name: "Medieval Trebuchet Launch",
    emoji: "⚔️",
    unlockLevel: 4,
    color: "#c47a2a",
    tagline: "Ancient war machine meets modern engineering math!",
    scienceFact: "A trebuchet converts potential energy (heavy counterweight) into kinetic energy (flying object). Medieval engineers figured this out 800 years before Newton wrote his laws! 🏰",
    questions: [
      { q: "The trebuchet arm is 24 feet long. The short side is 6 feet. How much longer is the long side?", ans: 18, hint: "24 − 6", unit: "feet" },
      { q: "It launches a 10-pound pumpkin 300 feet. If it launches 5 pumpkins, combined distance?", ans: 1500, hint: "300 × 5", unit: "feet" },
      { q: "The counterweight is 500 pounds. Each sandbag is 25 pounds. How many sandbags?", ans: 20, hint: "Count by 25s up to 500", unit: "sandbags" },
    ],
  },
  {
    id: "weather_balloon",
    name: "Weather Balloon to Space",
    emoji: "🎈",
    unlockLevel: 5,
    color: "#00aaff",
    tagline: "Send a camera 100,000 feet into the stratosphere!",
    scienceFact: "Weather balloons expand as they rise because air pressure decreases. A balloon 4 feet wide at launch can grow to 20 feet wide before it pops at 100,000 feet! 🌍",
    questions: [
      { q: "The balloon rises 1,000 feet per minute. After 35 minutes, how high is it?", ans: 35000, hint: "1000 × 35", unit: "feet" },
      { q: "The camera weighs 340g, battery 115g, parachute 85g. Total payload weight?", ans: 540, hint: "340 + 115 + 85", unit: "grams" },
      { q: "The team drove 47 miles to recover it. Same distance back. Total miles driven?", ans: 94, hint: "47 + 47", unit: "miles" },
    ],
  },
  {
    id: "liquid_sand",
    name: "Liquid Sand Hot Tub",
    emoji: "🏖️",
    unlockLevel: 5,
    color: "#ffd700",
    tagline: "Use physics to turn solid sand into flowing liquid!",
    scienceFact: "Fluidized sand happens when you pump air upward through sand at just the right rate. Each grain floats on air bubbles so it acts like a liquid — you can SWIM in it! 🤯",
    questions: [
      { q: "The hot tub has 4 air jets. Mark adds 2 more. Total jets?", ans: 6, hint: "4 + 2", unit: "jets" },
      { q: "Sand weighs 100 pounds per cubic foot. The tub holds 8 cubic feet. Total weight?", ans: 800, hint: "100 × 8", unit: "pounds" },
      { q: "It took 12 minutes to fill the tub and 8 minutes to set up the air pump. Total setup time?", ans: 20, hint: "12 + 8", unit: "minutes" },
    ],
  },
  {
    id: "drone_swarm",
    name: "100 Drone Light Show",
    emoji: "🛸",
    unlockLevel: 6,
    color: "#00ffaa",
    tagline: "Choreograph a swarm of drones using math and code!",
    scienceFact: "Each drone in a swarm runs an algorithm to avoid collisions in real time. 100 drones each checking 99 others = 9,900 calculations happening every single second! 💻",
    questions: [
      { q: "Mark has 100 drones. Each battery lasts 12 minutes. Total flying time across all drones?", ans: 1200, hint: "100 × 12", unit: "minutes" },
      { q: "The drones flew in a square formation: 40 feet wide and 40 feet tall. Perimeter?", ans: 160, hint: "40 + 40 + 40 + 40", unit: "feet" },
      { q: "Each drone costs $450. Mark bought 8 to start. Total cost?", ans: 3600, hint: "450 × 8", unit: "dollars" },
    ],
  },
  {
    id: "cardboard_boat",
    name: "Cardboard Boat Engineering",
    emoji: "⛵",
    unlockLevel: 6,
    color: "#40c0ff",
    tagline: "Can cardboard and tape really float? Engineer it to find out!",
    scienceFact: "Boats float because of buoyancy — water pushes UP with force equal to the weight of water displaced. Shape matters MORE than material! 🌊",
    questions: [
      { q: "Mark's cardboard boat is 6 feet long and 3 feet wide. Area of the bottom?", ans: 18, hint: "6 × 3", unit: "sq feet" },
      { q: "The boat holds 200 pounds before sinking. Mark weighs 180 pounds. How many more pounds can it hold?", ans: 20, hint: "200 − 180", unit: "pounds" },
      { q: "He used 14 sheets of cardboard at $3 each. Total cost?", ans: 42, hint: "14 × 3", unit: "dollars" },
    ],
  },
  {
    id: "giant_water_gun",
    name: "World's Largest Water Gun",
    emoji: "💦",
    unlockLevel: 7,
    color: "#0088ff",
    tagline: "Supersize a squirt gun using hydraulics and pressure!",
    scienceFact: "Water pressure depends on height — every 2.3 feet of water height creates 1 PSI of pressure. Mark's tank was 23 feet tall, giving serious water pressure! 💧",
    questions: [
      { q: "The gun shoots 50 gallons per minute. How many gallons in 4 minutes?", ans: 200, hint: "50 × 4", unit: "gallons" },
      { q: "Mark soaked 15 people. Each person got hit by 3 gallons. Total gallons used?", ans: 45, hint: "15 × 3", unit: "gallons" },
      { q: "The stream reaches 35 feet. A regular squirt gun reaches 12 feet. How much farther does Mark's go?", ans: 23, hint: "35 − 12", unit: "feet" },
    ],
  },
  {
    id: "electromagnetic",
    name: "Electromagnetic Launcher",
    emoji: "⚡",
    unlockLevel: 7,
    color: "#ffcc00",
    tagline: "Use electricity and magnetism to launch objects without explosions!",
    scienceFact: "A coilgun uses electricity to create a magnetic field that pulls a metal projectile forward at high speed. No gunpowder, no explosion — just pure physics! ⚡🔬",
    questions: [
      { q: "The coilgun has 8 coils. Mark adds 3 extra. How many coils total?", ans: 11, hint: "8 + 3", unit: "coils" },
      { q: "Each steel ball weighs 50 grams. He shoots 6 balls. Total weight launched?", ans: 300, hint: "50 × 6", unit: "grams" },
      { q: "The launcher needs 240 volts per coil. With 8 coils all firing, total volts used?", ans: 1920, hint: "240 × 8", unit: "volts" },
    ],
  },
  {
    id: "halloween_candy",
    name: "Candy Dispensing Robot",
    emoji: "🍬",
    unlockLevel: 8,
    color: "#ff6688",
    tagline: "Engineer a robot that gives out the PERFECT amount of Halloween candy!",
    scienceFact: "Mark's candy robot uses computer vision — the same technology in self-driving cars — to detect your costume and give MORE candy for creative ones! 🤖",
    questions: [
      { q: "The robot started with 500 pieces. It gave 3 pieces to each of 75 trick-or-treaters. How many pieces left?", ans: 275, hint: "75 × 3 = 225, then 500 − 225", unit: "pieces" },
      { q: "Creative costumes get 5 pieces, basic get 2. 20 creative costumes came. Total pieces for them?", ans: 100, hint: "20 × 5", unit: "pieces" },
      { q: "The robot arm spins 360 degrees per second. Each dispense needs 90 degrees. Dispenses per second?", ans: 4, hint: "360 ÷ 90 — how many 90s fit in 360?", unit: "per second" },
    ],
  },
  {
    id: "supersoaker",
    name: "Backpack SuperSoaker Upgrade",
    emoji: "🎒",
    unlockLevel: 8,
    color: "#00ddff",
    tagline: "Engineer the ultimate water backpack using pressure and volume!",
    scienceFact: "The Super Soaker was invented by Lonnie Johnson — a NASA engineer! He used the same pressurization principles from spacecraft fuel systems in a squirt gun. 🚀💦",
    questions: [
      { q: "The tank holds 4 liters (4000 mL). Each shot uses 250 mL. How many shots before empty?", ans: 16, hint: "Count 250s up to 4000", unit: "shots" },
      { q: "Mark upgraded 3 SuperSoakers. Each originally had 1 nozzle; he added 2 more each. Total nozzles now?", ans: 9, hint: "Each has 3 nozzles (1+2), then 3×3", unit: "nozzles" },
      { q: "His stream reaches 35 feet. A regular squirt gun reaches 12 feet. How much farther?", ans: 23, hint: "35 − 12", unit: "feet" },
    ],
  },
  {
    id: "prison_escape",
    name: "Escape Room Physics Challenge",
    emoji: "🔐",
    unlockLevel: 9,
    color: "#888888",
    tagline: "Use engineering and math to solve escape room puzzles!",
    scienceFact: "Real escape artists use physics! Understanding how locks are BUILT is how you figure out how to open them without a key. It's engineering in reverse! 🔓",
    questions: [
      { q: "A combo lock has 3 dials, each with 10 numbers (0-9). How many possible combinations? (10 × 10 × 10)", ans: 1000, hint: "10 × 10 = 100, then 100 × 10", unit: "combinations" },
      { q: "The room has 7 locks. Mark solved 4 in 10 minutes. How many remain?", ans: 3, hint: "7 − 4", unit: "locks" },
      { q: "60 seconds on the clock. Mark used 38 seconds. How many seconds left?", ans: 22, hint: "60 − 38", unit: "seconds" },
    ],
  },
  {
    id: "cardboard_city",
    name: "CrunchLabs Cardboard City",
    emoji: "🏙️",
    unlockLevel: 10,
    color: "#ff8844",
    tagline: "Build a scale model city using measurement and ratios!",
    scienceFact: "Architects use scale models to test buildings before construction. At 1:100 scale, 1 inch on the model = 100 inches (over 8 feet) on the real building! 📐",
    questions: [
      { q: "At 1:100 scale, a 500-inch real building becomes how many inches on the model?", ans: 5, hint: "500 ÷ 100", unit: "inches" },
      { q: "The city model covers 8 feet × 6 feet of table space. Total area?", ans: 48, hint: "8 × 6", unit: "sq feet" },
      { q: "Mark's team of 5 builders each spent 4 hours on the model. Total hours worked?", ans: 20, hint: "5 × 4", unit: "hours" },
    ],
  },
  {
    id: "bowling_trick",
    name: "Trick Shot Physics Lab",
    emoji: "🎳",
    unlockLevel: 10,
    color: "#ff44aa",
    tagline: "Use angles and force to engineer the perfect trick shot!",
    scienceFact: "When a spinning ball hits a wall at an angle, the angle of reflection equals the angle of incidence. The same rule governs light bouncing off mirrors! 🪞",
    questions: [
      { q: "Mark's trick shot bounced off 3 walls. If each bounce changes direction by 45 degrees, total direction change?", ans: 135, hint: "45 × 3", unit: "degrees" },
      { q: "The lane is 60 feet. The ball rolled 60 feet, then 30 feet sideways, then 60 feet back. Total distance?", ans: 150, hint: "60 + 30 + 60", unit: "feet" },
      { q: "He knocked down 7 pins on attempt 1 and 3 more on attempt 2. Total pins down?", ans: 10, hint: "7 + 3", unit: "pins" },
    ],
  },
  {
    id: "mega_magnet",
    name: "World's Strongest Magnet Test",
    emoji: "🧲",
    unlockLevel: 12,
    color: "#aa00ff",
    tagline: "Calculate magnetic forces and test the limits of physics!",
    scienceFact: "The world's strongest MRI magnet is 45 Tesla — 900,000 times stronger than Earth's magnetic field! A magnet that strong would pull iron out of your blood if you got too close! 🩸",
    questions: [
      { q: "A magnet attracts from 3 feet. Triple strength means 3× farther. New range?", ans: 9, hint: "3 × 3", unit: "feet" },
      { q: "Mark tested 8 metals. 5 were magnetic. How many were NOT attracted?", ans: 3, hint: "8 − 5", unit: "metals" },
      { q: "The magnet weighs 200 pounds and can lift 4 times its own weight. Total lift capacity?", ans: 800, hint: "200 × 4", unit: "pounds" },
    ],
  },
  {
    id: "space_station",
    name: "Build the ISS (in Math)",
    emoji: "🛰️",
    unlockLevel: 15,
    color: "#4488ff",
    tagline: "The International Space Station is the most complex machine ever built!",
    scienceFact: "The ISS travels at 17,500 mph and orbits Earth every 90 minutes — meaning astronauts see 16 sunrises EVERY DAY! It took 42 launches over 13 years to build! 🌍",
    questions: [
      { q: "The ISS orbits Earth 16 times per day. How many orbits in 5 days?", ans: 80, hint: "16 × 5", unit: "orbits" },
      { q: "It took 42 launches to build the ISS over 13 years. Each year averages how many launches? (round to nearest whole number)", ans: 3, hint: "42 ÷ 13 ≈ 3", unit: "launches per year" },
      { q: "The ISS is 356 feet long. A football field is 300 feet. How much longer than a football field?", ans: 56, hint: "356 − 300", unit: "feet" },
    ],
  },
  {
    id: "self_driving",
    name: "Self-Driving Car Code Lab",
    emoji: "🚗",
    unlockLevel: 13,
    color: "#00ccaa",
    tagline: "Program a self-driving car using distance, speed, and sensors!",
    scienceFact: "Self-driving cars use LIDAR sensors that shoot 1.3 million laser pulses per SECOND to build a 3D map of the road. The car's computer makes 13 decisions per second — faster than any human driver! 🤖",
    questions: [
      { q: "The car's LIDAR shoots 1,300,000 pulses per second. In 3 seconds, how many pulses?", ans: 3900000, hint: "Wait — try just 13 × 3 pulses per millisecond... actually: 1,300,000 × 3. That's a BIG number!", unit: "pulses" },
      { q: "The car travels at 60 mph. In 2 hours, how many miles?", ans: 120, hint: "60 × 2", unit: "miles" },
      { q: "A sensor detects an object 340 feet away. The car brakes in 280 feet. How much safety margin is left?", ans: 60, hint: "340 − 280", unit: "feet" },
    ],
  },
  {
    id: "roller_coaster",
    name: "Engineer a Roller Coaster",
    emoji: "🎢",
    unlockLevel: 14,
    color: "#ff3388",
    tagline: "Use physics and math to design a world-record coaster!",
    scienceFact: "The tallest roller coaster on Earth (Kingda Ka) is 456 feet tall and reaches 128 mph in 3.5 seconds! Engineers used calculus to calculate every curve and drop — but you can start with addition and multiplication! 🎢",
    questions: [
      { q: "The coaster track is 5,400 feet long. Each car is 30 feet. How many car-lengths fit on the track?", ans: 180, hint: "Count 30s up to 5400, or 5400 ÷ 30", unit: "car-lengths" },
      { q: "The coaster does 15 runs on weekdays and 25 on weekends. In one week (5 weekdays, 2 weekend days), how many total runs?", ans: 125, hint: "5 × 15 = 75, plus 2 × 25 = 50, then add", unit: "runs" },
      { q: "Each ride holds 24 people. If 312 people want to ride, how many full rides are needed?", ans: 13, hint: "Count 24s up to 312", unit: "rides" },
    ],
  },
  {
    id: "submarine_robot",
    name: "Underwater Robot Mission",
    emoji: "🤿",
    unlockLevel: 16,
    color: "#0088ff",
    tagline: "Navigate a robot submarine through the deep ocean!",
    scienceFact: "The deepest part of the ocean (Mariana Trench) is 36,000 feet deep — deeper than Mount Everest is tall! The pressure down there is like having 50 jumbo jets stacked on top of you! 🌊",
    questions: [
      { q: "The robot dives 200 feet per minute. After 8 minutes, how deep is it?", ans: 1600, hint: "200 × 8", unit: "feet" },
      { q: "The sub has 3 cameras filming at 30 frames per second each. Total frames per second?", ans: 90, hint: "3 × 30", unit: "frames/sec" },
      { q: "Mission start depth: 1,200 feet. It rises 450 feet to check coral. New depth?", ans: 750, hint: "1200 − 450", unit: "feet" },
    ],
  },
  {
    id: "solar_power",
    name: "Solar Panel Power Plant",
    emoji: "☀️",
    unlockLevel: 18,
    color: "#ffcc00",
    tagline: "Design a solar farm to power an entire neighborhood!",
    scienceFact: "One square meter of solar panel generates about 150 watts of power in full sun. To power the average American home, you'd need about 20 panels — and the sun is 93 MILLION miles away and still powers everything! ☀️",
    questions: [
      { q: "Each solar panel generates 150 watts. Mark's roof fits 24 panels. Total watts?", ans: 3600, hint: "150 × 24", unit: "watts" },
      { q: "The neighborhood needs 45,000 watts. Each panel makes 150 watts. How many panels?", ans: 300, hint: "Count 150s up to 45,000, or 45,000 ÷ 150", unit: "panels" },
      { q: "On sunny days the farm makes 8,500 watts. On cloudy days only 2,200 watts. How much more on sunny days?", ans: 6300, hint: "8,500 − 2,200", unit: "watts" },
    ],
  },
  {
    id: "video_game_physics",
    name: "Video Game Physics Engine",
    emoji: "🕹️",
    unlockLevel: 20,
    color: "#9933ff",
    tagline: "The math that makes Minecraft and Roblox feel REAL!",
    scienceFact: "Every video game runs on physics engines that calculate gravity, collision, and momentum thousands of times per second. Minecraft's gravity pulls you at 9.8 blocks/sec² — exactly the same as real gravity! 🎮",
    questions: [
      { q: "A game renders 60 frames per second. How many frames in 3 minutes?", ans: 10800, hint: "60 × 60 = 3600 per minute, × 3 minutes", unit: "frames" },
      { q: "In Roblox, your character falls 5 blocks in the first second, 10 in the second, 15 in the third. Total blocks fallen?", ans: 30, hint: "5 + 10 + 15", unit: "blocks" },
      { q: "A Minecraft world is 60 million blocks wide. If you walk 8 blocks per second, how many seconds to walk 400 blocks?", ans: 50, hint: "Count 8s up to 400", unit: "seconds" },
    ],
  },
];

// ============================================================================
// CRUNCHLAB SCREEN
// ============================================================================
function CrunchLabScreen({ save, setSave, theme, addXP, grantBadge, showToast, fireConfetti, back }) {
  const [activeMission, setActiveMission] = useState(null);
  const [missionPhase, setMissionPhase] = useState("intro");
  const [qIndex, setQIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [wrongsThisQ, setWrongsThisQ] = useState(0);
  const [qCorrect, setQCorrect] = useState([]);
  const inputRef = useRef(null);

  const completed = save.crunchlab?.completed || [];
  const inProgress = save.crunchlab?.inProgress || {};

  const launchMission = (ch) => {
    setActiveMission(ch);
    setMissionPhase("intro");
    setQIndex(0);
    setUserAnswer("");
    setFeedback(null);
    setWrongsThisQ(0);
    setQCorrect([]);
  };

  const startQuestions = () => {
    setMissionPhase("questions");
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const submitAnswer = () => {
    if (!userAnswer.trim() || !!feedback) return;
    const q = activeMission.questions[qIndex];
    const guess = Number(userAnswer.trim());
    if (guess === q.ans) {
      setFeedback({ type: "correct", text: pickRandom(["🎯 Nailed it!", "⚡ Engineer brain activated!", "🏆 Correct!", "💥 That's it!", "🔬 Lab approved!"]) });
      setQCorrect((c) => [...c, qIndex]);
      setSave((s) => {
        const ip = { ...(s.crunchlab?.inProgress || {}), [activeMission.id]: qIndex + 1 };
        return { ...s, crunchlab: { ...s.crunchlab, inProgress: ip } };
      });
      addXP(20, 5);
      setTimeout(() => {
        if (qIndex < activeMission.questions.length - 1) {
          setQIndex(qIndex + 1);
          setUserAnswer("");
          setFeedback(null);
          setWrongsThisQ(0);
          setTimeout(() => inputRef.current?.focus(), 150);
        } else {
          setMissionPhase("debrief");
          fireConfetti();
          grantBadge("rober_lab");
          addXP(50, 20);
          setSave((s) => {
            const newCompleted = s.crunchlab.completed.includes(activeMission.id)
              ? s.crunchlab.completed
              : [...s.crunchlab.completed, activeMission.id];
            const ip = { ...(s.crunchlab.inProgress || {}) };
            delete ip[activeMission.id];
            return { ...s, crunchlab: { completed: newCompleted, inProgress: ip } };
          });
        }
      }, 1100);
    } else {
      const newWrongs = wrongsThisQ + 1;
      setWrongsThisQ(newWrongs);
      const hintText = newWrongs >= 2
        ? `💡 Hint: ${q.hint}`
        : pickRandom(["Not quite — think it through!", "Close! Try again, engineer!", "Hmm, re-read the problem.", "You got this! Check your math."]);
      setFeedback({ type: "wrong", text: hintText });
      setTimeout(() => {
        setFeedback(null);
        setUserAnswer("");
        setTimeout(() => inputRef.current?.focus(), 100);
      }, 3200);
    }
  };

  // ── Mission select ──────────────────────────────────────────
  if (!activeMission) {
    const unlockedCount = CRUNCH_CHALLENGES.filter((c) => save.level >= c.unlockLevel).length;
    return (
      <div style={{ animation: "slideUp 0.4s" }}>
        <BackBar back={back} title="🧪 CRUNCHLAB MISSIONS" theme={theme} />

        <div style={{
          background: "linear-gradient(135deg, #0a2010, #0f3020)",
          border: "2px solid #00ff88",
          borderRadius: 18,
          padding: 18,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 0 40px #00ff8833",
        }}>
          <div style={{ fontSize: 48 }}>🧪</div>
          <div>
            <div className="display-font" style={{ fontSize: 22, fontWeight: 900, color: "#00ff88" }}>
              Mark Rober's CrunchLab
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.85, marginTop: 2 }}>
              Real science. Real engineering. Real math.<br />
              <strong style={{ color: "#00ff88" }}>{unlockedCount}</strong> of {CRUNCH_CHALLENGES.length} missions unlocked •{" "}
              <strong style={{ color: "#ffd700" }}>{completed.length}</strong> completed
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {CRUNCH_CHALLENGES.map((ch) => {
            const isLocked = save.level < ch.unlockLevel;
            const isDone = completed.includes(ch.id);
            const progress = inProgress[ch.id] || 0;
            return (
              <ChallengeCard key={ch.id} ch={ch} isLocked={isLocked}
                isDone={isDone} progress={progress} theme={theme}
                onLaunch={() => launchMission(ch)} />
            );
          })}
        </div>
      </div>
    );
  }

  // ── Mission INTRO ────────────────────────────────────────────
  if (missionPhase === "intro") {
    return (
      <div style={{ animation: "slideUp 0.4s" }}>
        <BackBar back={() => setActiveMission(null)} title="Mission Briefing" theme={theme} />
        <div style={{
          background: `linear-gradient(160deg, ${activeMission.color}22, ${theme.panel})`,
          border: `3px solid ${activeMission.color}`,
          borderRadius: 22,
          padding: 26,
          textAlign: "center",
          boxShadow: `0 0 50px ${activeMission.color}33`,
        }}>
          <div style={{ fontSize: 72, marginBottom: 10, animation: "bounce 1.5s infinite" }}>
            {activeMission.emoji}
          </div>
          <div className="display-font" style={{
            fontSize: "clamp(22px, 5vw, 30px)",
            fontWeight: 900,
            color: activeMission.color,
            marginBottom: 10,
          }}>
            {activeMission.name}
          </div>
          <div style={{
            fontSize: 15, lineHeight: 1.7, marginBottom: 22,
            opacity: 0.9, maxWidth: 460, margin: "0 auto 22px",
          }}>
            {activeMission.tagline}
          </div>
          <div style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 14, padding: 14, marginBottom: 24,
            textAlign: "left",
            border: `1px dashed ${activeMission.color}55`,
          }}>
            <div style={{ fontSize: 11, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              📋 Mission Stats
            </div>
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              🧩 <strong>3 engineering questions</strong><br />
              ⭐ <strong>+70 XP</strong> + <strong>25 coins</strong> on completion<br />
              🏅 Earns the <strong>Rober Lab Engineer</strong> badge
            </div>
          </div>
          <BigButton onClick={startQuestions} theme={theme}>🚀 LAUNCH MISSION</BigButton>
        </div>
      </div>
    );
  }

  // ── Mission QUESTIONS ────────────────────────────────────────
  if (missionPhase === "questions") {
    const q = activeMission.questions[qIndex];
    return (
      <div style={{ animation: "slideUp 0.4s" }}>
        <BackBar back={() => setActiveMission(null)} title={activeMission.name} theme={theme} />

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
          {activeMission.questions.map((_, i) => (
            <div key={i} style={{
              width: 36, height: 36, borderRadius: "50%",
              background: qCorrect.includes(i) ? activeMission.color
                : i === qIndex ? `${activeMission.color}55` : "rgba(255,255,255,0.08)",
              border: `2px solid ${i === qIndex ? activeMission.color : "transparent"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900,
              color: qCorrect.includes(i) ? "#000" : theme.text,
              boxShadow: i === qIndex ? `0 0 14px ${activeMission.color}` : "none",
              transition: "all 0.3s",
            }}>
              {qCorrect.includes(i) ? "✓" : i + 1}
            </div>
          ))}
        </div>

        <div style={{
          background: `linear-gradient(160deg, ${activeMission.color}15, ${theme.panel})`,
          border: `2px solid ${activeMission.color}`,
          borderRadius: 20, padding: 24, textAlign: "center",
        }}>
          <div className="pixel-font" style={{
            fontSize: 9, color: activeMission.color, letterSpacing: 2, marginBottom: 14,
          }}>
            QUESTION {qIndex + 1} OF {activeMission.questions.length}
          </div>

          <div className="display-font" style={{
            fontSize: "clamp(17px, 4vw, 22px)",
            fontWeight: 700, lineHeight: 1.6, marginBottom: 10,
          }}>
            {q.q}
          </div>

          <button onClick={() => speak(q.q)} style={{
            fontSize: 12, padding: "5px 12px",
            background: "transparent", border: `1px solid ${activeMission.color}66`,
            color: theme.text, borderRadius: 999, cursor: "pointer", marginBottom: 18,
          }}>🔊 Read to me</button>

          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
            Your answer (in {q.unit}):
          </div>

          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
            disabled={!!feedback}
            placeholder="?"
            style={{
              width: 160, padding: "16px 12px", fontSize: 34, fontWeight: 900,
              borderRadius: 14,
              border: `3px solid ${feedback?.type === "correct" ? "#22c55e" : feedback?.type === "wrong" ? "#ef4444" : activeMission.color}`,
              background: "rgba(255,255,255,0.08)",
              color: theme.text, textAlign: "center", marginBottom: 16,
              animation: feedback?.type === "wrong" ? "shake 0.4s" : "none",
            }}
          />
          <div>
            {!feedback && (
              <BigButton onClick={submitAnswer} theme={theme} disabled={!userAnswer.trim()}>
                SUBMIT ⚗️
              </BigButton>
            )}
          </div>
          {feedback && (
            <div style={{
              fontSize: feedback.text.length > 25 ? 15 : 20,
              fontWeight: 700,
              color: feedback.type === "correct" ? "#22c55e" : "#fbbf24",
              marginTop: 12, lineHeight: 1.5,
              animation: "bounce 0.5s",
            }}>
              {feedback.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Mission DEBRIEF ──────────────────────────────────────────
  return (
    <div style={{ animation: "slideUp 0.4s", textAlign: "center" }}>
      <BackBar back={() => setActiveMission(null)} title="Mission Complete!" theme={theme} />
      <div style={{
        background: `linear-gradient(160deg, ${activeMission.color}33, ${theme.panel})`,
        border: `3px solid ${activeMission.color}`,
        borderRadius: 22, padding: 28,
        boxShadow: `0 0 60px ${activeMission.color}44`,
      }}>
        <div style={{ fontSize: 80, marginBottom: 8 }}>🏆</div>
        <div className="display-font" style={{
          fontSize: 28, fontWeight: 900, color: activeMission.color, marginBottom: 4,
        }}>
          MISSION COMPLETE!
        </div>
        <div style={{ fontSize: 16, opacity: 0.8, marginBottom: 22 }}>
          +70 XP • +25 coins earned! 🎉
        </div>
        <div style={{
          background: "rgba(0,0,0,0.35)",
          borderRadius: 16, padding: 18, marginBottom: 24,
          textAlign: "left",
          border: `1px solid ${activeMission.color}44`,
        }}>
          <div className="pixel-font" style={{
            fontSize: 9, color: activeMission.color, letterSpacing: 2, marginBottom: 10,
          }}>
            🔬 MARK ROBER SCIENCE FACT
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>
            {activeMission.scienceFact}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <BigButton onClick={() => setActiveMission(null)} theme={theme}>More Missions</BigButton>
          <BigButton onClick={back} theme={theme} variant="ghost">Home</BigButton>
        </div>
      </div>
    </div>
  );
}

function ChallengeCard({ ch, isLocked, isDone, progress, theme, onLaunch }) {
  return (
    <div style={{
      background: isLocked ? "rgba(255,255,255,0.025)" : `linear-gradient(135deg, ${ch.color}15, ${theme.panel})`,
      border: `2px solid ${isLocked ? "rgba(255,255,255,0.08)" : isDone ? "#22c55e" : ch.color}`,
      borderRadius: 18, padding: 14,
      opacity: isLocked ? 0.52 : 1,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        fontSize: 36, width: 56, height: 56, borderRadius: 14, flexShrink: 0,
        background: isLocked ? "rgba(255,255,255,0.04)" : `${ch.color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `2px solid ${isLocked ? "rgba(255,255,255,0.08)" : ch.color}44`,
        filter: isLocked ? "grayscale(1) brightness(0.5)" : "none",
      }}>
        {isLocked ? "🔒" : ch.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="display-font" style={{
          fontSize: 15, fontWeight: 900,
          color: isLocked ? "rgba(255,255,255,0.3)" : isDone ? "#22c55e" : ch.color,
          marginBottom: 2,
        }}>
          {isDone && "✓ "}{ch.name}
        </div>
        <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.4, marginBottom: isLocked || isDone ? 0 : 6 }}>
          {isLocked ? `🔒 Unlocks at Level ${ch.unlockLevel}` : ch.tagline}
        </div>
        {!isLocked && !isDone && (
          <div style={{ display: "flex", gap: 5 }}>
            {ch.questions.map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%",
                background: i < progress ? ch.color : "rgba(255,255,255,0.12)",
                border: `1px solid ${ch.color}55`,
              }} />
            ))}
          </div>
        )}
        {isDone && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 2 }}>✓ Mission complete!</div>}
      </div>

      {!isLocked && (
        <button onClick={onLaunch} className="card-tap" style={{
          background: isDone ? "transparent" : `linear-gradient(135deg, ${ch.color}, ${ch.color}cc)`,
          border: isDone ? `2px solid ${ch.color}` : "none",
          color: isDone ? ch.color : "#000",
          padding: "10px 14px", borderRadius: 12,
          fontWeight: 900, fontSize: 13,
          cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          boxShadow: isDone ? "none" : `0 4px 14px ${ch.color}55`,
        }}>
          {isDone ? "Replay" : progress > 0 ? "Continue 🔬" : "Launch 🚀"}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// SHOP
// ============================================================================
function Shop({ save, setSave, theme, showToast, back }) {
  const [tab, setTab] = useState("avatars"); // avatars, themes

  const buyAvatar = (a) => {
    if (save.shop.owned.includes(a.id)) {
      // equip
      setSave((s) => ({ ...s, shop: { ...s.shop, avatar: a.id } }));
      showToast(`✅ Equipped ${a.name}`);
      return;
    }
    if (save.coins < a.cost) {
      showToast(`Need ${a.cost - save.coins} more coins!`, "wrong");
      return;
    }
    setSave((s) => ({
      ...s,
      coins: s.coins - a.cost,
      shop: { ...s.shop, avatar: a.id, owned: [...s.shop.owned, a.id] },
    }));
    showToast(`🎉 Unlocked ${a.name}!`);
  };

  const buyTheme = (themeKey, themeData) => {
    if (save.shop.owned.includes(themeKey)) {
      setSave((s) => ({ ...s, shop: { ...s.shop, theme: themeKey } }));
      showToast(`✅ Equipped ${themeData.name}`);
      return;
    }
    if (save.coins < themeData.cost) {
      showToast(`Need ${themeData.cost - save.coins} more coins!`, "wrong");
      return;
    }
    setSave((s) => ({
      ...s,
      coins: s.coins - themeData.cost,
      shop: { ...s.shop, theme: themeKey, owned: [...s.shop.owned, themeKey] },
    }));
    showToast(`🎉 Unlocked ${themeData.name}!`);
  };

  return (
    <div style={{ animation: "slideUp 0.4s" }}>
      <BackBar back={back} title="🛒 SHOP" theme={theme} />

      <div style={{
        background: `linear-gradient(135deg, ${theme.accent2}33, ${theme.accent}33)`,
        padding: 14, borderRadius: 14, textAlign: "center",
        fontSize: 18, fontWeight: 900, marginBottom: 16,
      }}>
        🪙 You have <span style={{ color: theme.accent2 }}>{save.coins}</span> coins
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <TabButton active={tab === "avatars"} onClick={() => setTab("avatars")} theme={theme}>
          Avatars
        </TabButton>
        <TabButton active={tab === "themes"} onClick={() => setTab("themes")} theme={theme}>
          Themes
        </TabButton>
      </div>

      {tab === "avatars" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
          {AVATARS.map((a) => {
            const owned = save.shop.owned.includes(a.id);
            const equipped = save.shop.avatar === a.id;
            return (
              <button
                key={a.id}
                onClick={() => buyAvatar(a)}
                className="card-tap"
                style={{
                  background: equipped ? `${theme.accent}33` : theme.panel,
                  border: `2px solid ${equipped ? theme.accent : owned ? "#22c55e" : theme.accent}66`,
                  borderRadius: 14, padding: 12,
                  color: theme.text, cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 4 }}>{a.id}</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                  {equipped ? "✓ Equipped" : owned ? "Tap to equip" : `🪙 ${a.cost}`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tab === "themes" && (
        <div style={{ display: "grid", gap: 10 }}>
          {Object.entries(THEMES).map(([k, t]) => {
            const owned = save.shop.owned.includes(k);
            const equipped = save.shop.theme === k;
            return (
              <button
                key={k}
                onClick={() => buyTheme(k, t)}
                className="card-tap"
                style={{
                  background: `linear-gradient(135deg, ${t.bg}, ${t.panel})`,
                  border: `3px solid ${equipped ? t.accent : owned ? "#22c55e" : t.accent}88`,
                  borderRadius: 16, padding: 16,
                  color: t.text, cursor: "pointer",
                  textAlign: "left",
                  display: "flex", alignItems: "center", gap: 16,
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: t.accent }} />
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: t.accent2 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="display-font" style={{ fontSize: 18, fontWeight: 900, color: t.accent }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {equipped ? "✓ Equipped" : owned ? "Tap to equip" : `🪙 ${t.cost}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BADGES SCREEN
// ============================================================================
function BadgesScreen({ save, theme, back }) {
  return (
    <div style={{ animation: "slideUp 0.4s" }}>
      <BackBar back={back} title="🏅 BADGES" theme={theme} />
      <div style={{ textAlign: "center", marginBottom: 16, fontSize: 14, opacity: 0.8 }}>
        {save.badges.length} of {ALL_BADGES.length} unlocked
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        {ALL_BADGES.map((b) => {
          const earned = save.badges.includes(b.id);
          return (
            <div key={b.id} style={{
              background: earned ? `linear-gradient(135deg, ${theme.accent}22, ${theme.accent2}22)` : "rgba(255,255,255,0.04)",
              border: `2px solid ${earned ? theme.accent : "rgba(255,255,255,0.1)"}`,
              borderRadius: 14, padding: 14,
              textAlign: "center",
              opacity: earned ? 1 : 0.5,
              color: theme.text,
            }}>
              <div style={{ fontSize: 40, marginBottom: 4, filter: earned ? "none" : "grayscale(1)" }}>
                {earned ? b.emoji : "🔒"}
              </div>
              <div className="display-font" style={{ fontSize: 14, fontWeight: 900, color: earned ? theme.accent : theme.text }}>
                {b.name}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{b.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// WEEKLY TIME CHART — 7-day sparkline bar chart for Settings
// ============================================================================
function WeeklyTimeChart({ timeByDay, theme }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
    days.push({ key, label, secs: timeByDay[key] || 0 });
  }
  const maxSecs = Math.max(...days.map((d) => d.secs), 60); // floor at 60 so empty days render

  return (
    <div>
      <div className="pixel-font" style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, marginBottom: 10 }}>
        LAST 7 DAYS
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
        {days.map((d) => {
          const pct = d.secs / maxSecs;
          const isToday = d.key === todayStr();
          return (
            <div key={d.key} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end",
            }}>
              {d.secs > 0 && (
                <div style={{
                  fontSize: 9, color: "#a78bfa", fontWeight: 900,
                  opacity: 0.8, whiteSpace: "nowrap",
                }}>
                  {fmtTime(d.secs)}
                </div>
              )}
              <div style={{
                width: "100%",
                height: `${Math.max(pct * 52, d.secs > 0 ? 6 : 2)}px`,
                background: d.secs === 0
                  ? "rgba(255,255,255,0.06)"
                  : isToday
                    ? "linear-gradient(180deg, #a78bfa, #7c3aed)"
                    : "linear-gradient(180deg, #a78bfa88, #7c3aed66)",
                borderRadius: "4px 4px 2px 2px",
                boxShadow: d.secs > 0 ? "0 0 8px #a78bfa55" : "none",
                transition: "height 0.6s ease",
              }} />
              <div style={{
                fontSize: 9, opacity: isToday ? 1 : 0.5,
                color: isToday ? "#a78bfa" : theme.text,
                fontWeight: isToday ? 900 : 400,
                whiteSpace: "nowrap",
              }}>
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
      {days.every((d) => d.secs === 0) && (
        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.45, marginTop: 8 }}>
          Start a spelling or math session to see your time here!
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SETTINGS
// ============================================================================
function Settings({ save, setSave, theme, back }) {
  const [name, setName] = useState(save.name);
  const [confirmReset, setConfirmReset] = useState(false);

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed) setSave((s) => ({ ...s, name: trimmed }));
  };

  const doReset = () => {
    setSave(defaultSave);
    setConfirmReset(false);
    back();
  };

  return (
    <div style={{ animation: "slideUp 0.4s" }}>
      <BackBar back={back} title="⚙️ Settings" theme={theme} />

      <div style={{ background: theme.panel, borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <div className="display-font" style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>
          Your Name
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 10,
              border: `2px solid ${theme.accent}66`,
              background: "rgba(255,255,255,0.08)",
              color: theme.text,
            }}
          />
          <BigButton onClick={saveName} theme={theme}>Save</BigButton>
        </div>
      </div>

      <div style={{ background: theme.panel, borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <div className="display-font" style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>
          Your Stats 📊
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, fontSize: 14 }}>
          <Stat label="Total correct" value={save.stats.totalCorrect} />
          <Stat label="Best streak" value={save.stats.bestStreak} />
          <Stat label="Words mastered" value={save.spelling.mastered.length} />
          <Stat label="Math facts mastered" value={save.math.masteredFacts.length} />
          <Stat label="Total XP" value={save.xp} />
          <Stat label="Math difficulty" value={save.math.difficulty} />
        </div>
      </div>

      {/* ── Time Tracker Panel ── */}
      <div style={{ background: theme.panel, borderRadius: 16, padding: 16, marginBottom: 12,
        border: "1px solid rgba(167,139,250,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>⏱️</span>
          <div className="display-font" style={{ fontSize: 16, fontWeight: 900 }}>Learning Time</div>
          <div style={{
            marginLeft: "auto",
            background: "rgba(167,139,250,0.15)",
            border: "1px solid rgba(167,139,250,0.4)",
            borderRadius: 999, padding: "3px 12px",
            fontSize: 12, fontWeight: 900, color: "#a78bfa",
          }}>
            only counts active learning
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
          <div style={{
            background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: 12, padding: "12px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4 }}>Today</div>
            <div style={{ fontWeight: 900, fontSize: 24, color: "#a78bfa" }}>
              {fmtTime(save.stats.secondsToday || 0)}
            </div>
          </div>
          <div style={{
            background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: 12, padding: "12px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4 }}>All Time</div>
            <div style={{ fontWeight: 900, fontSize: 24, color: "#a78bfa" }}>
              {fmtTime(save.stats.totalSecondsLearned || 0)}
            </div>
          </div>
        </div>

        {/* 7-day bar chart */}
        <WeeklyTimeChart timeByDay={save.stats.timeByDay || {}} theme={theme} />
      </div>

      <div style={{
        background: theme.panel, borderRadius: 16, padding: 16,
        border: `1px solid #ef444466`,
      }}>
        <div className="display-font" style={{ fontSize: 16, fontWeight: 900, marginBottom: 4, color: "#ef4444" }}>
          Reset Everything
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
          Wipes all progress, XP, coins, and badges. Cannot be undone!
        </div>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            style={{
              background: "transparent",
              border: `2px solid #ef4444`,
              color: "#ef4444",
              padding: "10px 18px", borderRadius: 10,
              cursor: "pointer", fontWeight: 700,
            }}
          >
            Reset Progress
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={doReset} style={{
              background: "#ef4444", border: "none", color: "#fff",
              padding: "10px 16px", borderRadius: 10,
              cursor: "pointer", fontWeight: 900,
            }}>YES, RESET ALL</button>
            <button onClick={() => setConfirmReset(false)} style={{
              background: "transparent", border: `2px solid ${theme.accent}66`,
              color: theme.text, padding: "10px 16px", borderRadius: 10,
              cursor: "pointer",
            }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

// ============================================================================
// SHARED UI
// ============================================================================
function BigButton({ children, onClick, theme, disabled, variant }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(255,255,255,0.1)" :
                    variant === "ghost" ? "transparent" :
                    `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
        color: variant === "ghost" ? theme.text : theme.bg,
        border: variant === "ghost" ? `2px solid ${theme.accent}` : "none",
        padding: "14px 28px",
        fontSize: 16,
        fontWeight: 900,
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        letterSpacing: 1,
        boxShadow: disabled ? "none" : `0 4px 16px ${theme.accent}66`,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {children}
    </button>
  );
}

function BackBar({ back, title, theme }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
    }}>
      <button onClick={back} style={{
        background: "transparent",
        border: `2px solid ${theme.accent}66`,
        color: theme.text,
        width: 40, height: 40,
        borderRadius: 10, cursor: "pointer",
        fontSize: 20, fontWeight: 900,
      }} aria-label="Back">←</button>
      <div className="display-font" style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 900 }}>
        {title}
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick, theme }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? theme.accent : "transparent",
        color: active ? theme.bg : theme.text,
        border: `2px solid ${theme.accent}66`,
        padding: "10px 16px",
        borderRadius: 10,
        fontWeight: 900,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}