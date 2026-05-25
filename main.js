import { countdownLabel, countdownMs, countdownSeconds, formatHoldLabel, formatNodeValue, formatScore } from "./client/formatters.js";
import { buildLeaderboardRows } from "./client/leaderboard.js";
import { buildRoomStatusText } from "./client/room-status.js";
import { buildRoomUrl, clearRoomUrl, getRoomIdFromUrl, normalizeRoomId, updateRoomUrl } from "./client/room-url.js";
import {
  PLAYER_STATES,
  NODE_STATES,
  SKILL_CONFIG,
  SKILL_IDS,
  canSkillClaimNode,
  canPlayerClaimDuringStasis,
  findBestWarpNode,
  getBoostIntervalMs,
  getCaptureDurationMs,
  getEffectiveNodeValue,
  getNodeScoreValue,
  getSkillCooldownRatio,
  isBoostActive,
  isHighValueNode,
  isNodeInStasis,
  isPointInStasis,
  isStasisPulseActive,
} from "./client/skill-mechanics.js";

const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const shell = document.querySelector(".demo-shell");
const statusText = document.querySelector("#run-status");
const replayButton = document.querySelector("#replay-button");
const audioButton = document.querySelector("#audio-button");
const startButton = document.querySelector("#start-button");
const authStatus = document.querySelector("#auth-status");
const loginButton = document.querySelector("#login-button");
const logoutButton = document.querySelector("#logout-button");
const createRoomButton = document.querySelector("#create-room-button");
const joinRoomButton = document.querySelector("#join-room-button");
const readyButton = document.querySelector("#ready-button");
const endRoomButton = document.querySelector("#end-room-button");
const leaveRoomButton = document.querySelector("#leave-room-button");
const copyRoomButton = document.querySelector("#copy-room-button");
const roomSizeInput = document.querySelector("#room-size-input");
const roomCodeInput = document.querySelector("#room-code-input");
const botToggle = document.querySelector("#bot-toggle");
const sessionActions = document.querySelector("#session-actions");
const roomStatus = document.querySelector("#room-status");
const roomSheet = document.querySelector("#room-sheet");
const roomSheetStatus = document.querySelector("#room-sheet-status");
const roomReadyButton = document.querySelector("#room-ready-button");
const roomList = document.querySelector("#room-list");
const styleButtons = [...document.querySelectorAll(".style-button")];
const themeMenu = document.querySelector("#theme-menu");
const themeSummarySwatch = document.querySelector("#theme-summary-swatch");
const themeSummaryLabel = document.querySelector("#theme-summary-label");
const skillConfigToggle = document.querySelector("#skill-config-toggle");

const VIEW = {
  width: canvas.width,
  height: canvas.height,
};
const LEGACY_PLANT_CENTER = { x: 244, y: 108 };
const WORLD_CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };
const PLANT_WORLD_SCALE = 0.5;

const styles = {
  steampunk: {
    name: "Steampunk",
    entrance: { x: 202, y: 137 },
    css: {
      page: "#11140f",
      panel: "#1b1a14",
      strong: "#2a2619",
      text: "#f1e8cf",
      muted: "#bca982",
      accent: "#d5983b",
      accent2: "#70a8ff",
      border: "#4a3b21",
    },
    scene: {
      sky: "#152213",
      ground: "#4c6424",
      groundDark: "#324516",
      groundLight: "#6f8332",
      path: "#a07845",
      pathDark: "#5f4728",
      rock: "#8a8977",
      accent: "#d89a43",
      glow: "#7eb4ff",
      shadow: "rgba(18, 12, 5, 0.48)",
      soldier: {
        armor: "#5a4631",
        armorLight: "#a28358",
        visor: "#e0432f",
        weapon: "#24221d",
        boot: "#17140f",
      },
    },
  },
  cyberpunk: {
    name: "Cyberpunk",
    entrance: { x: 198, y: 138 },
    css: {
      page: "#071018",
      panel: "#0b1421",
      strong: "#15112a",
      text: "#eaf7ff",
      muted: "#80b6c9",
      accent: "#ff3cd9",
      accent2: "#18d8ff",
      border: "#1d5d74",
    },
    scene: {
      sky: "#07131b",
      ground: "#22312a",
      groundDark: "#111d1c",
      groundLight: "#37534a",
      path: "#3a3f51",
      pathDark: "#242634",
      rock: "#5f7580",
      accent: "#ff3bd9",
      glow: "#0fdcff",
      shadow: "rgba(0, 0, 0, 0.58)",
      soldier: {
        armor: "#16202e",
        armorLight: "#2ddfff",
        visor: "#ff41db",
        weapon: "#f5f9ff",
        boot: "#06080f",
      },
    },
  },
  futuristic: {
    name: "Futuristic",
    entrance: { x: 200, y: 139 },
    css: {
      page: "#0c1418",
      panel: "#111a1f",
      strong: "#1d2c32",
      text: "#edf7fb",
      muted: "#94afba",
      accent: "#2ebcff",
      accent2: "#b7d9f4",
      border: "#456777",
    },
    scene: {
      sky: "#102025",
      ground: "#536725",
      groundDark: "#35451a",
      groundLight: "#758a35",
      path: "#a8955f",
      pathDark: "#665738",
      rock: "#aab4b8",
      accent: "#2abfff",
      glow: "#9fdfff",
      shadow: "rgba(4, 12, 16, 0.42)",
      soldier: {
        armor: "#d9e3e7",
        armorLight: "#63caff",
        visor: "#2cbcff",
        weapon: "#27333a",
        boot: "#57666d",
      },
    },
  },
};

const plantRect = { x: 148, y: 20, w: 188, h: 154 };
const plantPalettes = {
  steampunk: {
    body: "#66523a",
    bodyLight: "#b58a4b",
    bodyDark: "#241a12",
    trim: "#d49a42",
    trimDark: "#7c4f24",
    roof: "#a73324",
    roofLight: "#d65d32",
    pipe: "#9d6d34",
    pipeDark: "#4d311b",
    core: "#71a8ff",
    coreDark: "#254f95",
    coreBright: "#f0f8ff",
    panel: "#18375f",
    door: "#1d1712",
  },
  cyberpunk: {
    body: "#171b28",
    bodyLight: "#2d3552",
    bodyDark: "#05070d",
    trim: "#10d9ff",
    trimDark: "#0a647e",
    roof: "#ff35d6",
    roofLight: "#ff7aea",
    pipe: "#7e2a9b",
    pipeDark: "#22112f",
    core: "#70c6ff",
    coreDark: "#154c99",
    coreBright: "#f2fbff",
    panel: "#ff31d2",
    door: "#06080d",
  },
  futuristic: {
    body: "#c6d4d9",
    bodyLight: "#eef7fb",
    bodyDark: "#42545b",
    trim: "#2abfff",
    trimDark: "#176184",
    roof: "#e8f0f3",
    roofLight: "#ffffff",
    pipe: "#8e9da3",
    pipeDark: "#45545b",
    core: "#83cdff",
    coreDark: "#2774b8",
    coreBright: "#f7fcff",
    panel: "#24aef4",
    door: "#162229",
  },
};

const LOOP_DURATION = 30000;
const EXPLOSION_START = 22000;
const ESCAPE_START = 21200;
const REBUILD_START = EXPLOSION_START + 2800;
const REBUILD_END = LOOP_DURATION;
const DEMO_TIME_SCALE = 1;
const DEMO_REPAIR_DURATION = 20000;
const DEMO_MAX_REPAIR_ELAPSED = 30000;
const DEMO_NODE_SPAWN_MS = 3000;
const DEMO_INITIAL_NODE_COUNT = 40;
const DEMO_NODE_SPAWN_PER_PLAYER_MULTIPLIER = 1.5;
const DEMO_RUNNER_SPEED = 2.15;
const DEMO_ESCAPE_THRESHOLD_MS = 2600;
const DEMO_NODE_TIMER_FACTOR_MS = 500;
const DEMO_RUNNER_PIXELS_PER_MS = 0.22;
const DEMO_RISK_CLAIM_WINDOW_MS = 1200;
const PLANT_FLOATING_TEXT_MAX = 10;
const PLANT_FLOATING_TEXT_VISIBLE = 5;
const PLANT_FLOATING_TEXT_MS = 1000;
const DEMO_BLAST = { x: WORLD_CENTER.x, y: WORLD_CENTER.y, radius: 115 };
const DEMO_RED_EXCLUSION_RADIUS = DEMO_BLAST.radius + 13;
const DEMO_PLANT_COUNT = 2;
const DEMO_SUMMARY_START = EXPLOSION_START + 450;
const DEMO_VORTEX_START = LOOP_DURATION - 900;
const DEMO_PATH_POINTS = [
  { x: 0, y: 354 },
  { x: 118, y: 310 },
  { x: 248, y: 260 },
  { x: WORLD_CENTER.x - 34, y: WORLD_CENTER.y + 38 },
  { x: WORLD_CENTER.x + 70, y: WORLD_CENTER.y + 28 },
  { x: 620, y: 300 },
  { x: VIEW.width, y: 346 },
];
const baseDemoNodes = [
  { id: "dn1", x: 76, y: 338, value: 2.4, size: 8, holdMs: 1200 },
  { id: "dn2", x: 126, y: 94, value: -3.2, size: 8, holdMs: 1600 },
  { id: "dn3", x: 238, y: 354, value: -4.8, size: 9, holdMs: 2400 },
  { id: "dn4", x: 306, y: 132, value: 6.1, size: 10, holdMs: 3000, bonus: true },
  { id: "dn5", x: 458, y: 302, value: -5.4, size: 10, holdMs: 2700, bonus: true },
  { id: "dn6", x: 596, y: 108, value: -3.6, size: 8, holdMs: 1800 },
  { id: "dn7", x: 690, y: 348, value: 7.9, size: 10, holdMs: 3300, bonus: true },
  { id: "dn8", x: 180, y: 228, value: -2.8, size: 8, holdMs: 1400 },
  { id: "dn9", x: 384, y: 96, value: 5.5, size: 9, holdMs: 2600 },
  { id: "dn10", x: 536, y: 382, value: -4.1, size: 9, holdMs: 2100 },
  { id: "dn11", x: 646, y: 234, value: -6.6, size: 10, holdMs: 3000, bonus: true },
  { id: "dn12", x: 352, y: 358, value: 8.4, size: 10, holdMs: 3400, bonus: true },
  { id: "dn13", x: 54, y: 184, value: -4.2, size: 8, holdMs: 1900 },
  { id: "dn14", x: 116, y: 404, value: -3.1, size: 8, holdMs: 1500 },
  { id: "dn15", x: 168, y: 52, value: 5.2, size: 9, holdMs: 2300 },
  { id: "dn16", x: 268, y: 232, value: -6.9, size: 10, holdMs: 3200, bonus: true },
  { id: "dn17", x: 410, y: 158, value: 7.4, size: 10, holdMs: 3300, bonus: true },
  { id: "dn18", x: 486, y: 84, value: -2.9, size: 8, holdMs: 1400 },
  { id: "dn19", x: 574, y: 218, value: -4.6, size: 9, holdMs: 2100 },
  { id: "dn20", x: 704, y: 88, value: -5.8, size: 10, holdMs: 2800, bonus: true },
  { id: "dn21", x: 716, y: 286, value: -2.7, size: 8, holdMs: 1300 },
  { id: "dn22", x: 438, y: 398, value: -3.7, size: 8, holdMs: 1700 },
  { id: "dn23", x: 224, y: 168, value: 6.7, size: 10, holdMs: 3100, bonus: true },
  { id: "dn24", x: 632, y: 380, value: 5.9, size: 9, holdMs: 2600 },
];
const demoNodePool = buildDemoNodePool(128);
const demoNodesByCycle = new Map();
const demoAbilities = [
  { id: "boost", label: "BOOST", name: "Overclock Boots", hint: "2x burst", color: "#70a8ff", accent: "#f1e8cf" },
  { id: "magnet", label: "MAG", name: "Magnet Gloves", hint: "claim farther", color: "#57d56c", accent: "#d7ffd8" },
  { id: "stasis", label: "STASIS", name: "Stasis Popper", hint: "freezes rivals/nodes", color: "#9fdfff", accent: "#f1e8cf" },
  { id: "warp", label: "WARP", name: "Portal Boots", hint: "jumps to best node", color: "#d5983b", accent: "#f1e8cf" },
  { id: "greed", label: "GREED", name: "Greedy Wrench", hint: "small fast 75%", color: "#ff6b28", accent: "#ffe28f" },
];
const DEMO_ONLY_ABILITY_IDS = new Set(demoAbilities.map((ability) => ability.id));

const squad = [
  {
    id: "lead",
    gender: "male",
    role: "rifleman",
    spawn: { x: 44, y: 372 },
    escape: { x: 28, y: 202 },
  },
  {
    id: "north",
    gender: "male",
    role: "scout",
    spawn: { x: 56, y: 58 },
    escape: { x: 54, y: 22 },
  },
  {
    id: "east",
    gender: "male",
    role: "heavy",
    spawn: { x: 728, y: 144 },
    escape: { x: 740, y: 202 },
  },
  {
    id: "south",
    gender: "female",
    role: "engineer",
    spawn: { x: 620, y: 410 },
    escape: { x: 680, y: 424 },
  },
  {
    id: "west",
    gender: "female",
    role: "scout",
    spawn: { x: 36, y: 232 },
    escape: { x: 20, y: 128 },
  },
  {
    id: "ridge",
    gender: "male",
    role: "engineer",
    spawn: { x: 148, y: 42 },
    escape: { x: 238, y: 18 },
  },
  {
    id: "bolt",
    gender: "female",
    role: "rifleman",
    spawn: { x: 728, y: 390 },
    escape: { x: 748, y: 320 },
  },
  {
    id: "cinder",
    gender: "male",
    role: "heavy",
    spawn: { x: 390, y: 402 },
    escape: { x: 462, y: 424 },
  },
];

let activeStyle = "steampunk";
let showSkillConfig = false;
let startedAt = performance.now();
let lastStatus = "";
let gameStarted = false;
const soldierFrameCache = {};
const demoVisibleNodeCache = new Map();
const demoNodePlanCache = new Map();
const demoDetonationCache = new Map();
const demoEscapeStartCache = new Map();
const demoPreviousScoreCache = new Map();
const audioState = {
  context: null,
  master: null,
  noiseBuffer: null,
  enabled: false,
  unlocked: false,
  nextStepAt: 0,
  nextHazardAt: 0,
  explosionCycle: -1,
  demoAbilityCueCycle: -1,
  demoAbilityCueKeys: new Set(),
  demoAbilityCueCounts: {},
};
const sessionState = {
  user: null,
  roomId: "",
  socket: null,
  ready: false,
  room: null,
  nextMoveAt: 0,
  copiedAt: 0,
  briefingDismissedFor: "",
  target: null,
  localPosition: null,
  nextRoomPollAt: 0,
  pollingRoom: false,
  rooms: [],
  roomListError: "",
  loadingRooms: false,
  nextRoomListPollAt: 0,
};

ctx.imageSmoothingEnabled = false;

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function setCssVars(style) {
  const root = document.documentElement;
  root.style.setProperty("--page-bg", style.css.page);
  root.style.setProperty("--panel-bg", style.css.panel);
  root.style.setProperty("--panel-strong", style.css.strong);
  root.style.setProperty("--text", style.css.text);
  root.style.setProperty("--muted", style.css.muted);
  root.style.setProperty("--accent", style.css.accent);
  root.style.setProperty("--accent-2", style.css.accent2);
  root.style.setProperty("--border", style.css.border);
}

function setActiveStyle(nextStyle) {
  activeStyle = nextStyle;
  const style = styles[activeStyle];
  shell.dataset.style = activeStyle;
  setCssVars(style);
  themeSummarySwatch.className = `swatch swatch-${activeStyle}`;
  themeSummaryLabel.textContent = activeStyle === "steampunk" ? "Steam" : activeStyle === "cyberpunk" ? "Cyber" : "Future";

  for (const button of styleButtons) {
    const isActive = button.dataset.style === activeStyle;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function setButtonLabel(button, label) {
  const labelNode = button?.querySelector(".button-label");
  if (labelNode) {
    labelNode.textContent = label;
    return;
  }
  if (button) {
    button.textContent = label;
  }
}

function replay() {
  startedAt = performance.now();
  lastStatus = "";
  audioState.nextStepAt = 0;
  audioState.explosionCycle = -1;
  audioState.demoAbilityCueCycle = -1;
  audioState.demoAbilityCueKeys.clear();
  audioState.demoAbilityCueCounts = {};
}

function startGame() {
  if (shell.classList.contains("is-browsing-rooms")) {
    shell.classList.remove("is-browsing-rooms");
    if (gameStarted || sessionState.roomId) {
      shell.classList.remove("is-gated");
    } else {
      shell.classList.add("is-gated");
    }
    updateSessionUi();
    updateRoomStatus();
    return;
  }
  if (sessionState.roomId && sessionState.room?.phase === "lobby") return;
  gameStarted = true;
  shell.classList.remove("is-gated");
  replay();
}

async function unlockAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;

  if (!audioState.context) {
    audioState.context = new AudioContext();
    audioState.master = audioState.context.createGain();
    audioState.master.gain.value = 0.44;
    audioState.master.connect(audioState.context.destination);
  }

  await audioState.context.resume();
  audioState.unlocked = true;
  return true;
}

async function setAudioEnabled(enabled) {
  if (enabled) {
    const unlocked = await unlockAudio();
    audioState.enabled = unlocked;
  } else {
    audioState.enabled = false;
    if (audioState.context) {
      await audioState.context.suspend();
    }
  }

  updateAudioButton();
}

function updateAudioButton() {
  setButtonLabel(audioButton, audioState.enabled ? "Sound On" : "Sound Off");
  audioButton.setAttribute("aria-pressed", String(audioState.enabled));
}

function getNoiseBuffer() {
  const audio = audioState.context;
  if (audioState.noiseBuffer || !audio) return audioState.noiseBuffer;

  const length = Math.floor(audio.sampleRate * 0.58);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let held = 0;

  for (let i = 0; i < length; i += 1) {
    if (i % 84 === 0) {
      held = Math.round((Math.random() * 2 - 1) * 7) / 7;
    }
    data[i] = held * (1 - i / length);
  }

  audioState.noiseBuffer = buffer;
  return buffer;
}

function playSquareTone(frequency, start, duration, volume) {
  const audio = audioState.context;
  if (!audio || !audioState.master) return;

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioState.master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playFootstepSound(count, phase) {
  const audio = audioState.context;
  if (!audio || !audioState.unlocked || !audioState.enabled) return;

  const base = phase === "escape" ? 118 : 84;
  const stagger = count > 2 ? 7 : 0;
  const frequency = base + (count % 3) * 18 + stagger;
  playSquareTone(frequency, audio.currentTime, 0.035, 0.055);
  playSquareTone(frequency * 0.5, audio.currentTime + 0.018, 0.025, 0.035);
}

function playExplosionSound() {
  const audio = audioState.context;
  if (!audio || !audioState.master || !audioState.unlocked || !audioState.enabled) return;

  const start = audio.currentTime;
  const noise = audio.createBufferSource();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  noise.buffer = getNoiseBuffer();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, start);
  filter.frequency.exponentialRampToValueAtTime(120, start + 0.54);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.95, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.56);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioState.master);
  noise.start(start);
  noise.stop(start + 0.58);

  playSquareTone(180, start, 0.18, 0.22);
  playSquareTone(92, start + 0.06, 0.28, 0.18);
  playSquareTone(46, start + 0.18, 0.32, 0.14);

  for (let i = 0; i < 12; i += 1) {
    playSquareTone(220 + hash2d(i, 4, activeStyle.length) * 620, start + 0.05 + i * 0.032, 0.028, 0.045);
  }
}

function playHazardBeep() {
  const audio = audioState.context;
  if (!audio || !audioState.unlocked || !audioState.enabled) return;

  const start = audio.currentTime;
  playSquareTone(880, start, 0.07, 0.08);
  playSquareTone(440, start + 0.08, 0.06, 0.055);
}

function playDemoAbilitySound(abilityId) {
  const audio = audioState.context;
  if (!audio || !audioState.unlocked || !audioState.enabled) return;

  const start = audio.currentTime;
  if (abilityId === "boost") {
    playSquareTone(180, start, 0.075, 0.1);
    playSquareTone(360, start + 0.045, 0.09, 0.09);
    playSquareTone(540, start + 0.105, 0.06, 0.07);
    return;
  }
  if (abilityId === "magnet") {
    playSquareTone(128, start, 0.18, 0.11);
    playSquareTone(192, start + 0.055, 0.16, 0.08);
    playSquareTone(96, start + 0.12, 0.12, 0.07);
    return;
  }
  if (abilityId === "stasis") {
    playSquareTone(1560, start, 0.045, 0.12);
    playSquareTone(780, start + 0.045, 0.08, 0.1);
    playSquareTone(390, start + 0.115, 0.08, 0.075);
    return;
  }
  if (abilityId === "warp") {
    playSquareTone(420, start, 0.055, 0.1);
    playSquareTone(840, start + 0.045, 0.065, 0.11);
    playSquareTone(1260, start + 0.095, 0.055, 0.09);
    return;
  }
  if (abilityId === "greed") {
    playSquareTone(980, start, 0.055, 0.12);
    playSquareTone(1470, start + 0.06, 0.055, 0.1);
    playSquareTone(1960, start + 0.12, 0.045, 0.07);
  }
}

function cueDemoAbilitySound(key, abilityId) {
  if (audioState.demoAbilityCueKeys.has(key)) return;
  audioState.demoAbilityCueKeys.add(key);
  audioState.demoAbilityCueCounts[abilityId] = (audioState.demoAbilityCueCounts[abilityId] || 0) + 1;
  playDemoAbilitySound(abilityId);
}

function updateDemoAudio(style, loop, time) {
  if (!audioState.enabled || !audioState.unlocked || !audioState.context) return;

  if (sessionState.room) {
    if (sessionState.room.phase === "repair" && getCountdownMs() <= 7500 && time >= audioState.nextHazardAt) {
      playHazardBeep();
      audioState.nextHazardAt = time + 620;
    }
    if (sessionState.room.phase === "explosion" && audioState.explosionCycle !== sessionState.room.cycle) {
      playExplosionSound(style);
      audioState.explosionCycle = sessionState.room.cycle;
    }
    return;
  }

  if (audioState.demoAbilityCueCycle !== loop.cycle) {
    audioState.demoAbilityCueCycle = loop.cycle;
    audioState.demoAbilityCueKeys.clear();
    audioState.demoAbilityCueCounts = {};
  }

  if (isDemoDetonated(loop)) {
    if (audioState.explosionCycle !== loop.cycle && loop.elapsed < EXPLOSION_START + 1350) {
      playExplosionSound(style);
      audioState.explosionCycle = loop.cycle;
    }
    return;
  }

  const actors = squad.map((member, index) => getDemoActorState(member, index, loop, time)).filter(Boolean);
  const repairElapsed = getDemoRepairElapsed(loop);

  for (const actor of actors) {
    const abilityId = actor.ability?.id;
    if (!abilityId || actor.phase !== "repair") continue;
    if (abilityId === "boost" && actor.boostActive) {
      cueDemoAbilitySound(`${loop.cycle}:boost:${actor.member.id}:${Math.floor(repairElapsed / getBoostIntervalMs())}`, abilityId);
    } else if (abilityId === "warp" && actor.warpHopActive && repairElapsed % SKILL_CONFIG.warp.cooldownMs < 180) {
      cueDemoAbilitySound(`${loop.cycle}:warp:${actor.member.id}:${Math.floor(repairElapsed / SKILL_CONFIG.warp.cooldownMs)}`, abilityId);
    } else if (abilityId === "stasis" && actor.stasisPulse) {
      cueDemoAbilitySound(`${loop.cycle}:stasis:${actor.member.id}:${Math.floor(repairElapsed / SKILL_CONFIG.stasis.cooldownMs)}`, abilityId);
    } else if ((abilityId === "greed" || abilityId === "magnet") && actor.activeNode) {
      cueDemoAbilitySound(`${loop.cycle}:${abilityId}:${actor.member.id}:${actor.activeNode.id}`, abilityId);
    }
  }

}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function getLoopState(totalElapsed) {
  const cycle = Math.floor(totalElapsed / LOOP_DURATION);
  const elapsed = totalElapsed % LOOP_DURATION;
  const rebuildProgress = clamp((elapsed - REBUILD_START) / (REBUILD_END - REBUILD_START), 0, 1);
  const upgradeLevel = Math.min(3, cycle + rebuildProgress);

  return {
    cycle,
    elapsed,
    upgradeLevel,
    rebuildProgress,
  };
}

function getDemoLoopState(totalElapsed) {
  let elapsed = Math.max(0, totalElapsed);
  let cycle = 0;
  while (cycle < 200) {
    const cycleDuration = getDemoCycleDuration(cycle);
    if (elapsed < cycleDuration) {
      return getDemoVisualLoop({ cycle, elapsed, rebuildProgress: 0, upgradeLevel: cycle });
    }
    elapsed -= cycleDuration;
    cycle += 1;
  }
  return getDemoVisualLoop({ cycle, elapsed: 0, rebuildProgress: 0, upgradeLevel: cycle });
}

function getDemoCycleDuration(cycle) {
  return getDemoDetonationElapsed(cycle) + (REBUILD_END - EXPLOSION_START);
}

function getDemoRepairElapsed(loop) {
  const detonationElapsed = Number.isFinite(loop.detonationElapsed) ? loop.detonationElapsed : getDemoDetonationElapsed(loop.cycle);
  return Math.min(loop.rawElapsed ?? loop.elapsed, detonationElapsed);
}

function isDemoDetonated(loop) {
  const detonationElapsed = Number.isFinite(loop.detonationElapsed) ? loop.detonationElapsed : getDemoDetonationElapsed(loop.cycle);
  return Boolean(loop.detonated) || (loop.rawElapsed ?? loop.elapsed) >= detonationElapsed;
}

function getDemoCountdownMs(loop) {
  return getDemoCountdownMsForElapsed(loop.cycle, getDemoRepairElapsed(loop));
}

function getDemoCountdownMsForElapsed(cycle, elapsed) {
  const nodeDeltaMs = getDemoNodeTimerDeltaMs(cycle, elapsed);
  return Math.max(0, Math.min(DEMO_REPAIR_DURATION - elapsed + nodeDeltaMs, EXPLOSION_START - elapsed));
}

function getDemoNodeTimerDeltaMs(cycle, elapsed) {
  const probeLoop = { cycle, elapsed, rawElapsed: elapsed, detonationElapsed: DEMO_MAX_REPAIR_ELAPSED };
  return getDemoNodeStates(probeLoop, Date.now(), null, getDemoVisibleNodes(cycle, elapsed), { ignoreEscape: true, ignoreStasis: true }).reduce(
    (sum, node) => {
      if (!node.repaired) return sum;
      const owner = squad.find((member) => member.id === node.repairedBy);
      const ability = owner ? getDemoAbility(owner, cycle) : null;
      return sum + getEffectiveNodeValue(node, ability?.id) * DEMO_NODE_TIMER_FACTOR_MS;
    },
    0,
  );
}

function getDemoDetonationElapsed(cycle) {
  if (demoDetonationCache.has(cycle)) return demoDetonationCache.get(cycle);
  let detonationElapsed = EXPLOSION_START;
  for (let elapsed = 0; elapsed <= EXPLOSION_START; elapsed += 100) {
    if (getDemoCountdownMsForElapsed(cycle, elapsed) <= 0) {
      detonationElapsed = elapsed;
      break;
    }
  }
  demoDetonationCache.set(cycle, detonationElapsed);
  return detonationElapsed;
}

function getDemoVisualLoop(loop) {
  const detonationElapsed = getDemoDetonationElapsed(loop.cycle);
  if (loop.elapsed < detonationElapsed) {
    return {
      ...loop,
      rawElapsed: loop.elapsed,
      elapsed: Math.min(loop.elapsed, EXPLOSION_START - 1),
      detonationElapsed,
      detonated: false,
    };
  }
  const shiftedElapsed = EXPLOSION_START + (loop.elapsed - detonationElapsed);
  const rebuildProgress = clamp((shiftedElapsed - REBUILD_START) / (REBUILD_END - REBUILD_START), 0, 1);
  return {
    ...loop,
    rawElapsed: detonationElapsed,
    elapsed: shiftedElapsed,
    rebuildProgress,
    upgradeLevel: Math.min(3, loop.cycle + rebuildProgress),
    detonationElapsed,
    detonated: true,
  };
}

function getDemoCountdownLabel(loop) {
  return (getDemoCountdownMs(loop) / 1000).toFixed(2);
}

function getDemoAbility(member, cycle) {
  const squadIndex = squad.findIndex((candidate) => candidate.id === member.id);
  if (squadIndex >= 0 && squadIndex < demoAbilities.length) {
    return demoAbilities[(squadIndex + cycle) % demoAbilities.length];
  }
  const index = Math.floor(hash2d(cycle + 1, getStringSeed(member.id), getStringSeed(member.role)) * demoAbilities.length);
  return demoAbilities[Math.min(demoAbilities.length - 1, index)];
}

function getDemoPlants(cycle = 0) {
  const plants = [];
  for (let i = 0; i < DEMO_PLANT_COUNT; i += 1) {
    const radius = DEMO_BLAST.radius + Math.round((hash2d(cycle + 19, i + 7, 3) * 2 - 1) * 12);
    const margin = radius + 10;
    let x = margin + hash2d(cycle + 31, i + 11, 5) * (VIEW.width - margin * 2);
    let y = margin + hash2d(cycle + 43, i + 17, 7) * (VIEW.height - margin * 2);
    if (i > 0) {
      const previous = plants[i - 1];
      if (Math.hypot(previous.x - x, previous.y - y) < 170) {
        x = VIEW.width - x;
        y = VIEW.height - y;
      }
    }
    x = Math.round(clamp(x, margin, VIEW.width - margin));
    y = Math.round(clamp(y, margin, VIEW.height - margin));
    plants.push({ id: `demo-plant-${i + 1}`, x, y, blast: { x, y, radius } });
  }
  return plants;
}

function getDemoBlasts(cycle = 0) {
  return getDemoPlants(cycle).map((plant) => plant.blast);
}

function distanceToNearestDemoPlant(point, cycleOrPlants = 0) {
  const plants = Array.isArray(cycleOrPlants) ? cycleOrPlants : getDemoPlants(cycleOrPlants);
  return plants.reduce((nearest, plant) => Math.min(nearest, Math.hypot(point.x - plant.x, point.y - plant.y)), Number.POSITIVE_INFINITY);
}

function getDemoNodes(cycle = 0) {
  if (!demoNodesByCycle.has(cycle)) {
    const plants = getDemoPlants(cycle);
    demoNodesByCycle.set(
      cycle,
      demoNodePool.map((node) => normalizeDemoNode(node, plants)),
    );
  }
  return demoNodesByCycle.get(cycle);
}

function normalizeDemoNode(node, plants = getDemoPlants(0)) {
  const distance = distanceToNearestDemoPlant(node, plants);
  const plantHeat = demoNodeHeat(node, plants);
  let value = node.value;
  if (value < 0 && distance <= DEMO_RED_EXCLUSION_RADIUS) {
    value = Math.abs(value);
  }
  const magnitude = demoNodeMagnitude(node, plants);
  value = magnitude * (value < 0 ? -1 : 1);
  return {
    ...node,
    value: Number(value.toFixed(2)),
    holdMs: Math.round(Math.abs(value) * 470 + 650),
    distanceFromPlant: Number(distance.toFixed(2)),
    plantHeat: Number(plantHeat.toFixed(4)),
  };
}

function demoNodeMagnitude(node, plants = getDemoPlants(0)) {
  const heat = demoNodeHeat(node, plants);
  const min = node.bonus ? 7 : 2;
  const max = node.bonus ? 10 : 6 + Math.max(0, plants.length - 1) * 2.5;
  return Math.max(1, Math.round(clamp(min + heat * 3.6, min, max)));
}

function demoNodeHeat(node, plants = getDemoPlants(0)) {
  return plants.reduce((sum, plant) => {
    const distance = Math.hypot(node.x - plant.x, node.y - plant.y);
    const falloff = (distance - 60) / 300;
    const closeness = 1 - clamp(falloff, 0, 1);
    return sum + Math.pow(closeness, 1.45);
  }, 0);
}

function buildDemoNodePool(count) {
  const nodes = [...baseDemoNodes];
  let candidate = 0;
  while (nodes.length < count && candidate < 500) {
    const x = 42 + Math.floor(hash2d(candidate + 9, 3, 19) * (VIEW.width - 84));
    const y = 38 + Math.floor(hash2d(candidate + 13, 17, 5) * (VIEW.height - 76));
    candidate += 1;
    if (nodes.some((node) => Math.hypot(node.x - x, node.y - y) < 28)) continue;
    const bonus = hash2d(x, y, candidate) > 0.82;
    const negative = hash2d(x, y, candidate + 41) < 0.58;
    const baseValue = 2.1 + hash2d(x, y, candidate + 7) * 5.4;
    const value = Number((baseValue * (negative ? -1 : 1)).toFixed(2));
    nodes.push({
      id: `dn${nodes.length + 1}`,
      x,
      y,
      value,
      size: bonus ? 10 : 8 + Math.floor(hash2d(x, y, candidate + 11) * 3),
      holdMs: Math.round(Math.abs(value) * 470 + 650),
      bonus,
    });
  }
  return nodes;
}

function getDemoVisibleNodes(cycle, elapsed) {
  const demoNodes = getDemoNodes(cycle);
  const spawnedPerWave = Math.ceil(squad.length * DEMO_NODE_SPAWN_PER_PLAYER_MULTIPLIER);
  const spawnedCount = Math.min(
    demoNodes.length,
    DEMO_INITIAL_NODE_COUNT + Math.floor(Math.max(0, elapsed) / DEMO_NODE_SPAWN_MS) * spawnedPerWave,
  );
  const cacheKey = `${cycle}:${spawnedCount}`;
  if (!demoVisibleNodeCache.has(cacheKey)) {
    demoVisibleNodeCache.set(
      cacheKey,
      [...demoNodes].sort((a, b) => hash2d(a.x, cycle + 13, a.y) - hash2d(b.x, cycle + 13, b.y)).slice(0, spawnedCount),
    );
  }
  return demoVisibleNodeCache.get(cacheKey);
}

function applyDemoNodePulse(node, index, repairElapsed) {
  const nodeSpawnedAt = Math.max(0, (index - DEMO_INITIAL_NODE_COUNT) * DEMO_NODE_SPAWN_MS);
  const pulse = Math.floor(Math.max(0, repairElapsed) / DEMO_NODE_SPAWN_MS);
  const nodeWave = Math.max(0, Math.round(nodeSpawnedAt / DEMO_NODE_SPAWN_MS));
  const pulseCount = Math.max(0, pulse - nodeWave);
  if (pulseCount <= 0) {
    return { ...node, spawnedAt: nodeSpawnedAt, valuePulseCount: 0 };
  }
  const sign = node.value < 0 ? -1 : 1;
  const value = Number(((Math.abs(node.value) + pulseCount) * sign).toFixed(2));
  return {
    ...node,
    spawnedAt: nodeSpawnedAt,
    value,
    valuePulseCount: pulseCount,
    holdMs: Math.round(Math.abs(value) * 470 + 650),
  };
}

function getDemoNodePlan(member, index, cycle) {
  const cacheKey = `${cycle}:${member.id}`;
  if (demoNodePlanCache.has(cacheKey)) return demoNodePlanCache.get(cacheKey);

  const candidates = getDemoNodeCandidates(member, index, cycle);
  const reserved = new Set();
  for (let i = 0; i < index; i += 1) {
    const prior = squad[i];
    if (!prior) continue;
    for (const node of getDemoNodePlan(prior, i, cycle).slice(0, 3)) {
      reserved.add(node.id);
    }
  }

  const plan = [];
  for (const node of candidates) {
    if (!reserved.has(node.id) && !plan.some((chosen) => chosen.id === node.id)) plan.push(node);
    if (plan.length >= 5) break;
  }
  for (const node of candidates) {
    if (!plan.some((chosen) => chosen.id === node.id)) plan.push(node);
    if (plan.length >= 5) break;
  }
  return cacheDemoNodePlan(cacheKey, plan);
}

function getDemoNodeCandidates(member, index, cycle) {
  const ability = getDemoAbility(member, cycle);
  const visibleNodes = getDemoVisibleNodes(cycle, EXPLOSION_START);
  const spawn = member.spawn;
  const byPressure = (a, b) => a.value - b.value || Math.hypot(a.x - spawn.x, a.y - spawn.y) - Math.hypot(b.x - spawn.x, b.y - spawn.y);
  const byRiches = (a, b) => Math.abs(b.value) - Math.abs(a.value) || (a.distanceFromPlant || 0) - (b.distanceFromPlant || 0);
  const byReachableGreed = (a, b) => {
    const score = (node) =>
      Math.abs(node.value) * 70 +
      (isHighValueNode(node) ? 150 : 0) +
      Math.max(0, node.value) * 18 -
      Math.hypot(node.x - spawn.x, node.y - spawn.y) * 0.72;
    return score(b) - score(a);
  };
  const byPositive = (a, b) => b.value - a.value || Math.hypot(a.x - spawn.x, a.y - spawn.y) - Math.hypot(b.x - spawn.x, b.y - spawn.y);

  if (ability.id === "greed") {
    return [...visibleNodes].sort(byReachableGreed);
  }
  if (ability.id === "stasis") {
    return [...visibleNodes].sort(byPressure);
  }
  if (ability.id === "boost") {
    return [...visibleNodes].filter((node) => node.value > 0).sort(byPositive);
  }
  if (ability.id === "magnet") {
    const clusterNodes = getDemoVisibleNodes(cycle, EXPLOSION_START);
    return [...visibleNodes].sort((a, b) => {
      const magnetScore = (node) =>
        Math.abs(node.value) * 32 +
        clusterNodes.filter((other) => Math.hypot(other.x - node.x, other.y - node.y) <= SKILL_CONFIG.magnet.claimRadius).length * 105 -
        Math.hypot(node.x - spawn.x, node.y - spawn.y) * 0.52;
      return magnetScore(b) - magnetScore(a);
    });
  }
  if (ability.id === "warp") {
    return [...visibleNodes].sort(byRiches);
  }

  const start = Math.floor(hash2d(index + 3, cycle + 7, member.id.length) * visibleNodes.length);
  const stride = 2 + (index % 3);
  return Array.from({ length: visibleNodes.length }, (_, offset) => visibleNodes[(start + offset * stride) % visibleNodes.length]).filter(Boolean);
}

function cacheDemoNodePlan(cacheKey, plan) {
  demoNodePlanCache.set(cacheKey, plan);
  return plan;
}

function getDemoEscapeThresholdMs(ability) {
  if (ability.id === "greed") return DEMO_ESCAPE_THRESHOLD_MS * 0.58;
  if (ability.id === "stasis") return DEMO_ESCAPE_THRESHOLD_MS * 0.72;
  if (ability.id === "boost") return DEMO_ESCAPE_THRESHOLD_MS * 0.78;
  if (ability.id === "warp") return DEMO_ESCAPE_THRESHOLD_MS * 0.76;
  return DEMO_ESCAPE_THRESHOLD_MS;
}

function getDemoPathSpeed(ability) {
  const abilitySpeed = ability.id === "warp" ? 1.18 : 1;
  return DEMO_RUNNER_SPEED * abilitySpeed;
}

function getDemoTravelState(distance, baseSpeed, ability, startElapsed, availableMs) {
  if (ability.id !== SKILL_IDS.boost) {
    const travelMs = Math.max(120, distance / baseSpeed);
    return {
      complete: availableMs >= travelMs,
      elapsedMs: Math.min(availableMs, travelMs),
      progress: clamp(availableMs / travelMs, 0, 1),
    };
  }

  let elapsedMs = 0;
  let traveled = 0;
  while (elapsedMs < availableMs && traveled < distance) {
    const now = startElapsed + elapsedMs;
    const phase = now % getBoostIntervalMs();
    const active = phase < SKILL_CONFIG.boost.activeMs;
    const nextBoundary = active ? SKILL_CONFIG.boost.activeMs - phase : getBoostIntervalMs() - phase;
    const speed = baseSpeed * (active ? SKILL_CONFIG.boost.speedMultiplier : 1);
    const remainingTime = availableMs - elapsedMs;
    const remainingDistance = distance - traveled;
    const timeToFinish = remainingDistance / speed;
    const sliceMs = Math.min(remainingTime, nextBoundary, timeToFinish);
    elapsedMs += sliceMs;
    traveled += speed * sliceMs;
  }

  return {
    complete: traveled >= distance,
    elapsedMs,
    progress: clamp(traveled / distance, 0, 1),
  };
}

function getDemoHoldDurationMs(node, ability) {
  return getCaptureDurationMs(node, ability.id);
}

function getDemoRouteState(member, index, cycle, elapsed, options = {}) {
  const ability = getDemoAbility(member, cycle);
  const escapeThreshold = getDemoEscapeThresholdMs(ability);
  const escapeStart = options.ignoreEscape ? Number.POSITIVE_INFINITY : getDemoEscapeStartElapsed(cycle, escapeThreshold);
  const targets = getDemoNodePlan(member, index, cycle);

  if (!options.ignoreEscape && elapsed >= escapeStart) {
    const riskClaim = getDemoRiskClaimTarget(member, index, cycle, escapeStart, elapsed, ability);
    if (riskClaim) {
      return getDemoRiskClaimRouteState(member, index, cycle, elapsed, escapeStart, escapeThreshold, riskClaim, options);
    }
    const start = getDemoRouteState(member, index, cycle, escapeStart - 1, { ...options, ignoreEscape: true });
    const progress = easeInOut(clamp((elapsed - escapeStart) / escapeThreshold, 0, 1));
    return {
      ...getPointOnPath([start, member.escape], progress),
      phase: "escape",
      activeNode: null,
      holdRemainingMs: 0,
      repairedNodeIds: getDemoCompletedRouteNodeIds(member, index, cycle, escapeStart - 1, options),
      repairedEvents: getDemoRouteState(member, index, cycle, escapeStart - 1, { ...options, ignoreEscape: true }).repairedEvents || [],
    };
  }

  const repairedNodeIds = new Set();
  const repairedEvents = [];
  let cursor = Math.max(0, elapsed - index * 170);
  let timelineElapsed = index * 170;
  let position = member.spawn;
  const baseSpeed = DEMO_RUNNER_PIXELS_PER_MS * getDemoPathSpeed(ability);
  const route = targets.length > 0 ? targets : [member.escape];

  while (cursor > 0) {
    for (const node of route) {
      const distance = Math.hypot(node.x - position.x, node.y - position.y);
      const travel = getDemoTravelState(distance, baseSpeed, ability, timelineElapsed, cursor);
      if (!travel.complete) {
        return {
          ...getPointOnPath([position, node], travel.progress),
          phase: "move",
          activeNode: null,
          holdRemainingMs: 0,
          repairedNodeIds: [...repairedNodeIds],
          repairedEvents: [...repairedEvents],
        };
      }

      cursor -= travel.elapsedMs;
      timelineElapsed += travel.elapsedMs;
      position = node;
      const holdMs = getDemoHoldDurationMs(node, ability);
      if (cursor < holdMs) {
        return {
          x: node.x,
          y: node.y,
          phase: "claim",
          activeNode: node,
          holdRemainingMs: holdMs - cursor,
          holdDurationMs: holdMs,
          repairedNodeIds: [...repairedNodeIds],
          repairedEvents: [...repairedEvents],
        };
      }

      cursor -= holdMs;
      timelineElapsed += holdMs;
      repairedNodeIds.add(node.id);
      repairedEvents.push({ id: node.id, elapsed: timelineElapsed });
    }
  }

  return {
    ...position,
    phase: "move",
    activeNode: null,
    holdRemainingMs: 0,
    repairedNodeIds: [...repairedNodeIds],
    repairedEvents: [...repairedEvents],
  };
}

function getDemoRiskClaimTarget(member, index, cycle, escapeStart, elapsed, ability) {
  const remaining = getDemoCountdownMsForElapsed(cycle, escapeStart);
  if (remaining <= 0 || remaining > DEMO_ESCAPE_THRESHOLD_MS) return null;
  const start = getDemoRouteState(member, index, cycle, escapeStart - 1, { ignoreEscape: true });
  const alreadyRepaired = new Set(start.repairedNodeIds || []);
  return getDemoVisibleNodes(cycle, escapeStart)
    .filter((node) => node.value > 0 && !alreadyRepaired.has(node.id))
    .map((node) => {
      const distance = Math.hypot(node.x - start.x, node.y - start.y);
      const travelMs = getDemoTravelState(distance, DEMO_RUNNER_PIXELS_PER_MS * getDemoPathSpeed(ability), ability, escapeStart, 10_000).elapsedMs;
      const holdMs = getDemoHoldDurationMs(applyDemoNodePulse(node, 0, escapeStart), ability);
      return { node, start, travelMs, holdMs, totalMs: travelMs + holdMs, score: node.value * 100 - distance };
    })
    .filter((candidate) => candidate.holdMs <= DEMO_RISK_CLAIM_WINDOW_MS && candidate.totalMs <= remaining + 700 && elapsed < escapeStart + candidate.totalMs + DEMO_ESCAPE_THRESHOLD_MS)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function getDemoRiskClaimRouteState(member, index, cycle, elapsed, escapeStart, escapeThreshold, riskClaim, options = {}) {
  const prior = riskClaim.start;
  const elapsedSinceRisk = Math.max(0, elapsed - escapeStart);
  const priorIds = prior.repairedNodeIds || [];
  const priorEvents = prior.repairedEvents || [];

  if (elapsedSinceRisk < riskClaim.travelMs) {
    const progress = clamp(elapsedSinceRisk / Math.max(1, riskClaim.travelMs), 0, 1);
    return {
      ...getPointOnPath([prior, riskClaim.node], progress),
      phase: "move",
      activeNode: null,
      holdRemainingMs: 0,
      repairedNodeIds: [...priorIds],
      repairedEvents: [...priorEvents],
    };
  }

  const claimElapsed = elapsedSinceRisk - riskClaim.travelMs;
  if (claimElapsed < riskClaim.holdMs) {
    return {
      x: riskClaim.node.x,
      y: riskClaim.node.y,
      phase: "claim",
      activeNode: riskClaim.node,
      holdRemainingMs: riskClaim.holdMs - claimElapsed,
      holdDurationMs: riskClaim.holdMs,
      repairedNodeIds: [...priorIds],
      repairedEvents: [...priorEvents],
    };
  }

  const repairedNodeIds = [...priorIds, riskClaim.node.id];
  const repairedEvents = [...priorEvents, { id: riskClaim.node.id, elapsed: escapeStart + riskClaim.travelMs + riskClaim.holdMs }];
  const escapeElapsed = elapsedSinceRisk - riskClaim.totalMs;
  const progress = easeInOut(clamp(escapeElapsed / escapeThreshold, 0, 1));
  return {
    ...getPointOnPath([riskClaim.node, member.escape], progress),
    phase: "escape",
    activeNode: null,
    holdRemainingMs: 0,
    repairedNodeIds,
    repairedEvents,
  };
}

function getDemoEscapeStartElapsed(cycle, escapeThreshold) {
  const cacheKey = `${cycle}:${Math.round(escapeThreshold)}`;
  if (demoEscapeStartCache.has(cacheKey)) return demoEscapeStartCache.get(cacheKey);
  const detonationElapsed = getDemoDetonationElapsed(cycle);
  for (let elapsed = 0; elapsed <= detonationElapsed; elapsed += 100) {
    if (getDemoCountdownMsForElapsed(cycle, elapsed) <= escapeThreshold) {
      demoEscapeStartCache.set(cacheKey, elapsed);
      return elapsed;
    }
  }
  const fallback = Math.max(0, detonationElapsed - escapeThreshold);
  demoEscapeStartCache.set(cacheKey, fallback);
  return fallback;
}

function getDemoPlayPosition(member, index, cycle, elapsed) {
  return getDemoRouteState(member, index, cycle, elapsed);
}

function getDemoCompletedRouteNodeIds(member, index, cycle, elapsed, options = {}) {
  return getDemoRouteState(member, index, cycle, elapsed, options).repairedNodeIds || [];
}

function getDemoDetonationPosition(member, index, cycle) {
  return getDemoPlayPosition(member, index, cycle, getDemoDetonationElapsed(cycle) - 1);
}

function getDemoRoundScore(member, index, loop) {
  const ability = getDemoAbility(member, loop.cycle);
  const repaired = getDemoNodeStates(loop, Date.now(), null, getDemoVisibleNodes(loop.cycle, getDemoRepairElapsed(loop)), {
    ignoreEscape: true,
    ignoreStasis: true,
  }).filter((node) => node.repairedBy === member.id);
  return repaired.reduce((score, node) => {
    return score + getNodeScoreValue(node, ability.id);
  }, 0);
}

function getDemoPlayerOutcome(member, index, loop) {
  const position = getDemoDetonationPosition(member, index, loop.cycle);
  const caught = getDemoBlasts(loop.cycle).some((blast) => Math.hypot(position.x - blast.x, position.y - blast.y) <= blast.radius);
  const roundScore = getDemoRoundScore(member, index, loop);
  const detonated = isDemoDetonated(loop);
  return {
    caught,
    roundScore: caught && detonated ? 0 : roundScore,
    storedRoundScore: roundScore,
    state: caught && detonated ? "incapacitated" : "alive",
  };
}

function getDemoPreviousScore(member, index, cycle) {
  if (cycle <= 0) return 0;
  const cacheKey = `${member.id}:${cycle}`;
  if (demoPreviousScoreCache.has(cacheKey)) return demoPreviousScoreCache.get(cacheKey);

  let total = 0;
  for (let priorCycle = 0; priorCycle < cycle; priorCycle += 1) {
    const outcome = getDemoPlayerOutcome(member, index, {
      cycle: priorCycle,
      elapsed: EXPLOSION_START + 1,
    });
    total += outcome.roundScore || 0;
  }
  const previousScore = Number(total.toFixed(2));
  demoPreviousScoreCache.set(cacheKey, previousScore);
  return previousScore;
}

function getDemoActorState(member, index, loop, time) {
  const ability = getDemoAbility(member, loop.cycle);
  const repairElapsed = getDemoRepairElapsed(loop);
  const detonated = isDemoDetonated(loop);
  const stasisSources = getDemoStasisPulseSources(repairElapsed, loop.cycle);
  const currentPosition = getDemoPlayPosition(member, index, loop.cycle, repairElapsed);
  const inStasis =
    ability.id !== SKILL_IDS.stasis &&
    !detonated &&
    isPointInStasis(currentPosition, stasisSources);

  if (!detonated) {
    const adjustedElapsed = Math.max(0, repairElapsed - (inStasis ? 850 : 0));
    const basePosition = getDemoPlayPosition(member, index, loop.cycle, adjustedElapsed);
    const warped = ability.id === SKILL_IDS.warp && !inStasis ? applyDemoWarpHop(member, index, loop.cycle, adjustedElapsed, basePosition) : null;
    const position = warped?.position || basePosition;
    const boostActive = ability.id === SKILL_IDS.boost && isBoostActive(repairElapsed);
    return {
      ...position,
      member,
      ability,
      phase: inStasis ? PLAYER_STATES.stasis : "repair",
      stasisPulse: stasisSources.some((source) => source.memberId === member.id),
      boostActive,
      skillCooldown: getSkillCooldownRatio(ability.id, repairElapsed),
      warpHopActive: Boolean(warped?.active),
      frozenUntil: inStasis ? time + SKILL_CONFIG.stasis.freezeMs : 0,
      progress: clamp(repairElapsed / getDemoDetonationElapsed(loop.cycle), 0, 1),
      step: inStasis || position.phase === "claim" ? 0 : Math.floor((time + index * 80) / (boostActive ? 58 : 110)) % 2,
      fade: 1,
      dissolve: 0,
    };
  }

  const outcome = getDemoPlayerOutcome(member, index, loop);
  if (outcome.caught && loop.elapsed < REBUILD_START - 1200) {
    const blastAge = clamp((loop.elapsed - EXPLOSION_START) / 1800, 0, 1);
    const position = getDemoDetonationPosition(member, index, loop.cycle);
    const knockback = 10 + index * 4;
    const nearestPlant = getDemoPlants(loop.cycle)
      .map((plant) => ({ plant, distance: Math.hypot(position.x - plant.x, position.y - plant.y) }))
      .sort((a, b) => a.distance - b.distance)[0]?.plant || DEMO_BLAST;
    const angle = Math.atan2(position.y - nearestPlant.y, position.x - nearestPlant.x);
    return {
      x: position.x + Math.cos(angle) * knockback * blastAge,
      y: position.y + Math.sin(angle) * knockback * blastAge + 4 * blastAge,
      member,
      ability,
      phase: "incapacitated",
      stasisPulse: false,
      progress: 1,
      step: 0,
      fade: 1,
      dissolve: 0,
      caught: true,
    };
  }

  const escapeProgress = easeInOut(clamp((loop.elapsed - ESCAPE_START - index * 130) / 2600, 0, 1));
  if (escapeProgress <= 0 || escapeProgress >= 1) return null;
  const position = getPointOnPath(
    [
      getDemoDetonationPosition(member, index, loop.cycle),
      member.escape,
    ],
    escapeProgress,
  );
  return {
    ...position,
    member,
    ability,
    phase: "escape",
    stasisPulse: false,
    progress: escapeProgress,
    step: Math.floor((time + index * 80) / 88) % 2,
    fade: 1,
    dissolve: 0,
  };
}

function applyDemoWarpHop(member, index, cycle, elapsed, position) {
  const phaseElapsed = elapsed % SKILL_CONFIG.warp.cooldownMs;
  if (phaseElapsed >= SKILL_CONFIG.warp.activeMs) return { position, active: false };

  const targetNode = findBestWarpNode(position, getDemoVisibleNodes(cycle, elapsed));
  if (!targetNode) return { position, active: false };

  const pulse = Math.sin((phaseElapsed / SKILL_CONFIG.warp.activeMs) * Math.PI);
  return {
    active: true,
    targetNode,
    position: {
      ...position,
      x: lerp(position.x, targetNode.x, pulse),
      y: lerp(position.y, targetNode.y, pulse),
      activeNode: pulse > 0.82 ? targetNode : position.activeNode,
      phase: pulse > 0.82 ? "claim" : position.phase,
      holdRemainingMs: pulse > 0.82 ? getCaptureDurationMs(targetNode, SKILL_IDS.warp) : position.holdRemainingMs,
      holdDurationMs: pulse > 0.82 ? getCaptureDurationMs(targetNode, SKILL_IDS.warp) : position.holdDurationMs,
    },
  };
}

function isDemoStasisPulseActive(elapsed, cycle) {
  return getDemoStasisPulseSources(elapsed, cycle).length > 0;
}

function getDemoStasisPulseSources(elapsed, cycle) {
  if (elapsed >= EXPLOSION_START || !isStasisPulseActive(elapsed)) return [];
  return squad
    .map((member, index) => ({ member, index, ability: getDemoAbility(member, cycle) }))
    .filter((entry) => entry.ability.id === "stasis")
    .map((entry) => ({
      ...getDemoPlayPosition(entry.member, entry.index, cycle, elapsed),
      memberId: entry.member.id,
    }));
}

function getDemoRoom(loop, time) {
  if (sessionState.room) return sessionState.room;
  const now = Date.now();
  const repairElapsed = getDemoRepairElapsed(loop);
  const detonated = isDemoDetonated(loop);
  const actors = squad.map((member, index) => getDemoActorState(member, index, loop, time)).filter(Boolean);
  const players = {};
  for (const actor of actors) {
    const index = squad.indexOf(actor.member);
    const outcome = getDemoPlayerOutcome(actor.member, index, loop);
    players[actor.member.id] = {
      id: actor.member.id,
      x: actor.x,
      y: actor.y,
      role: actor.member.role,
      ability: actor.ability,
      state: actor.phase === PLAYER_STATES.stasis ? PLAYER_STATES.stasis : outcome.state,
      boostActive: Boolean(actor.boostActive),
      warpHopActive: Boolean(actor.warpHopActive),
      skillCooldown: actor.skillCooldown,
      ready: true,
      score: outcome.roundScore,
      roundScore: outcome.roundScore,
    };
  }

  const visibleNodes = getDemoVisibleNodes(loop.cycle, repairElapsed);
  const nodes = getDemoNodeStates(loop, now, actors, visibleNodes);
  const nodeTimerDeltaMs = nodes.reduce((sum, node) => {
    if (!node.repaired) return sum;
    const owner = squad.find((member) => member.id === node.repairedBy);
    const ability = owner ? getDemoAbility(owner, loop.cycle) : null;
    return sum + getEffectiveNodeValue(node, ability?.id) * DEMO_NODE_TIMER_FACTOR_MS;
  }, 0);
  const countdownEndsAt = now + getDemoCountdownMs(loop);

  return {
    phase: detonated ? "explosion" : "repair",
    countdownEndsAt,
    phaseStartedAt: now - repairElapsed,
    plants: getDemoPlants(loop.cycle),
    blasts: getDemoBlasts(loop.cycle),
    blast: getDemoBlasts(loop.cycle)[0],
    nodes,
    nodeTimerDeltaMs,
    repairedNodeCount: nodes.filter((node) => node.repaired).length,
    players,
    summary: getDemoSummary(loop),
    skillStats: getDemoSkillStats(loop, actors),
    targetPlayerCount: squad.length,
  };
}

function getDemoNodeStates(loop, now = Date.now(), actors = null, visibleNodes = getDemoVisibleNodes(loop.cycle, getDemoRepairElapsed(loop)), options = {}) {
  const repairElapsed = getDemoRepairElapsed(loop);
  const detonationElapsed = options.ignoreEscape ? DEMO_MAX_REPAIR_ELAPSED : getDemoDetonationElapsed(loop.cycle);
  const stasisSources = options.ignoreStasis ? [] : getDemoStasisPulseSources(repairElapsed, loop.cycle);
  const actorRoutes = squad.map((member, index) => ({
    member,
    index,
    ability: getDemoAbility(member, loop.cycle),
    route: getDemoRouteState(member, index, loop.cycle, Math.min(repairElapsed, detonationElapsed - 1), options),
  }));
  const activeActors = actors || actorRoutes.map(({ member, index, ability, route }) => ({ ...route, member, ability, id: member.id, index }));
  const repairedNodeIds = new Set(actorRoutes.flatMap((entry) => entry.route.repairedNodeIds || []));
  const repairedEvents = new Map(actorRoutes.flatMap((entry) => (entry.route.repairedEvents || []).map((event) => [event.id, { ...event, memberId: entry.member.id }])));

  return visibleNodes.map((baseNode, index) => {
    const node = applyDemoNodePulse(baseNode, index, repairElapsed);
    const stasisLocked = isNodeInStasis(node, stasisSources);
    const claimant = activeActors.find((actor) => {
      if (!canSkillClaimNode(actor, node)) return false;
      return !stasisLocked || canPlayerClaimDuringStasis(actor);
    });
    const routeClaimant = actorRoutes.find((entry) => entry.member.id === claimant?.member?.id || entry.member.id === claimant?.id);
    const repaired = repairedNodeIds.has(node.id);
    const repairedBy = repaired ? actorRoutes.find((entry) => entry.route.repairedNodeIds?.includes(node.id))?.member.id || null : null;
    const repairedEvent = repairedEvents.get(node.id);
    const holdRemainingMs =
      !stasisLocked || canPlayerClaimDuringStasis(claimant)
        ? routeClaimant?.route.activeNode?.id === node.id
          ? routeClaimant.route.holdRemainingMs
          : 0
        : 0;
    const holdDurationMs = routeClaimant?.route.holdDurationMs || node.holdMs;
    const claimedBy = !repaired && holdRemainingMs > 0 && claimant ? claimant.member?.id || claimant.id : null;
    return {
      ...node,
      seed: node.x * 0.013 + node.y * 0.017 + loop.cycle,
      repaired,
      repairedBy,
      repairedAtElapsed: repairedEvent?.elapsed ?? null,
      state: repaired ? NODE_STATES.repaired : stasisLocked && !claimedBy ? NODE_STATES.stasis : claimedBy ? NODE_STATES.claimed : NODE_STATES.unclaimed,
      stasisLocked,
      claimedBy,
      claimEndsAt: claimedBy ? now + holdRemainingMs : null,
      claimDurationMs: holdDurationMs,
      negative: node.value < 0,
    };
  });
}

function getDemoSummary(loop) {
  return squad.map((member, index) => {
    const outcome = getDemoPlayerOutcome(member, index, loop);
    const ability = getDemoAbility(member, loop.cycle);
    const previousScore = getDemoPreviousScore(member, index, loop.cycle);
    return {
      id: member.id,
      ability,
      roundScore: outcome.roundScore,
      previousScore,
      score: Number((previousScore + outcome.roundScore).toFixed(2)),
      state: outcome.state,
      lost: outcome.caught ? outcome.storedRoundScore : 0,
    };
  });
}

function getDemoSkillStats(loop, actors = null) {
  const elapsed = Math.min(getDemoRepairElapsed(loop), getDemoDetonationElapsed(loop.cycle) - 1);
  const activeAbilityIds = actors ? new Set(actors.map((actor) => actor.ability?.id).filter(Boolean)) : null;
  const stats = {
    boost: { label: "BOOST", count: 0, detail: "speed blips" },
    magnet: { label: "MAG", count: 0, detail: "remote claims" },
    stasis: { label: "STASIS", count: 0, detail: "players frozen" },
    warp: { label: "WARP", count: 0, detail: "portal hops" },
    greed: { label: "GREED", count: 0, detail: "value snaps" },
  };

  if (actors) {
    stats.greed.count += actors.filter((actor) => actor.ability?.id === SKILL_IDS.greed && actor.activeNode).length;
    stats.magnet.count += actors.filter((actor) => actor.ability?.id === SKILL_IDS.magnet && actor.activeNode).length;
  }

  for (const [index, member] of squad.entries()) {
    const ability = getDemoAbility(member, loop.cycle);
    if (activeAbilityIds && !activeAbilityIds.has(ability.id)) continue;
    if (ability.id === "boost") {
      stats.boost.count += countDemoMovingWindows(member, index, loop.cycle, elapsed, getBoostIntervalMs(), SKILL_CONFIG.boost.activeMs);
    } else if (ability.id === "warp") {
      stats.warp.count += countDemoMovingWindows(member, index, loop.cycle, elapsed, SKILL_CONFIG.warp.cooldownMs, SKILL_CONFIG.warp.activeMs);
    } else if (ability.id === "magnet") {
      const repairedIds = new Set(getDemoCompletedRouteNodeIds(member, index, loop.cycle, elapsed));
      stats.magnet.count += getDemoNodeStates({ ...loop, elapsed, rawElapsed: elapsed }, Date.now(), null, getDemoVisibleNodes(loop.cycle, elapsed), {
        ignoreEscape: true,
        ignoreStasis: true,
      }).filter((node) => repairedIds.has(node.id)).length;
    } else if (ability.id === "greed") {
      const greedRoute = getDemoRouteState(member, index, loop.cycle, elapsed, { ignoreEscape: true });
      const repairedIds = new Set(greedRoute.repairedNodeIds || []);
      stats.greed.count += getDemoNodeStates({ ...loop, elapsed, rawElapsed: elapsed }, Date.now(), null, getDemoVisibleNodes(loop.cycle, elapsed), {
        ignoreEscape: true,
        ignoreStasis: true,
      }).filter((node) => repairedIds.has(node.id)).length;
      if (greedRoute.activeNode) stats.greed.count += 1;
    }
  }

  const pulseCount = Math.max(0, Math.floor(elapsed / SKILL_CONFIG.stasis.cooldownMs) + (elapsed > 0 ? 1 : 0));
  for (let pulse = 0; pulse < pulseCount; pulse += 1) {
    const pulseElapsed = Math.min(elapsed, pulse * SKILL_CONFIG.stasis.cooldownMs);
    const sources = getDemoStasisPulseSources(pulseElapsed, loop.cycle);
    for (const source of sources) {
      for (const [index, member] of squad.entries()) {
        const ability = getDemoAbility(member, loop.cycle);
        if (activeAbilityIds && !activeAbilityIds.has(ability.id)) continue;
        if (ability.id === "stasis") continue;
        const position = getDemoPlayPosition(member, index, loop.cycle, pulseElapsed);
        if (isPointInStasis(position, [source])) {
          stats.stasis.count += 1;
        }
      }
    }
  }

  return stats;
}

function countDemoMovingWindows(member, index, cycle, elapsed, intervalMs, activeMs) {
  let count = 0;
  for (let windowStart = 0; windowStart <= elapsed; windowStart += intervalMs) {
    const sampleElapsed = Math.min(elapsed, windowStart + Math.floor(activeMs / 2));
    const route = getDemoRouteState(member, index, cycle, sampleElapsed);
    if (route.phase === "move") count += 1;
  }
  return count;
}

function getPointOnPath(points, progress) {
  const clamped = clamp(progress, 0, 1);
  const segment = Math.min(points.length - 2, Math.floor(clamped * (points.length - 1)));
  const local = clamped * (points.length - 1) - segment;
  const current = points[segment];
  const next = points[segment + 1];

  return {
    x: lerp(current.x, next.x, local),
    y: lerp(current.y, next.y, local),
  };
}

function hash2d(x, y, seed = 0) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.17) * 43758.5453;
  return value - Math.floor(value);
}

function getStringSeed(value) {
  return String(value)
    .split("")
    .reduce((seed, char, index) => seed + char.charCodeAt(0) * (index + 1), 0);
}

function setStatus(loop) {
  if (sessionState.room) {
    const room = sessionState.room;
    let next = `Room ${room.phase}`;
    if (room.phase === "repair") next = `Detonation in ${getCountdownLabel()}s`;
    if (room.phase === "end") next = "Final scores";
    if (next !== lastStatus) {
      statusText.textContent = next;
      lastStatus = next;
    }
    return;
  }

  const { elapsed, cycle } = loop;
  let next = cycle > 0 ? "Ability scramble" : "Demo repair run";
  if (elapsed > 2400) next = `Demo detonation in ${getDemoCountdownLabel(loop)}s`;
  if (elapsed >= EXPLOSION_START) next = "Plant detonation";
  if (elapsed >= ESCAPE_START) next = "Squad escaping";
  if (elapsed >= REBUILD_START) next = "Plant rebuilding";

  if (next !== lastStatus) {
    statusText.textContent = next;
    lastStatus = next;
  }
}

async function loadSession() {
  const roomFromUrl = getRoomIdFromUrl();
  if (roomFromUrl) {
    roomCodeInput.value = roomFromUrl;
  }

  try {
    const response = await fetch("/api/auth/me", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("auth unavailable");
    const payload = await response.json();
    sessionState.user = payload.authenticated ? payload.user : null;
  } catch {
    sessionState.user = null;
  }

  updateSessionUi();
  loadRoomList();
  if (sessionState.user && roomFromUrl) {
    connectRoom(roomFromUrl);
  }
}

function updateSessionUi() {
  const user = sessionState.user;
  const local = getLocalPlayer();
  const isSpectator = Boolean(local?.spectator);
  const isEndPhase = sessionState.room?.phase === "end";
  const replayVoted = Boolean(local && sessionState.room?.replayVotes?.[local.id]);
  const isOwner = Boolean(local && sessionState.room?.ownerId === local.id);
  authStatus.textContent = user ? `@${user.login}` : "Signed out";
  loginButton.classList.toggle("is-hidden", Boolean(user));
  logoutButton.classList.toggle("is-hidden", !user);
  createRoomButton.disabled = !user;
  setButtonLabel(createRoomButton, "New");
  joinRoomButton.disabled = !user;
  setButtonLabel(joinRoomButton, "Rooms");
  readyButton.disabled =
    !user || isSpectator || sessionState.room?.phase !== "lobby" || !sessionState.socket || sessionState.socket.readyState !== WebSocket.OPEN;
  copyRoomButton.disabled = !sessionState.roomId;
  leaveRoomButton.disabled = !sessionState.roomId;
  roomSizeInput.disabled = !user;
  roomCodeInput.disabled = !user;
  botToggle.disabled = !user || Boolean(sessionState.roomId);
  readyButton.classList.toggle("is-active", sessionState.ready);
  readyButton.setAttribute("aria-pressed", String(sessionState.ready));
  setButtonLabel(readyButton, isSpectator ? "Watch" : "Ready");
  endRoomButton.disabled = !user || !sessionState.roomId || !isOwner;
  replayButton.disabled = Boolean(sessionState.room) && (!local || isSpectator || !isEndPhase || replayVoted);
  replayButton.classList.toggle("is-active", Boolean(sessionState.room) && replayVoted);
  replayButton.setAttribute("aria-pressed", String(Boolean(sessionState.room) && replayVoted));
  setButtonLabel(replayButton, sessionState.room ? (replayVoted ? "Voted" : "New game") : "Replay");
  setButtonLabel(startButton, shell.classList.contains("is-browsing-rooms") ? "Back" : "Start");
  roomReadyButton.disabled = readyButton.disabled;
  setButtonLabel(roomReadyButton, isSpectator ? "Spectating" : "Ready");
  sessionActions.classList.toggle("is-active", Boolean(sessionState.roomId));
  shell.classList.toggle("is-roomed", Boolean(sessionState.roomId));
  updateRoomSheet();
  renderRoomList();
}

function updateRoomStatus(nextStatus = null, now = Date.now()) {
  if (nextStatus) {
    roomStatus.classList.remove("is-hidden");
    roomStatus.textContent = nextStatus;
    return;
  }

  if (!sessionState.roomId) {
    roomStatus.textContent = "";
    roomStatus.classList.add("is-hidden");
    return;
  }

  roomStatus.classList.remove("is-hidden");
  roomStatus.textContent = buildRoomStatusText(sessionState.roomId, sessionState.room, getSelectedRoomSize(), now);
}

function updateRoomSheet() {
  const shouldShow = Boolean(
    sessionState.user &&
      sessionState.roomId &&
      sessionState.socket?.readyState === WebSocket.OPEN &&
      sessionState.room?.phase === "lobby" &&
      !getLocalPlayer()?.spectator &&
      !sessionState.ready &&
      sessionState.briefingDismissedFor !== sessionState.roomId,
  );

  roomSheet.classList.toggle("is-hidden", !shouldShow);
  if (!shouldShow) return;

  const players = Object.values(sessionState.room?.players || {});
  const playerCount = players.filter((player) => !player.spectator && !player.bot).length;
  const botCount = players.filter((player) => !player.spectator && player.bot).length;
  const targetCount = sessionState.room?.targetPlayerCount || getSelectedRoomSize();
  roomSheetStatus.textContent = `${sessionState.roomId} · ${playerCount}/${targetCount} joined${botCount ? ` + ${botCount} bot` : ""}`;
}

async function createRoom() {
  if (!sessionState.user) return;
  const previousRoomId = sessionState.roomId;
  if (previousRoomId) {
    disconnectRoom();
    sessionState.roomId = "";
    sessionState.ready = false;
    sessionState.room = null;
    sessionState.target = null;
    sessionState.localPosition = null;
    sessionState.briefingDismissedFor = "";
    clearRoomUrl();
  }
  updateRoomStatus("Creating");

  const namedRoomId = normalizeRoomId(roomCodeInput.value);
  if (namedRoomId && namedRoomId !== previousRoomId) {
    connectRoom(namedRoomId, { bot: botToggle.checked });
    return;
  }
  if (namedRoomId === previousRoomId) {
    roomCodeInput.value = "";
  }

  try {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ playerCount: getSelectedRoomSize(), bot: botToggle.checked }),
    });
    if (response.status === 401) {
      sessionState.user = null;
      updateSessionUi();
      updateRoomStatus("Sign in first");
      return;
    }
    if (!response.ok) throw new Error("room create failed");
    const room = await response.json();
    roomCodeInput.value = room.roomId;
    connectRoom(room.roomId, { bot: botToggle.checked });
  } catch {
    updateRoomStatus("Create failed");
  }
}

function leaveRoom(status = null) {
  disconnectRoom();
  sessionState.roomId = "";
  sessionState.ready = false;
  sessionState.room = null;
  sessionState.target = null;
  sessionState.localPosition = null;
  sessionState.briefingDismissedFor = "";
  roomCodeInput.value = "";
  clearRoomUrl();
  shell.classList.add("is-gated");
  shell.classList.remove("is-browsing-rooms");
  updateRoomStatus(status);
  updateSessionUi();
  updateRoomSheet();
  loadRoomList();
}

function joinRoom() {
  if (!sessionState.user) return;
  const roomId = normalizeRoomId(roomCodeInput.value);
  if (!roomId) {
    updateRoomStatus("Enter code");
    return;
  }

  connectRoom(roomId);
}

function showActiveRooms() {
  shell.classList.add("is-gated", "is-browsing-rooms");
  updateRoomStatus("Rooms");
  updateSessionUi();
  loadRoomList();
}

function connectRoom(roomId, options = {}) {
  disconnectRoom();
  sessionState.roomId = roomId;
  sessionState.ready = false;
  sessionState.room = null;
  sessionState.briefingDismissedFor = "";
  sessionState.localPosition = null;
  sessionState.target = null;
  sessionState.nextRoomPollAt = 0;
  roomCodeInput.value = roomId;
  updateRoomUrl(roomId);
  updateRoomStatus("Connecting");

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const targetPlayerCount = getSelectedRoomSize();
  const params = new URLSearchParams({ players: String(targetPlayerCount) });
  if (options.bot) {
    params.set("bot", "1");
  }
  if (options.spectate) {
    params.set("spectate", "1");
  }
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws/rooms/${roomId}?${params.toString()}`);
  sessionState.socket = socket;

  socket.addEventListener("open", () => {
    if (sessionState.socket !== socket) return;
    shell.classList.remove("is-browsing-rooms");
    updateRoomStatus();
    updateSessionUi();
    updateRoomSheet();
  });

  socket.addEventListener("message", (event) => {
    if (sessionState.socket !== socket) return;
    handleRoomMessage(event.data);
  });

  socket.addEventListener("close", () => {
    if (sessionState.socket !== socket) return;
    leaveRoom(sessionState.room ? "Disconnected" : "Room unavailable");
  });

  socket.addEventListener("error", () => {
    if (sessionState.socket !== socket) return;
    updateRoomStatus("Socket error");
  });
}

function disconnectRoom() {
  if (sessionState.socket) {
    const socket = sessionState.socket;
    sessionState.socket = null;
    socket.close();
  }
}

function handleRoomMessage(rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (message.type === "room:closed" || message.state?.phase === "closed") {
    leaveRoom("Room closed");
    return;
  }

  if (message.state) {
    sessionState.room = message.state;
    sessionState.ready = Boolean(message.state.players?.[sessionState.user?.login]?.ready);
    syncDemoToRoomState(message.state);
  }

  updateRoomStatus();
  updateSessionUi();
  updateRoomSheet();
}

async function loadRoomList() {
  if (!sessionState.user || sessionState.loadingRooms) {
    renderRoomList();
    return;
  }

  sessionState.loadingRooms = true;
  try {
    const response = await fetch("/api/rooms", { headers: { Accept: "application/json" } });
    if (response.ok) {
      const payload = await response.json();
      sessionState.rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
      sessionState.roomListError = "";
    } else {
      sessionState.roomListError = `Rooms unavailable (${response.status})`;
    }
  } catch {
    sessionState.roomListError = "Rooms unavailable";
  } finally {
    sessionState.loadingRooms = false;
    renderRoomList();
  }
}

function pollRoomList(time) {
  if (!sessionState.user || sessionState.roomId || time < sessionState.nextRoomListPollAt) return;
  sessionState.nextRoomListPollAt = time + 5000;
  loadRoomList();
}

function renderRoomList() {
  if (!roomList) return;
  roomList.replaceChildren();
  if (!sessionState.user) {
    roomList.textContent = "Sign in to see open rooms.";
    return;
  }

  const title = document.createElement("div");
  title.className = "room-list-title";
  title.textContent = sessionState.roomListError || "Open rooms";
  roomList.append(title);

  const rooms = sessionState.rooms.filter((room) => !room.closed);
  if (rooms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "room-list-empty";
    empty.textContent = "No rooms yet. Create one.";
    roomList.append(empty);
    return;
  }

  for (const room of rooms) {
    const viewerIsHere = room.viewerRole === "active" || room.viewerRole === "spectator";
    const row = document.createElement("div");
    row.className = "room-list-row";

    const label = document.createElement("span");
    const botSuffix = room.botCount ? ` + ${room.botCount} bot` : "";
    label.textContent = `${room.id} · ${room.activeCount}/${room.targetPlayerCount}${botSuffix} players · ${room.phase}`;
    row.append(label);

    const joinButton = document.createElement("button");
    joinButton.type = "button";
    joinButton.className = "room-list-button";
    joinButton.textContent = viewerIsHere ? "Resume" : "Join";
    joinButton.disabled = !viewerIsHere && room.openSlots < 1;
    joinButton.addEventListener("click", () => connectRoom(room.id));
    row.append(joinButton);

    const spectateButton = document.createElement("button");
    spectateButton.type = "button";
    spectateButton.className = "room-list-button";
    spectateButton.textContent = "Watch";
    spectateButton.disabled = viewerIsHere;
    spectateButton.addEventListener("click", () => connectRoom(room.id, { spectate: true }));
    row.append(spectateButton);

    if (room.phase === "end" || (room.ownerId === sessionState.user?.login && room.phase !== "closed")) {
      const endButton = document.createElement("button");
      endButton.type = "button";
      endButton.className = "room-list-button";
      endButton.textContent = room.phase === "end" ? "Clear" : "End session";
      endButton.addEventListener("click", () => endRoomSession(room.id));
      row.append(endButton);
    }

    roomList.append(row);
  }
}

async function endRoomSession(roomId = sessionState.roomId) {
  if (!roomId || !sessionState.user) return;

  try {
    const response = await fetch(`/api/rooms/${roomId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("session close failed");
    if (roomId === sessionState.roomId) {
      leaveRoom("Session ended");
    } else {
      await loadRoomList();
      updateRoomStatus("Cleared");
    }
  } catch {
    updateRoomStatus("End failed");
  }
}

async function pollRoomState(time) {
  if (!sessionState.roomId || !sessionState.room || sessionState.pollingRoom) return;
  if (sessionState.room.phase !== "repair" && sessionState.room.phase !== "explosion") return;
  if (time < sessionState.nextRoomPollAt) return;

  sessionState.nextRoomPollAt = time + 1000;
  sessionState.pollingRoom = true;
  try {
    const response = await fetch(`/api/rooms/${sessionState.roomId}`, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const payload = await response.json();
      if (payload.room) {
        sessionState.room = payload.room;
        sessionState.ready = Boolean(payload.room.players?.[sessionState.user?.login]?.ready);
        syncDemoToRoomState(payload.room);
        updateRoomStatus();
        updateSessionUi();
        updateRoomSheet();
      }
    }
  } catch {
    // WebSocket remains the primary path; polling only closes timer gaps.
  } finally {
    sessionState.pollingRoom = false;
  }
}

function syncDemoToRoomState(room) {
  if (!room?.startedAt) return;
  const serverElapsed = Date.now() - room.startedAt;
  startedAt = performance.now() - serverElapsed;
  gameStarted = true;
  shell.classList.remove("is-gated");
}

function sendRoomMessage(message) {
  if (!sessionState.socket || sessionState.socket.readyState !== WebSocket.OPEN) return;
  sessionState.socket.send(JSON.stringify(message));
}

function updateRoomPosition(loop, time) {
  if (!sessionState.user || !sessionState.room || time < sessionState.nextMoveAt) return;

  const player = sessionState.room.players?.[sessionState.user.login];
  if (!player || player.spectator || sessionState.room.phase !== "repair") return;

  if (!sessionState.localPosition) {
    sessionState.localPosition = { x: player.x || 42, y: player.y || 178 };
  }
  if (!sessionState.target) {
    sessionState.target = { ...sessionState.localPosition };
  }

  const dx = sessionState.target.x - sessionState.localPosition.x;
  const dy = sessionState.target.y - sessionState.localPosition.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 0.5) {
    const step = Math.min(distance, 5.2);
    sessionState.localPosition.x += (dx / distance) * step;
    sessionState.localPosition.y += (dy / distance) * step;
  }

  sendRoomMessage({
    type: "player:move",
    x: Math.round(sessionState.localPosition.x),
    y: Math.round(sessionState.localPosition.y),
  });
  sessionState.nextMoveAt = time + 90;
}

function toggleReady() {
  const nextReady = !sessionState.ready;
  if (nextReady && sessionState.roomId) {
    sessionState.briefingDismissedFor = sessionState.roomId;
  }
  sessionState.ready = nextReady;
  sendRoomMessage({ type: "ready", ready: sessionState.ready });
  updateSessionUi();
}

function voteReplayRoom() {
  sendRoomMessage({ type: "replay" });
}

function replayOrVote() {
  if (sessionState.room) {
    voteReplayRoom();
    return;
  }
  replay();
}

function endRoomGame() {
  sendRoomMessage({ type: "end-session" });
}

async function copyRoomLink() {
  if (!sessionState.roomId) return;

  const url = buildRoomUrl(sessionState.roomId);
  try {
    await navigator.clipboard.writeText(url);
    sessionState.copiedAt = performance.now();
    updateRoomStatus("Copied link");
  } catch {
    window.prompt("Room link", url);
  }
}

function handleCanvasClick(event) {
  if (!sessionState.socket || sessionState.socket.readyState !== WebSocket.OPEN || !sessionState.room) return;
  if (getLocalPlayer()?.spectator || sessionState.room.phase !== "repair") return;

  const point = getCanvasPoint(event);
  setControlTarget(point);
}

function handleCanvasPointer(event) {
  if (!sessionState.socket || sessionState.socket.readyState !== WebSocket.OPEN || !sessionState.room) return;
  if (getLocalPlayer()?.spectator || sessionState.room.phase !== "repair") return;
  if (event.pointerType === "mouse" && event.type === "pointermove" && event.buttons === 0) return;
  event.preventDefault();
  if (event.type === "pointerdown") {
    canvas.setPointerCapture?.(event.pointerId);
  }
  setControlTarget(getCanvasPoint(event));
}

function setControlTarget(point) {
  sessionState.target = {
    x: clamp(point.x, 8, VIEW.width - 8),
    y: clamp(point.y, 22, VIEW.height - 8),
  };
}

function getCountdownSeconds() {
  return countdownSeconds(sessionState.room);
}

function getCountdownMs() {
  return countdownMs(sessionState.room);
}

function getCountdownLabel() {
  return countdownLabel(sessionState.room);
}

function getLocalPlayer() {
  return sessionState.room?.players?.[sessionState.user?.login] || null;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW.width,
    y: ((event.clientY - rect.top) / rect.height) * VIEW.height,
  };
}

function getSelectedRoomSize() {
  return Math.round(clamp(Number(roomSizeInput.value) || 2, 1, 4));
}

function drawBackground(style, time) {
  const colors = style.scene;

  ctx.fillStyle = colors.sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 16, VIEW.width, VIEW.height);

  for (let y = 16; y < VIEW.height; y += 4) {
    for (let x = 0; x < VIEW.width; x += 4) {
      const n = hash2d(x, y, activeStyle.length);
      if (n > 0.72) {
        ctx.fillStyle = n > 0.9 ? colors.groundLight : colors.groundDark;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  drawPath(colors);
  drawIsometricLines(colors);
  drawTerrainDetails(colors, time);
}

function drawPath(colors) {
  drawPixelPath(DEMO_PATH_POINTS, 24, colors.pathDark);
  drawPixelPath(DEMO_PATH_POINTS, 18, colors.path);

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#fff8c9";
  for (let i = 0; i < 28; i += 1) {
    const p = getPointOnPath(DEMO_PATH_POINTS, i / 28);
    const jitter = hash2d(i, i + 3) * 10 - 5;
    ctx.fillRect(Math.round(p.x + jitter), Math.round(p.y + 4), 5, 2);
  }
  ctx.globalAlpha = 1;
}

function drawPixelPath(points, width, color) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    drawPixelLine(start.x, start.y, end.x, end.y, width, color);
  }
}

function drawIsometricLines(colors) {
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = colors.groundLight;
  ctx.lineWidth = 1;
  for (let x = -VIEW.height; x < VIEW.width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x + VIEW.height, VIEW.height);
    ctx.stroke();
  }
  for (let x = 0; x < VIEW.width + VIEW.height; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x - VIEW.height, VIEW.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTerrainDetails(colors, time) {
  for (let i = 0; i < 70; i += 1) {
    const x = Math.round(hash2d(i, 8) * VIEW.width);
    const y = Math.round(24 + hash2d(i, 19) * (VIEW.height - 36));

    if (x > 130 && x < 340 && y > 14 && y < 178) continue;
    if (hash2d(i, 31) > 0.68) {
      drawGrass(x, y, colors);
    } else {
      drawRock(x, y, colors);
    }
  }

  drawAmbientEffects(colors, time);
}

function drawAmbientEffects(colors, time) {
  if (activeStyle === "cyberpunk") {
    drawRain(colors, time);
    drawPuddles(colors, time);
  } else if (activeStyle === "steampunk") {
    drawSteamPuffs(colors, time);
  } else {
    drawFutureMarkers(colors, time);
  }
}

function drawGrass(x, y, colors) {
  ctx.fillStyle = colors.groundDark;
  ctx.fillRect(x, y, 2, 8);
  ctx.fillRect(x + 3, y + 2, 2, 6);
  ctx.fillStyle = colors.groundLight;
  ctx.fillRect(x + 1, y + 4, 8, 2);
  ctx.fillRect(x - 3, y + 6, 6, 2);
}

function drawRock(x, y, colors) {
  ctx.fillStyle = colors.rock;
  ctx.fillRect(x, y, 6, 3);
  ctx.fillRect(x + 1, y - 2, 4, 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.fillRect(x + 1, y + 3, 6, 1);
}

function drawRain(colors, time) {
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = colors.glow;
  ctx.lineWidth = 1;
  for (let i = 0; i < 44; i += 1) {
    const x = (hash2d(i, 51) * VIEW.width + time * 0.036 + i * 7) % VIEW.width;
    const y = (hash2d(i, 93) * VIEW.height + time * 0.18) % VIEW.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPuddles(colors, time) {
  const pulse = 0.45 + Math.sin(time / 240) * 0.12;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = colors.glow;
  ctx.fillRect(30, 152, 18, 3);
  ctx.fillRect(278, 176, 22, 3);
  ctx.fillRect(96, 122, 15, 2);
  ctx.globalAlpha = 1;
}

function drawSteamPuffs(colors, time) {
  ctx.globalAlpha = 0.36;
  ctx.fillStyle = "#f3e6c8";
  for (let i = 0; i < 4; i += 1) {
    const drift = (time / 80 + i * 11) % 24;
    ctx.fillRect(274 + i * 4, 25 - drift, 8, 5);
    ctx.fillRect(280 + i * 3, 20 - drift, 6, 4);
  }
  ctx.globalAlpha = 1;
}

function drawFutureMarkers(colors, time) {
  const pulse = Math.sin(time / 210) > 0 ? 1 : 0.5;
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = colors.glow;
  ctx.lineWidth = 1;
  for (const marker of [
    { x: 60, y: 124 },
    { x: 306, y: 168 },
    { x: 116, y: 84 },
  ]) {
    ctx.strokeRect(marker.x, marker.y, 9, 5);
    ctx.fillStyle = colors.glow;
    ctx.fillRect(marker.x + 3, marker.y + 2, 3, 1);
  }
  ctx.globalAlpha = 1;
}

function px(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawPixelLine(x0, y0, x1, y1, width, color) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let err = dx + dy;
  const offset = Math.floor(width / 2);

  while (true) {
    px(x - offset, y - offset, width, width, color);
    if (x === endX && y === endY) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawPipe(points, width, fill, shadow) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    drawPixelLine(start.x, start.y, end.x, end.y, width + 2, shadow);
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    drawPixelLine(start.x, start.y, end.x, end.y, width, fill);
  }
}

function drawPixelCircle(cx, cy, radius, fill, edge) {
  if (edge) {
    drawPixelCircle(cx, cy, radius + 2, edge);
  }

  for (let y = -radius; y <= radius; y += 2) {
    const halfWidth = Math.floor(Math.sqrt(radius * radius - y * y));
    px(cx - halfWidth, cy + y, halfWidth * 2, 2, fill);
  }
}

function drawNodeSmoke(style, node, time, isNegative, isRich) {
  if (node.repaired) return;

  const seed = node.seed || node.x * 0.013 + node.y * 0.017;
  const baseAlpha = isRich ? 0.38 : 0.28;
  const smokeColor = isNegative ? "rgb(126 70 58)" : "rgb(135 126 100)";
  const glowColor = isNegative ? "#ff6b28" : style.scene.glow;
  for (let i = 0; i < 5; i += 1) {
    const cycle = (time / (980 + i * 110) + seed + i * 0.23) % 1;
    const driftX = 4 + i * 3 + Math.floor(Math.sin(time / 420 + seed * 9 + i) * 2);
    const driftY = -4 - i * 4 - Math.floor(cycle * 12);
    const puff = isRich ? 4 - (i % 2) : 3 - (i % 2);
    ctx.globalAlpha = baseAlpha * (1 - cycle) * (node.claimedBy ? 1.35 : 1);
    px(Math.round(node.x + driftX), Math.round(node.y + driftY), puff, puff, smokeColor);
    if (i < 2) {
      ctx.globalAlpha = 0.15 * (1 - cycle);
      px(Math.round(node.x + driftX - 1), Math.round(node.y + driftY + 1), 2, 2, glowColor);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlant(style, time, progress, loop) {
  drawPlantAt(style, time, progress, loop, WORLD_CENTER, PLANT_WORLD_SCALE);
}

function drawPlantAt(style, time, progress, loop, plant = WORLD_CENTER, scale = PLANT_WORLD_SCALE * 0.88) {
  drawCenteredPlant(() => drawNativePlant(style, time, progress, loop), plant, scale);
}

function drawSceneEntrance(style, progress, time) {
  const colors = style.scene;
  const open = clamp((progress - 0.79) / 0.16, 0, 1);

  if (open <= 0) return;

  const flicker = 0.45 + Math.sin(time / 95) * 0.18;
  const scan = Math.floor(time / 130) % 3;
  ctx.globalAlpha = open * flicker;
  ctx.fillStyle = colors.glow;
  ctx.fillRect(style.entrance.x - 1, style.entrance.y - 10, 2, 2);
  ctx.fillRect(style.entrance.x - 4, style.entrance.y - 6 + scan, 8, 1);
  ctx.fillRect(style.entrance.x - 2, style.entrance.y - 2, 4, 1);
  ctx.globalAlpha = open * 0.22;
  ctx.fillRect(style.entrance.x - 6, style.entrance.y - 8, 2, 2);
  ctx.fillRect(style.entrance.x + 4, style.entrance.y - 4, 2, 2);
  ctx.globalAlpha = 1;
}

function drawGroundContact(colors) {
  ctx.globalAlpha = 0.55;
  px(174, 132, 128, 5, colors.shadow);
  px(191, 141, 78, 4, colors.shadow);
  ctx.globalAlpha = 1;
}

function drawNativePlant(style, time, progress, loop = getLoopState(0)) {
  const colors = style.scene;
  const palette = plantPalettes[activeStyle];
  const elapsed = loop.elapsed;
  const damage = elapsed < REBUILD_START ? clamp((elapsed - EXPLOSION_START) / 1550, 0, 1) : 0;

  if (elapsed >= REBUILD_START && elapsed < REBUILD_END) {
    drawDestroyedPlant(style, palette, elapsed, time);
    ctx.globalAlpha = 0.18 + loop.rebuildProgress * 0.82;
    drawIntactPlantBody(style, palette, progress, time, loop.upgradeLevel);
    ctx.globalAlpha = 1;
    drawRebuildPixels(style, palette, loop.rebuildProgress, time);
    return;
  }

  if (damage >= 0.82) {
    drawDestroyedPlant(style, palette, elapsed, time);
    return;
  }

  drawIntactPlantBody(style, palette, progress, time, loop.upgradeLevel, damage);
}

function drawCenteredPlant(drawCallback, center = WORLD_CENTER, scale = PLANT_WORLD_SCALE) {
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.scale(scale, scale);
  ctx.translate(-LEGACY_PLANT_CENTER.x, -LEGACY_PLANT_CENTER.y);
  drawCallback();
  ctx.restore();
}

function drawIntactPlantBody(style, palette, progress, time, upgradeLevel, damage = 0) {
  const colors = style.scene;
  const scale = 1 + Math.min(3, upgradeLevel) * 0.045;

  ctx.save();
  ctx.translate(244, 112);
  ctx.scale(scale, scale);
  ctx.translate(-244, -112);
  if (damage > 0) {
    const shake = Math.ceil((1 - damage) * 5);
    ctx.translate((hash2d(Math.floor(time / 42), 1, activeStyle.length) - 0.5) * shake, (hash2d(2, Math.floor(time / 42), activeStyle.length) - 0.5) * shake);
  }

  drawPlantShadow(colors);
  drawPlantPad(colors, palette);
  drawPlantBackPipes(palette);
  drawPlantTowers(palette);
  drawCorePedestal(palette);
  drawCoreOrb(palette, time);
  drawPlantFrontDetails(palette, time);
  drawUpgradeArmor(palette, upgradeLevel, time);
  drawEntrance(style, palette, progress, time);

  if (damage > 0) {
    drawPlantDamageScars(style, palette, damage, time);
  }
  ctx.restore();
}

function drawUpgradeArmor(palette, upgradeLevel, time) {
  if (upgradeLevel <= 0.08) return;

  const tier = Math.ceil(upgradeLevel);
  px(158, 101, 176, 5, palette.trimDark);
  px(166, 96, 158, 4, palette.trim);
  px(184, 55, 26, 5, palette.trim);
  px(286, 54, 45, 5, palette.trim);

  if (tier >= 2) {
    px(149, 126, 190, 5, palette.bodyDark);
    px(161, 131, 168, 4, palette.trim);
    drawPipe(
      [
        { x: 165, y: 92 },
        { x: 198, y: 102 },
        { x: 228, y: 96 },
      ],
      4,
      palette.pipe,
      palette.pipeDark,
    );
  }

  if (tier >= 3) {
    const blink = Math.sin(time / 140) > 0 ? palette.coreBright : palette.core;
    px(151, 83, 16, 43, palette.bodyDark);
    px(154, 78, 10, 46, palette.body);
    px(155, 86, 6, 28, blink);
    px(337, 81, 16, 43, palette.bodyDark);
    px(340, 76, 10, 46, palette.body);
    px(341, 84, 6, 28, blink);
  }
}

function drawRebuildPixels(style, palette, progress, time) {
  const colors = [palette.body, palette.trim, palette.pipe, palette.coreBright, style.scene.glow];

  for (let i = 0; i < 34; i += 1) {
    const lift = (1 - progress) * (34 + hash2d(i, 44, activeStyle.length) * 38);
    const x = 166 + hash2d(i, 51, activeStyle.length) * 170;
    const y = 133 - lift + Math.sin(time / 170 + i) * 4;
    const size = 2 + Math.floor(hash2d(i, 57, activeStyle.length) * 4);

    ctx.globalAlpha = 0.32 + progress * 0.5;
    px(x, y, size, size, colors[i % colors.length]);
  }

  ctx.globalAlpha = 1;
}

function drawPlantShadow(colors) {
  px(plantRect.x + 12, plantRect.y + 126, plantRect.w - 12, 10, colors.shadow);
  px(plantRect.x + 36, plantRect.y + 136, plantRect.w - 62, 8, colors.shadow);
  px(plantRect.x + 62, plantRect.y + 116, 90, 8, colors.shadow);
}

function drawPlantPad(colors, palette) {
  const rows = [
    { x: 198, y: 105, w: 88, c: palette.bodyLight },
    { x: 184, y: 109, w: 118, c: palette.body },
    { x: 170, y: 113, w: 148, c: palette.body },
    { x: 160, y: 117, w: 168, c: palette.bodyDark },
    { x: 154, y: 121, w: 180, c: palette.body },
    { x: 162, y: 125, w: 164, c: palette.bodyDark },
    { x: 178, y: 129, w: 132, c: palette.trimDark },
  ];

  for (const row of rows) {
    px(row.x, row.y, row.w, 4, row.c);
  }

  px(170, 117, 28, 4, colors.groundLight);
  px(304, 122, 18, 3, colors.groundDark);
  px(184, 135, 102, 7, palette.bodyDark);
  px(190, 135, 92, 3, palette.trim);

  for (let i = 0; i < 8; i += 1) {
    px(175 - i * 3, 130 + i * 3, 50 + i * 4, 3, i % 2 === 0 ? colors.path : colors.pathDark);
  }
}

function drawPlantBackPipes(palette) {
  drawPipe(
    [
      { x: 202, y: 82 },
      { x: 224, y: 84 },
      { x: 231, y: 92 },
    ],
    4,
    palette.pipe,
    palette.pipeDark,
  );
  drawPipe(
    [
      { x: 267, y: 91 },
      { x: 302, y: 91 },
      { x: 332, y: 111 },
      { x: 344, y: 109 },
    ],
    5,
    palette.pipe,
    palette.pipeDark,
  );
  drawPipe(
    [
      { x: 226, y: 119 },
      { x: 209, y: 131 },
      { x: 201, y: 137 },
    ],
    3,
    palette.trim,
    palette.bodyDark,
  );
}

function drawPlantTowers(palette) {
  drawTower(174, 62, 36, 62, palette, "left");

  if (activeStyle === "steampunk") {
    drawBoiler(284, 60, 42, 76, palette);
    drawSmokestack(326, 46, 13, 64, palette);
    drawSmokestack(304, 50, 12, 52, palette);
  } else {
    drawTower(282, 61, 42, 72, palette, "right");
    drawTechVent(327, 83, palette);
  }
}

function drawTower(x, y, width, height, palette, side) {
  px(x - 4, y - 4, width + 8, height + 8, palette.bodyDark);
  px(x, y, width, height, palette.body);
  px(x + width - 7, y, 7, height, palette.bodyDark);
  px(x + 4, y + 5, 4, height - 12, palette.bodyLight);
  px(x - 2, y - 11, width + 4, 9, palette.trimDark);
  px(x + 1, y - 14, width - 2, 8, palette.roof);
  px(x + 5, y - 12, width - 10, 3, palette.roofLight);
  px(x + 6, y + 12, 9, 26, palette.panel);
  px(x + 20, y + 16, 7, 35, palette.panel);
  px(x + 7, y + 13, 7, 3, palette.trim);
  px(x + 21, y + 17, 5, 3, palette.trim);

  if (side === "left") {
    for (let i = 0; i < 5; i += 1) {
      px(x + 5 + i * 5, y + height + 3 + i * 3, 23, 3, i % 2 === 0 ? palette.trim : palette.bodyLight);
    }
  }
}

function drawBoiler(x, y, width, height, palette) {
  px(x + 2, y + 3, width - 4, height, palette.bodyDark);
  px(x + 6, y, width - 12, height + 6, palette.body);
  px(x + 10, y + 4, width - 22, height - 4, palette.bodyLight);
  px(x + 6, y + 11, width - 12, 5, palette.trim);
  px(x + 6, y + 36, width - 12, 5, palette.trimDark);
  px(x + 6, y + 61, width - 12, 5, palette.trim);
  px(x + 2, y - 8, width - 4, 10, palette.trimDark);
  px(x + 8, y - 12, width - 16, 7, palette.trim);
  px(x + 14, y + 27, 13, 13, palette.bodyDark);
  px(x + 17, y + 30, 7, 7, palette.coreBright);
  px(x + 18, y + 31, 5, 5, palette.coreDark);
}

function drawSmokestack(x, y, width, height, palette) {
  px(x - 2, y + 5, width + 4, height, palette.bodyDark);
  px(x, y + 5, width, height, palette.body);
  px(x + 3, y + 9, 3, height - 8, palette.bodyLight);
  px(x - 3, y, width + 6, 7, palette.trimDark);
  px(x - 1, y - 4, width + 2, 5, palette.trim);
  px(x + width - 4, y + 8, 4, height - 4, palette.bodyDark);
}

function drawTechVent(x, y, palette) {
  for (let i = 0; i < 3; i += 1) {
    px(x, y + i * 13, 28, 6, palette.bodyDark);
    px(x + 2, y + i * 13 + 1, 22, 4, palette.pipe);
    px(x + 20, y + i * 13 + 1, 8, 4, palette.trim);
  }
}

function drawCorePedestal(palette) {
  px(213, 105, 61, 31, palette.bodyDark);
  px(218, 101, 52, 30, palette.body);
  px(222, 107, 44, 5, palette.trim);
  px(224, 117, 8, 13, palette.bodyLight);
  px(254, 115, 8, 15, palette.bodyLight);
  px(210, 132, 67, 6, palette.trimDark);
  px(217, 137, 52, 5, palette.bodyDark);
}

function drawCoreOrb(palette, time) {
  const pulse = 0.55 + Math.sin(time / 240) * 0.15;

  ctx.globalAlpha = 0.28 + pulse * 0.2;
  drawPixelCircle(244, 82, 32, palette.core, palette.coreDark);
  ctx.globalAlpha = 1;

  drawPixelCircle(244, 82, 25, palette.core, palette.coreDark);
  drawPixelCircle(238, 75, 9, palette.coreBright);
  drawPixelCircle(252, 91, 8, palette.coreDark);

  ctx.globalAlpha = 0.72;
  drawPixelLine(232, 83, 244, 71, 2, palette.coreBright);
  drawPixelLine(244, 71, 257, 84, 2, palette.coreBright);
  drawPixelLine(243, 91, 253, 102, 2, palette.coreBright);
  drawPixelLine(238, 96, 230, 107, 1, palette.coreBright);
  ctx.globalAlpha = 1;
}

function drawPlantFrontDetails(palette, time) {
  drawPipe(
    [
      { x: 265, y: 121 },
      { x: 291, y: 127 },
      { x: 318, y: 121 },
    ],
    3,
    palette.pipe,
    palette.pipeDark,
  );
  drawPipe(
    [
      { x: 194, y: 116 },
      { x: 188, y: 132 },
      { x: 199, y: 139 },
    ],
    3,
    palette.pipe,
    palette.pipeDark,
  );

  for (let i = 0; i < 4; i += 1) {
    px(229 + i * 9, 142 - i, 5, 6, palette.trim);
    px(230 + i * 9, 143 - i, 3, 4, palette.core);
  }

  if (activeStyle === "cyberpunk") {
    const blink = Math.sin(time / 120) > 0 ? palette.roofLight : palette.trim;
    px(184, 70, 5, 42, blink);
    px(294, 78, 5, 42, palette.trim);
    px(204, 126, 34, 3, palette.roof);
  }

  if (activeStyle === "futuristic") {
    px(174, 83, 34, 4, palette.trim);
    px(288, 74, 28, 4, palette.trim);
    px(303, 101, 20, 3, palette.coreBright);
  }
}

function drawPlantDamageScars(style, palette, damage, time) {
  const ember = Math.sin(time / 80) > 0 ? "#ff6b28" : "#fff6cf";
  ctx.globalAlpha = 0.55 + damage * 0.25;
  drawPixelLine(206, 51, 229, 81, 3, "#180e0a");
  drawPixelLine(282, 66, 253, 98, 3, "#180e0a");
  drawPixelLine(316, 73, 292, 116, 3, "#180e0a");
  ctx.globalAlpha = 1;

  for (let i = 0; i < 10; i += 1) {
    const x = 176 + Math.floor(hash2d(i, 11, activeStyle.length) * 150);
    const y = 65 + Math.floor(hash2d(i, 17, activeStyle.length) * 72);
    px(x, y, 2 + (i % 2), 2, i % 3 === 0 ? ember : palette.bodyDark);
  }
}

function drawDestroyedPlant(style, palette, elapsed, time) {
  const colors = style.scene;
  const ruinAge = clamp((elapsed - EXPLOSION_START - 1200) / 3800, 0, 1);

  drawPlantShadow(colors);
  drawDestroyedPad(colors, palette);
  drawCollapsedStructure(palette, time);
  drawDebrisField(style, palette, elapsed);
  drawRuinSmoke(style, ruinAge, time);
}

function drawDestroyedPad(colors, palette) {
  px(154, 123, 178, 7, palette.bodyDark);
  px(168, 117, 135, 5, palette.body);
  px(188, 111, 87, 5, palette.bodyDark);
  px(177, 132, 130, 5, palette.trimDark);

  for (let i = 0; i < 7; i += 1) {
    const x = 165 + i * 23;
    drawPixelLine(x, 112 + (i % 3) * 5, x + 16, 134 - (i % 2) * 4, 2, "#120c09");
  }

  px(186, 139, 98, 4, colors.pathDark);
  px(194, 139, 84, 2, colors.path);
}

function drawCollapsedStructure(palette, time) {
  drawPipe(
    [
      { x: 180, y: 78 },
      { x: 213, y: 101 },
      { x: 246, y: 127 },
    ],
    5,
    palette.pipe,
    palette.pipeDark,
  );
  drawPipe(
    [
      { x: 314, y: 66 },
      { x: 298, y: 98 },
      { x: 269, y: 130 },
    ],
    5,
    palette.pipe,
    palette.pipeDark,
  );

  px(171, 84, 34, 13, palette.bodyDark);
  px(176, 78, 28, 9, palette.body);
  px(181, 75, 21, 4, palette.roof);
  px(289, 90, 41, 18, palette.bodyDark);
  px(294, 85, 33, 9, palette.body);
  px(301, 80, 21, 5, palette.trim);

  const flicker = Math.sin(time / 75) > 0;
  px(222, 100, 34, 18, flicker ? "#ff6b28" : palette.core);
  px(230, 94, 19, 11, flicker ? "#fff6cf" : palette.coreBright);
  px(236, 115, 9, 14, palette.coreDark);
}

function drawDebrisField(style, palette, elapsed) {
  const colors = [palette.bodyDark, palette.body, palette.trimDark, palette.pipe, style.scene.rock, "#2b1a11"];
  const spread = clamp((elapsed - EXPLOSION_START) / 1800, 0, 1);

  for (let i = 0; i < 70; i += 1) {
    const angle = hash2d(i, 23, activeStyle.length) * Math.PI * 2;
    const distance = (20 + hash2d(i, 29, activeStyle.length) * 88) * spread;
    const x = 240 + Math.cos(angle) * distance;
    const y = 108 + Math.sin(angle) * distance * 0.55 + hash2d(i, 31, activeStyle.length) * 18;
    const w = 2 + Math.floor(hash2d(i, 37, activeStyle.length) * 6);
    const h = 2 + Math.floor(hash2d(i, 41, activeStyle.length) * 4);
    px(x, y, w, h, colors[i % colors.length]);
  }
}

function drawRuinSmoke(style, ruinAge, time) {
  ctx.globalAlpha = 0.46 * (1 - ruinAge * 0.35);
  for (let i = 0; i < 16; i += 1) {
    const x = 186 + i * 8 + Math.sin(time / 260 + i) * 5;
    const y = 78 - ruinAge * 34 - hash2d(i, 47, activeStyle.length) * 18;
    px(x, y, 12 + (i % 3) * 3, 6 + (i % 2) * 3, "rgb(36 35 31)");
  }
  ctx.globalAlpha = 1;
}

function drawEntrance(style, palette, progress, time) {
  const colors = style.scene;
  const open = clamp((progress - 0.79) / 0.16, 0, 1);
  const flicker = 0.65 + Math.sin(time / 95) * 0.25;
  const x = style.entrance.x;
  const y = style.entrance.y;

  px(x - 10, y - 13, 22, 18, palette.bodyDark);
  px(x - 8, y - 11, 18, 16, palette.trimDark);
  px(x - 5, y - 8, 12, 13, palette.door);

  ctx.globalAlpha = 0.22 + open * flicker;
  px(x - 4, y - 7, 10, 11, colors.glow);
  px(x - 1, y - 11, 4, 4, colors.glow);
  ctx.globalAlpha = 1;

  px(x - 13, y + 5, 28, 3, colors.pathDark);
  px(x - 9, y + 8, 22, 2, colors.path);
}

function drawSquad(style, loop, time, room) {
  const actors = squad
    .map((member, index) => getDemoActorState(member, index, loop, time))
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);

  for (const actor of actors) {
    drawPixelSoldierSprite(style, actor, time);
    drawDemoAbilityTag(style, actor, room);
  }
}

function drawAbilityIcon(ability, x, y, size = 9) {
  const color = ability?.color || "#f1e8cf";
  const accent = ability?.accent || "#f1e8cf";
  px(x - 1, y - 1, size + 2, size + 2, "rgba(0, 0, 0, 0.72)");
  px(x, y, size, size, color);

  if (ability?.id === "boost") {
    px(x + 2, y + 1, Math.max(2, size - 5), size - 3, "#18314d");
    px(x + 1, y + size - 3, size - 2, 2, accent);
    px(x + size - 3, y + 2, 2, 2, accent);
    return;
  }
  if (ability?.id === "magnet") {
    px(x + 2, y + 2, 2, size - 3, "#153119");
    px(x + size - 4, y + 2, 2, size - 3, "#153119");
    px(x + 4, y + size - 4, size - 8, 2, "#153119");
    px(x + 2, y + 1, 2, 2, accent);
    px(x + size - 4, y + 1, 2, 2, accent);
    return;
  }
  if (ability?.id === "stasis") {
    const mid = Math.floor(size / 2);
    px(x + mid, y + 1, 1, size - 2, "#142a36");
    px(x + 1, y + mid, size - 2, 1, "#142a36");
    px(x + 3, y + 3, size - 6, size - 6, accent);
    return;
  }
  if (ability?.id === "warp") {
    const mid = Math.floor(size / 2);
    px(x + mid - 2, y + 1, 4, size - 2, "#5f4728");
    px(x + 1, y + mid - 2, size - 2, 4, "#5f4728");
    px(x + 3, y + 3, size - 6, size - 6, accent);
    px(x + mid - 1, y + mid - 1, 2, 2, color);
    return;
  }
  if (ability?.id === "greed") {
    const mid = Math.floor(size / 2);
    px(x + mid - 1, y + 1, 3, 2, accent);
    px(x + 2, y + 3, size - 4, size - 6, "#6a250e");
    px(x + mid - 1, y + size - 3, 3, 2, accent);
  }
}

function drawDemoAbilityTag(style, actor, room) {
  if (!actor.ability) return;
  const x = Math.round(actor.x);
  const y = Math.round(actor.y);
  const label = actor.ability.label;
  const claimNode = room?.nodes?.find((node) => node.claimedBy === actor.member.id && !node.repaired && node.claimEndsAt);
  const claimLabel = claimNode ? `CLAIM ${formatHoldLabel(claimNode.claimEndsAt - Date.now())}` : "";
  const hasCooldown = Number.isFinite(actor.skillCooldown);
  const width = Math.min(82, Math.max(label.length * 6 + 18, claimLabel.length * 5 + 8, hasCooldown ? 56 : 0));
  const height = (claimLabel ? 22 : 13) + (hasCooldown ? 6 : 0);
  const left = x - Math.floor(width / 2);
  const top = y - 36 - (claimLabel ? 8 : 0) - (hasCooldown ? 4 : 0);
  px(left, top, width, height, "rgba(0, 0, 0, 0.84)");
  px(left, top, width, 2, actor.ability.color);
  drawAbilityIcon(actor.ability, left + 3, top + 3, 8);
  ctx.fillStyle = style.css.text;
  ctx.font = "7px monospace";
  ctx.fillText(label, left + 15, top + 11);
  if (hasCooldown) {
    const barWidth = width - 8;
    const barY = top + 15;
    px(left + 4, barY, barWidth, 3, "rgba(241, 232, 207, 0.22)");
    px(left + 4, barY, Math.max(1, Math.round(barWidth * actor.skillCooldown)), 3, actor.ability.color);
    px(left + 4 + Math.round(barWidth * actor.skillCooldown), barY - 1, 2, 5, style.css.text);
  }
  if (claimLabel) {
    const progress = clamp((claimNode.claimEndsAt - Date.now()) / (claimNode.claimDurationMs || claimNode.holdMs), 0, 1);
    const claimY = top + (hasCooldown ? 21 : 4);
    px(left + 3, claimY, Math.max(3, Math.round((width - 6) * (1 - progress))), 2, actor.ability.color);
    ctx.fillStyle = style.css.text;
    ctx.font = "6px monospace";
    ctx.fillText(claimLabel, left + 4, claimY + 8);
  }
}

function drawRoomPlayers(style) {
  if (!sessionState.room?.players || !sessionState.user) return;

  const players = Object.values(sessionState.room.players).sort((a, b) => (a.y || 0) - (b.y || 0));
  for (const player of players) {
    const isLocal = player.id === sessionState.user.login;
    const isBot = Boolean(player.bot);
    const x = Math.round(player.x || 0);
    const y = Math.round(player.y || 0);
    if (x <= 0 || y <= 0) continue;

    px(x - 3, y - 7, 6, 5, style.scene.shadow);
    px(x - 2, y - 10, 4, 4, player.spectator ? style.scene.rock : isBot ? "#ff6b28" : isLocal ? style.css.text : style.scene.glow);
    px(x - 1, y - 9, 2, 2, player.spectator ? style.scene.groundDark : isBot ? style.css.accent2 : isLocal ? style.scene.glow : style.scene.accent);
    px(x - 3, y - 4, 6, 2, player.spectator ? style.scene.rock : isBot ? "#6a2b16" : isLocal ? style.scene.accent : style.scene.soldier.armor);
    const label = isBot ? "BOT" : player.id.slice(0, 8);
    px(x - 9, y - 21, Math.min(48, label.length * 5 + 6), 8, "rgba(0, 0, 0, 0.78)");
    px(x - 9, y - 21, Math.min(48, label.length * 5 + 6), 1, isLocal ? style.scene.glow : style.scene.accent);
    ctx.fillStyle = style.css.text;
    ctx.font = "7px monospace";
    ctx.fillText(label, x - 7, y - 15);

    if (isLocal && !player.spectator) {
      drawPlayerArrow(style, x, y, player.ready);
    }
  }
}

function drawPlayerArrow(style, x, y, ready) {
  const time = performance.now();
  const bob = Math.floor(Math.sin(time / 180) * 2);
  const arrowY = y - 32 + bob;
  const color = ready ? style.scene.glow : style.scene.accent;
  const blink = 0.58 + 0.34 * (0.5 + Math.sin(time / 520) * 0.5);
  ctx.globalAlpha = blink * 0.36;
  px(x - 6, arrowY - 2, 12, 14, "rgba(0, 0, 0, 0.76)");
  ctx.globalAlpha = blink;
  px(x - 2, arrowY, 4, 7, color);
  px(x - 6, arrowY + 5, 12, 3, color);
  px(x - 4, arrowY + 8, 8, 3, color);
  px(x - 2, arrowY + 11, 4, 3, color);
  ctx.globalAlpha = 1;
}

function drawRoomObjectives(style, time, room = sessionState.room) {
  if (!room) return;

  const blasts = room.blasts?.length ? room.blasts : room.blast ? [room.blast] : [];
  if ((room.phase === "repair" || room.phase === "explosion") && blasts.length) {
    ctx.globalAlpha = room.phase === "explosion" ? 0.24 : 0.12;
    for (const blast of blasts) {
      drawPixelCircle(blast.x, blast.y, blast.radius, style.scene.accent, style.scene.glow);
    }
    ctx.globalAlpha = 1;
  }

  if (room.phase === "repair") {
    for (const node of room.nodes || []) {
      if (node.repaired) continue;
      const isNegative = node.value < 0;
      const magnitude = Math.abs(node.value);
      const isRich = magnitude >= 7 || node.bonus;
      const isClaimed = Boolean(node.claimedBy);
      const pulse = Math.floor(Math.sin(time / (isRich ? 96 : 130) + node.x) * 1);
      const color = isNegative ? "#ff4f36" : "#57d56c";
      const edge = isClaimed ? style.css.text : isNegative ? "#5b1711" : "#153119";
      const size = node.size || (isRich ? 10 : 8);
      const half = Math.floor(size / 2);
      const spawnAge = room.phaseStartedAt && node.spawnedAt !== undefined ? Date.now() - (room.phaseStartedAt + node.spawnedAt) : 1000;
      if (spawnAge < 0) continue;
      if (spawnAge >= 0 && spawnAge < 900) {
        ctx.globalAlpha = 0.28 * (1 - spawnAge / 900);
        drawPixelCircle(node.x, node.y, 18 + Math.floor(spawnAge / 90), isNegative ? "#ff6b28" : style.scene.glow);
      }
      if (isClaimed && !node.repaired) {
        const ring = half + 8 + Math.floor(Math.sin(time / 90 + node.x) * 2);
        ctx.globalAlpha = 0.32;
        drawPixelCircle(node.x, node.y, ring, style.css.text, isNegative ? "#ff6b28" : style.scene.glow);
        ctx.globalAlpha = 0.86;
        px(node.x - half - 4, node.y - half - 4, 3, 3, style.css.text);
        px(node.x + half + 1, node.y - half - 4, 3, 3, style.css.text);
        px(node.x - half - 4, node.y + half + 1, 3, 3, style.css.text);
        px(node.x + half + 1, node.y + half + 1, 3, 3, style.css.text);
        drawClaimOwnerLock(style, room, node, time, isNegative);
      }
      drawNodeSmoke(style, node, time, isNegative, isRich);
      ctx.globalAlpha = 0.92;
      px(node.x - half - 1, node.y - half - 1, size + 2, size + 2, edge);
      px(node.x - half, node.y - half, size, size, color);
      px(node.x - half + 2, node.y - half + 2, Math.max(2, size - 4), Math.max(2, size - 4), isNegative ? "#3a1512" : "#153119");
      px(node.x - 1 + pulse, node.y - 1, 2, 2, style.css.text);
      if (node.bonus && !node.repaired) {
        px(node.x - 1, node.y - half - 5, 2, 3, style.css.text);
        px(node.x - 1, node.y + half + 2, 2, 3, style.css.text);
        px(node.x - half - 5, node.y - 1, 3, 2, style.css.text);
        px(node.x + half + 2, node.y - 1, 3, 2, style.css.text);
      }
      ctx.fillStyle = style.css.text;
      ctx.font = "8px monospace";
      const label = `${node.value > 0 ? "+" : ""}${formatNodeValue(node.value)}`;
      const labelWidth = Math.max(30, label.length * 5 + 6);
      px(node.x - Math.floor(labelWidth / 2), node.y - 23, labelWidth, 11, "rgba(0, 0, 0, 0.78)");
      px(node.x - Math.floor(labelWidth / 2), node.y - 23, labelWidth, 1, isNegative ? "#ff6b28" : style.scene.glow);
      ctx.fillText(label, node.x - Math.floor(labelWidth / 2) + 3, node.y - 15);
      ctx.globalAlpha = 1;
    }
  }

}

function drawSkillDebugAreas(style, room = sessionState.room) {
  if (!showSkillConfig || !room?.players) return;
  for (const player of Object.values(room.players)) {
    const abilityId = player.ability?.id;
    if (!abilityId || player.state === PLAYER_STATES.incapacitated) continue;
    const x = Math.round(player.x || 0);
    const y = Math.round(player.y || 0);
    const debug = skillDebugArea(abilityId);
    if (!debug) continue;
    ctx.globalAlpha = 0.1;
    drawPixelCircle(x, y, debug.radius, debug.fill, debug.edge);
    ctx.globalAlpha = 0.36;
    drawPixelCircle(x, y, Math.max(6, Math.round(debug.radius / 4)), debug.fill);
    ctx.globalAlpha = 0.92;
    const label = `${debug.label} R${debug.radius}`;
    const width = Math.max(42, label.length * 5 + 8);
    const labelX = Math.round(clamp(x - width / 2, 4, VIEW.width - width - 4));
    const labelY = Math.round(clamp(y - debug.radius - 12, 6, VIEW.height - 12));
    px(labelX, labelY, width, 10, "rgba(0, 0, 0, 0.76)");
    px(labelX, labelY, width, 2, debug.edge);
    ctx.fillStyle = style.css.text;
    ctx.font = "6px monospace";
    ctx.fillText(label, labelX + 4, labelY + 8);
    ctx.globalAlpha = 1;
  }
}

function skillDebugArea(abilityId) {
  if (abilityId === SKILL_IDS.magnet) {
    return { label: "MAG", radius: SKILL_CONFIG.magnet.claimRadius, fill: "rgba(87, 213, 108, 0.72)", edge: "#57d56c" };
  }
  if (abilityId === SKILL_IDS.stasis) {
    return { label: "STASIS", radius: SKILL_CONFIG.stasis.radius, fill: "rgba(159, 223, 255, 0.72)", edge: "#9fdfff" };
  }
  if (abilityId === SKILL_IDS.warp) {
    return { label: "WARP", radius: SKILL_CONFIG.warp.teleportRange, fill: "rgba(213, 152, 59, 0.72)", edge: "#d5983b" };
  }
  return null;
}

function drawClaimTimers(style, room = sessionState.room) {
  if (!room || room.phase !== "repair") return;

  for (const node of room.nodes || []) {
    if (!node.claimedBy || node.repaired || !node.claimEndsAt) continue;
    const player = room.players?.[node.claimedBy];
    if (!player) continue;
    const remainingMs = node.claimEndsAt - Date.now();
    const x = Math.round(player.x || node.x);
    const y = Math.round(player.y || node.y) - 20;
    const label = formatHoldLabel(remainingMs);
    const width = 34;
    px(x - Math.floor(width / 2), y - 10, width, 13, "rgba(0, 0, 0, 0.8)");
    px(x - Math.floor(width / 2), y - 10, Math.round(width * Math.max(0, remainingMs / (node.claimDurationMs || node.holdMs))), 3, style.scene.accent);
    ctx.fillStyle = style.css.text;
    ctx.font = "8px monospace";
    ctx.fillText(label, x - 12, y);
  }
}

function drawClaimOwnerLock(style, room, node, time, isNegative) {
  const player = room.players?.[node.claimedBy];
  const lockColor = isNegative ? "#ff6b28" : style.scene.glow;
  if (Number.isFinite(player?.x) && Number.isFinite(player?.y)) {
    ctx.globalAlpha = 0.28 + Math.sin(time / 160) * 0.06;
    drawPixelLine(node.x, node.y, player.x, player.y - 12, 2, lockColor);
    ctx.globalAlpha = 0.72;
    px(player.x - 4, player.y - 29, 8, 2, lockColor);
    px(player.x - 6, player.y - 27, 12, 2, style.css.text);
  }

  const owner = String(node.claimedBy || "").slice(0, 6).toUpperCase();
  const width = Math.max(28, owner.length * 5 + 8);
  const x = Math.round(node.x - width / 2);
  const y = Math.round(node.y + (node.size || 8) + 8);
  ctx.globalAlpha = 0.9;
  px(x, y, width, 11, "rgba(0, 0, 0, 0.82)");
  px(x, y, width, 2, lockColor);
  px(x + 3, y + 4, 4, 4, lockColor);
  ctx.fillStyle = style.css.text;
  ctx.font = "6px monospace";
  ctx.fillText(owner || "LOCK", x + 9, y + 9);
  ctx.globalAlpha = 1;
}

function drawBuildingCountdown(style, time, room = sessionState.room) {
  if (!room || room.phase !== "repair") return;

  const seconds = countdownMs(room) / 1000;
  const blink = seconds <= 7.5 ? Math.sin(time / 90) > -0.25 : Math.sin(time / 280) > -0.7;

  const label = countdownLabel(room).padStart(5, "0");
  const plants = room.plants?.length ? room.plants : [{ x: 365, y: 192 }];
  const anchor =
    plants.length > 1
      ? {
          x: plants.reduce((sum, plant) => sum + plant.x, 0) / plants.length - 42,
          y: Math.min(...plants.map((plant) => plant.y)) - 58,
        }
      : { x: plants[0].x - 20, y: plants[0].y - 24 };
  const x = Math.round(clamp(anchor.x, 24, VIEW.width - 96));
  const y = Math.round(clamp(anchor.y, 38, VIEW.height - 54));
  ctx.globalAlpha = blink ? 1 : 0.46;
  px(x - 18, y - 21, 96, 31, "rgba(0, 0, 0, 0.72)");
  px(x - 18, y - 21, 96, 3, style.scene.accent);
  ctx.fillStyle = seconds <= 7.5 ? "#ff6b28" : style.css.text;
  ctx.font = "24px monospace";
  ctx.fillText(label, x, y);
  if (plants.length > 1) {
    ctx.font = "6px monospace";
    ctx.fillStyle = style.css.muted;
    ctx.fillText("SYNC GRID", x - 12, y - 25);
  }
  if (room.nodeTimerDeltaMs !== undefined) {
    const deltaSeconds = room.nodeTimerDeltaMs / 1000;
    const deltaLabel = `${deltaSeconds >= 0 ? "+" : ""}${deltaSeconds.toFixed(1)}s nodes`;
    const repairedLabel = room.repairedNodeCount ? `${room.repairedNodeCount} captured` : "claiming";
    ctx.font = "7px monospace";
    ctx.fillStyle = deltaSeconds < 0 ? "#ff6b28" : style.scene.glow;
    ctx.fillText(deltaLabel, x - 8, y + 13);
    ctx.fillStyle = style.css.text;
    ctx.fillText(repairedLabel, x - 8, y + 22);
  }
  ctx.globalAlpha = 1;
}

function drawPlantClaimFeed(style, room = sessionState.room, loop = null) {
  if (!room?.plants?.length) return;
  const eventsByPlant = new Map(room.plants.map((plant) => [plant.id, []]));
  const now = Date.now();
  const repairElapsed = loop ? getDemoRepairElapsed(loop) : null;
  for (const node of room.nodes || []) {
    if (!node.repaired) continue;
    const age = Number.isFinite(node.repairedAtElapsed) ? repairElapsed - node.repairedAtElapsed : now - (node.repairedAt || 0);
    if (age < 0 || age > PLANT_FLOATING_TEXT_MS) continue;
    const plant = nearestPlantForPoint(node, room.plants);
    if (!plant) continue;
    const abilityId = getNodeOwnerAbilityId(room, node, loop);
    const effectiveValue = getEffectiveNodeValue(node, abilityId);
    eventsByPlant.get(plant.id)?.push({ node, age, effectiveValue });
  }

  for (const plant of room.plants) {
    const events = (eventsByPlant.get(plant.id) || [])
      .sort((a, b) => a.age - b.age)
      .slice(0, PLANT_FLOATING_TEXT_MAX)
      .slice(0, PLANT_FLOATING_TEXT_VISIBLE);
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      const stackIndex = events.length - 1 - i;
      const displayAge = Math.max(0, event.age - stackIndex * 80);
      const fade = 1 - displayAge / PLANT_FLOATING_TEXT_MS;
      const label = `${event.effectiveValue >= 0 ? "+" : ""}${formatNodeValue(event.effectiveValue)}`;
      const width = Math.max(34, label.length * 6 + 8);
      const x = Math.round(clamp(plant.x - width / 2, 6, VIEW.width - width - 6));
      const y = Math.round(clamp(plant.y - plant.blast.radius - 16 - stackIndex * 11 - (1 - fade) * 5, 8, VIEW.height - 18));
      ctx.globalAlpha = clamp(fade, 0, 1);
      px(x, y, width, 9, "rgba(0, 0, 0, 0.78)");
      px(x, y, width, 2, event.effectiveValue < 0 ? "#ff6b28" : style.scene.glow);
      ctx.fillStyle = event.effectiveValue < 0 ? "#ffb6a6" : "#dff7b8";
      ctx.font = "7px monospace";
      ctx.fillText(label, x + 4, y + 7);
    }
  }
  ctx.globalAlpha = 1;
}

function nearestPlantForPoint(point, plants = []) {
  return plants
    .map((plant) => ({ plant, distance: Math.hypot(point.x - plant.x, point.y - plant.y) }))
    .sort((a, b) => a.distance - b.distance)[0]?.plant || null;
}

function getNodeOwnerAbilityId(room, node, loop = null) {
  const ownerId = node.repairedBy;
  if (!ownerId) return null;
  if (loop) {
    const member = squad.find((candidate) => candidate.id === ownerId);
    return member ? getDemoAbility(member, loop.cycle).id : null;
  }
  return room.players?.[ownerId]?.ability?.id || null;
}

function drawRoomHud(style) {
  const room = sessionState.room;
  if (!room) return;
  if (room.phase === "end") return;

  const local = room.players?.[sessionState.user?.login];
  px(8, 8, 128, 34, "rgba(0, 0, 0, 0.58)");
  ctx.fillStyle = style.css.text;
  ctx.font = "7px monospace";
  const totalLabel = local?.spectator ? "WATCH" : formatScore(local?.score);
  const roundLabel = local?.spectator ? "--" : formatScore(local?.roundScore);
  ctx.fillText(`TIME ${getCountdownLabel()}s`, 14, 18);
  ctx.fillText(`ROUND ${roundLabel}`, 14, 28);
  ctx.fillText(`TOTAL ${totalLabel}`, 14, 38);
}

function drawDemoHud(style, room, loop) {
  if (!room || room.phase !== "repair") return;
  const panelY = 8;
  const skillsX = 8;
  const skillsWidth = showSkillConfig ? 246 : 188;
  const runnersX = skillsX + skillsWidth + 8;
  const runnersWidth = 318;
  const panelHeight = 104;
  px(skillsX, panelY, skillsWidth, panelHeight, "rgba(0, 0, 0, 0.68)");
  px(skillsX, panelY, skillsWidth, 3, style.scene.accent);
  px(runnersX, panelY, runnersWidth, panelHeight, "rgba(0, 0, 0, 0.68)");
  px(runnersX, panelY, runnersWidth, 3, style.scene.accent);
  ctx.fillStyle = style.css.text;
  ctx.font = "8px monospace";
  ctx.fillText(`TIMER ${getDemoCountdownLabel(loop)}s`, skillsX + 8, panelY + 15);

  ctx.font = "6px monospace";
  ctx.fillStyle = style.css.muted;
  ctx.fillText("SKILL LEGENDS", skillsX + 8, panelY + 28);
  for (let i = 0; i < demoAbilities.length; i += 1) {
    const ability = demoAbilities[i];
    const y = panelY + 41 + i * 11;
    drawAbilityIcon(ability, skillsX + 9, y - 7, 7);
    ctx.fillStyle = style.css.text;
    ctx.fillText(ability.label.toUpperCase().padEnd(7, " "), skillsX + 21, y);
    ctx.fillStyle = style.css.muted;
    ctx.fillText(showSkillConfig ? skillConfigLabel(ability.id) : ability.hint, skillsX + 70, y);
  }

  const leaderboardRows = buildLeaderboardRows(
    squad.map((member, index) => {
      const ability = getDemoAbility(member, loop.cycle);
      const previousScore = getDemoPreviousScore(member, index, loop.cycle);
      const roundScore = getDemoRoundScore(member, index, loop);
      return {
        id: member.id,
        ability,
        previousScore,
        roundScore,
        score: previousScore + roundScore,
      };
    }),
  );

  ctx.fillStyle = style.css.muted;
  ctx.fillText("[SKILL] PLAYER       TOTAL     PREV+ROUND", runnersX + 10, panelY + 28);
  for (let i = 0; i < leaderboardRows.length; i += 1) {
    const row = leaderboardRows[i];
    const y = panelY + 41 + i * 8;
    const roundPrefix = row.roundScore >= 0 ? "+" : "";
    drawAbilityIcon(row.ability, runnersX + 11, y - 7, 7);
    ctx.fillStyle = style.css.text;
    ctx.fillText(row.id.slice(0, 8).toUpperCase().padEnd(8, " "), runnersX + 24, y);
    ctx.fillStyle = row.roundScore >= 0 ? "#dff7b8" : "#ffb6a6";
    ctx.fillText(formatScore(row.score).padStart(7, " "), runnersX + 88, y);
    ctx.fillStyle = style.css.muted;
    ctx.fillText(`${formatScore(row.previousScore)}+${roundPrefix}${formatScore(row.roundScore)}`, runnersX + 136, y);
  }
}

function skillConfigLabel(skillId) {
  if (skillId === SKILL_IDS.boost) return `x${SKILL_CONFIG.boost.speedMultiplier} ${SKILL_CONFIG.boost.activeMs / 1000}s/${SKILL_CONFIG.boost.cooldownMs / 1000}s`;
  if (skillId === SKILL_IDS.magnet) return `r${SKILL_CONFIG.magnet.claimRadius} capx${SKILL_CONFIG.magnet.captureMultiplier} scorex${SKILL_CONFIG.magnet.scoreMultiplier}`;
  if (skillId === SKILL_IDS.stasis) return `r${SKILL_CONFIG.stasis.radius} ${SKILL_CONFIG.stasis.freezeMs / 1000}s/${SKILL_CONFIG.stasis.cooldownMs / 1000}s`;
  if (skillId === SKILL_IDS.warp) return `r${SKILL_CONFIG.warp.teleportRange} ${SKILL_CONFIG.warp.activeMs}ms/${SKILL_CONFIG.warp.cooldownMs}ms`;
  if (skillId === SKILL_IDS.greed) return `low x${SKILL_CONFIG.greed.lowValueScoreMultiplier} fast hi x${SKILL_CONFIG.greed.highValueScoreMultiplier}`;
  return "";
}

function drawDemoSkillLog(style, room) {
  const stats = Object.values(room?.skillStats || {});
  if (stats.length === 0) return;
  const x = 548;
  const y = 286;
  px(x, y, 174, 82, "rgba(0, 0, 0, 0.66)");
  px(x, y, 174, 3, style.scene.accent);
  ctx.fillStyle = style.css.text;
  ctx.font = "8px monospace";
  ctx.fillText("DEMO SKILL LOG", x + 16, y + 18);
  ctx.font = "6px monospace";
  for (let i = 0; i < stats.length; i += 1) {
    const stat = stats[i];
    const rowY = y + 32 + i * 9;
    ctx.fillStyle = stat.count > 0 ? style.css.text : style.css.muted;
    ctx.fillText(`${stat.label.padEnd(6, " ")} ${String(stat.count).padStart(2, " ")} ${stat.detail}`, x + 12, rowY);
  }
}

function drawDemoBlastReport(style, room, loop) {
  if (!room || loop.elapsed < DEMO_SUMMARY_START || loop.elapsed >= DEMO_VORTEX_START) return;
  const rows = buildLeaderboardRows(room.summary || []).slice(0, 5);
  const panelX = 532;
  const panelY = 20;
  const panelWidth = 220;
  const caught = (room.summary || []).filter((row) => row.state === "incapacitated").length;
  px(panelX, panelY, panelWidth, 92, "rgba(0, 0, 0, 0.72)");
  px(panelX, panelY, panelWidth, 3, style.scene.accent);
  ctx.fillStyle = style.css.text;
  ctx.font = "8px monospace";
  ctx.fillText("DEMO BLAST REPORT", panelX + 16, panelY + 17);
  ctx.fillStyle = style.css.muted;
  ctx.font = "6px monospace";
  ctx.fillText(`${caught} caught  ${rows.length} ranked`, panelX + 16, panelY + 29);
  ctx.fillText("PLAYER       TOTAL   ROUND", panelX + 12, panelY + 42);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const y = panelY + 54 + i * 8;
    if (row.ability) drawAbilityIcon(row.ability, panelX + 12, y - 7, 6);
    ctx.fillStyle = row.state === "incapacitated" ? "#ffb6a6" : style.css.text;
    ctx.fillText(row.id.slice(0, 8).padEnd(8, " "), panelX + 22, y);
    ctx.fillStyle = style.css.text;
    ctx.fillText(formatScore(row.score).padStart(6, " "), panelX + 108, y);
    ctx.fillStyle = row.roundScore > 0 ? "#dff7b8" : style.css.muted;
    ctx.fillText(formatScore(row.roundScore).padStart(6, " "), panelX + 158, y);
  }
}

function drawRoundSummary(style, summary, options = {}) {
  const panelX = options.x ?? 118;
  const panelY = options.y ?? 54;
  const panelWidth = options.width ?? 238;
  const title = options.title ?? "ROUND SUMMARY";
  const visibleRows = buildLeaderboardRows(summary).slice(0, 8);
  const panelHeight = Math.max(70, 42 + visibleRows.length * 12);
  px(panelX, panelY, panelWidth, panelHeight, "rgba(0, 0, 0, 0.72)");
  px(panelX, panelY, panelWidth, 3, style.scene.accent);
  ctx.fillStyle = style.css.text;
  ctx.font = "8px monospace";
  ctx.fillText(title, panelX + 18, panelY + 18);
  ctx.font = "6px monospace";
  ctx.fillStyle = style.css.muted;
  ctx.fillText("PLAYER       TOTAL    PREV + ROUND", panelX + 12, panelY + 31);
  ctx.font = "7px monospace";
  for (let i = 0; i < visibleRows.length; i += 1) {
    const row = visibleRows[i];
    const state = row.state === "incapacitated" ? "DOWN" : "OK";
    const roundPrefix = row.roundScore >= 0 ? "+" : "";
    const textX = row.ability ? panelX + 24 : panelX + 12;
    if (row.ability) {
      drawAbilityIcon(row.ability, panelX + 12, panelY + 34 + i * 12, 7);
    }
    ctx.fillStyle = style.css.text;
    ctx.fillText(row.id.slice(0, 8).padEnd(8, " "), textX, panelY + 42 + i * 12);
    ctx.fillStyle = "#dff7b8";
    ctx.fillText(formatScore(row.score).padStart(6, " "), panelX + panelWidth - 104, panelY + 42 + i * 12);
    ctx.fillStyle = style.css.muted;
    ctx.fillText(
      `${formatScore(row.previousScore)}+${roundPrefix}${formatScore(row.roundScore)} ${state}`,
      panelX + panelWidth - 66,
      panelY + 42 + i * 12,
    );
  }
}

function drawFinalScoreScene(style) {
  const room = sessionState.room;
  const summary = room?.summary || [];
  px(0, 0, VIEW.width, VIEW.height, style.scene.groundDark);
  for (let y = 0; y < VIEW.height; y += 12) {
    for (let x = 0; x < VIEW.width; x += 12) {
      if (hash2d(x, y, 9) > 0.72) {
        px(x, y, 6, 6, style.scene.ground);
      }
    }
  }

  ctx.fillStyle = style.css.text;
  ctx.font = "13px monospace";
  ctx.fillText("FINAL SCORES", 139, 42);
  drawRoundSummary(style, summary, {
    x: 92,
    y: 62,
    width: 238,
    title: "ROUND / TOTAL",
  });

  const players = Object.values(room?.players || {}).filter((player) => !player.spectator);
  const votes = room?.replayVotes || {};
  px(112, 158, 160, 42, "rgba(0, 0, 0, 0.62)");
  ctx.fillStyle = style.css.text;
  ctx.font = "7px monospace";
  ctx.fillText("REPLAY VOTES", 150, 171);
  for (let i = 0; i < players.length; i += 1) {
    const player = players[i];
    const voted = votes[player.id];
    ctx.fillStyle = voted ? style.scene.accent : style.css.muted;
    ctx.fillText(`${voted ? "READY" : "WAIT"} ${player.id.slice(0, 8)}`, 124, 184 + i * 8);
  }
}

function getRoomVisualLoop(fallbackLoop) {
  const room = sessionState.room;
  if (!room) return fallbackLoop;

  if (isRoomVisuallyExploding(room)) {
    return {
      ...fallbackLoop,
      elapsed: EXPLOSION_START + getRoomExplosionAge(room),
      rebuildProgress: 0,
      upgradeLevel: room.upgradeLevel || 0,
    };
  }

  if (room.phase === "end") {
    return {
      ...fallbackLoop,
      elapsed: EXPLOSION_START + 3000,
      rebuildProgress: 0,
      upgradeLevel: room.upgradeLevel || 0,
    };
  }

  return {
    ...fallbackLoop,
    elapsed: Math.min(EXPLOSION_START - 1, fallbackLoop.elapsed),
    upgradeLevel: room.upgradeLevel || 0,
  };
}

function isRoomVisuallyExploding(room, now = Date.now()) {
  return room?.phase === "explosion" || (room?.phase === "repair" && countdownMs(room, now) <= 0);
}

function getRoomExplosionAge(room, now = Date.now()) {
  if (room?.phase === "explosion") return Math.max(0, now - room.phaseStartedAt);
  if (room?.phase === "repair" && room.countdownEndsAt) return Math.max(0, now - room.countdownEndsAt);
  return 0;
}

function getVisualRoom(room, now = Date.now()) {
  if (!room || !isRoomVisuallyExploding(room, now)) return room;
  return { ...room, phase: "explosion" };
}

function drawPixelSoldierSprite(style, actor, time) {
  const x = Math.round(actor.x);
  const y = Math.round(actor.y + (actor.step === 0 ? 0 : -1));
  const frames = getSoldierFrames(style, actor.member);
  const step = actor.step;
  const frame = frames[step % frames.length];
  const scale = 1;
  const drawX = x - Math.floor(frame.width / 2);
  const drawY = y - frame.height + 5;

  ctx.globalAlpha = actor.fade;
  drawPixelShadow(x, y, actor.phase);
  if (actor.phase === "incapacitated") {
    drawCharacterMotionDetails(style, actor, x, y, time);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.drawImage(frame.canvas, drawX, drawY);
  drawCharacterMotionDetails(style, actor, x, y, time);

  if (activeStyle === "cyberpunk" && Math.sin(time / 80) > 0.1) {
    px(x + 17, y - 19, 2 * scale, 2 * scale, style.scene.glow);
  }

  if (actor.phase === "enter" && actor.dissolve > 0) {
    punchSoldierPixelsIntoDoor(frame, drawX, drawY, style, actor.dissolve, time);
  }

  if (actor.phase === "escape" && Math.sin(time / 75 + x) > 0.2) {
    px(x - 12, y - 18, 2, 2, style.scene.glow);
  }

  ctx.globalAlpha = 1;
}

function drawCharacterMotionDetails(style, actor, x, y, time) {
  const colors = getCharacterColors(style, actor.member);
  if (actor.phase === "incapacitated") {
    ctx.globalAlpha = 0.76;
    px(x - 14, y - 12, 29, 6, "rgba(0, 0, 0, 0.58)");
    px(x - 10, y - 23, 22, 4, "#2b1a11");
    px(x - 7, y - 30, 13, 4, colors.armor);
    px(x - 3, y - 28, 8, 2, "#ff6b28");
    px(x + 9, y - 18, 9, 2, colors.weapon);
    px(x - 15, y - 18, 8, 2, colors.boot);
    ctx.globalAlpha = 0.5 + Math.sin(time / 140) * 0.16;
    px(x - 3, y - 36, 2, 2, "#fff6cf");
    px(x + 3, y - 39, 3, 3, "#ff6b28");
    ctx.globalAlpha = 1;
    return;
  }

  if (actor.phase === PLAYER_STATES.stasis) {
    ctx.globalAlpha = 0.74;
    px(x - 15, y - 35, 30, 30, "rgba(112, 168, 255, 0.38)");
    px(x - 17, y - 37, 34, 3, style.scene.glow);
    px(x - 17, y - 8, 34, 3, style.scene.glow);
    px(x - 17, y - 37, 3, 32, style.scene.glow);
    px(x + 14, y - 37, 3, 32, style.scene.glow);
    ctx.globalAlpha = 0.95;
    px(x - 12, y - 32, 7, 3, style.css.text);
    px(x + 5, y - 27, 8, 3, style.css.text);
    px(x - 9, y - 13, 6, 3, actor.ability?.color || style.scene.glow);
    px(x + 8, y - 18, 5, 5, style.scene.glow);
    ctx.globalAlpha = 0.48;
    for (let i = 0; i < 7; i += 1) {
      px(x - 18 + i * 6, y - 42 - (i % 2) * 4, 2, 5, i % 2 ? style.css.text : style.scene.glow);
    }
    ctx.globalAlpha = 1;
  }

  if (actor.ability?.id === "magnet" && actor.phase === "repair") {
    ctx.globalAlpha = 0.16 + Math.sin(time / 240) * 0.05;
    drawPixelCircle(x, y - 11, SKILL_CONFIG.magnet.claimRadius, actor.ability.color);
    ctx.globalAlpha = 0.9;
    px(x - 17, y - 31, 4, 9, actor.ability.color);
    px(x + 13, y - 31, 4, 9, actor.ability.color);
    px(x - 13, y - 23, 26, 4, actor.ability.accent);
    ctx.globalAlpha = 1;
  } else if (actor.ability?.id === "boost" && actor.phase === "repair" && actor.boostActive) {
    for (let i = 0; i < 5; i += 1) {
      ctx.globalAlpha = 0.58 - i * 0.08;
      px(x - 18 - i * 6, y - 8 + (i % 2) * 3, 10, 2, i % 2 ? style.scene.accent : style.scene.glow);
    }
    ctx.globalAlpha = 0.8;
    px(x - 7, y - 34, 3, 9, actor.ability.color);
    px(x + 4, y - 34, 3, 9, actor.ability.color);
    ctx.globalAlpha = 1;
  } else if (actor.ability?.id === "boost" && actor.phase === "repair") {
    ctx.globalAlpha = 0.36;
    px(x - 6, y - 34, 3, 7, actor.ability.color);
    px(x + 4, y - 34, 3, 7, actor.ability.color);
    ctx.globalAlpha = 1;
  } else if (actor.stasisPulse) {
    const wave = (time % SKILL_CONFIG.stasis.cooldownMs) / SKILL_CONFIG.stasis.pulseMs;
    const radius = Math.floor(SKILL_CONFIG.stasis.radius * clamp(wave, 0, 1));
    ctx.globalAlpha = 0.26;
    drawPixelCircle(x, y - 14, radius, actor.ability.color, actor.ability.accent);
    ctx.globalAlpha = 0.72;
    px(x - 2, y - 45, 4, 10, actor.ability.color);
    px(x - 9, y - 39, 18, 3, actor.ability.accent);
    ctx.globalAlpha = 1;
  } else if (actor.ability?.id === "warp" && actor.phase === "repair") {
    const pulse = clamp((time % SKILL_CONFIG.warp.cooldownMs) / SKILL_CONFIG.warp.activeMs, 0, 1);
    const radius = 10 + Math.floor(pulse * 26);
    ctx.globalAlpha = 0.18 + (1 - pulse) * 0.2;
    drawPixelCircle(x - 20, y - 20, radius, actor.ability.color, actor.ability.accent);
    ctx.globalAlpha = 0.42;
    drawPixelCircle(x + 13, y - 16, Math.max(7, radius - 8), actor.ability.accent);
    for (let i = 0; i < 4; i += 1) {
      ctx.globalAlpha = 0.52 - i * 0.1;
      px(x - 26 - i * 9, y - 24 + i * 4, 8 - (i % 2), 7 - (i % 2), i % 2 ? "#bca982" : actor.ability.color);
      px(x - 23 - i * 9, y - 18 + i * 4, 5, 2, actor.ability.accent);
    }
    ctx.globalAlpha = 0.9;
    px(x + 10, y - 31, 10, 3, actor.ability.color);
    px(x + 15, y - 36, 4, 12, actor.ability.accent);
    ctx.globalAlpha = 1;
  } else if (actor.ability?.id === "greed" && actor.phase === "repair") {
    drawGreedMoneyBag(style, actor, x, y, time);
    ctx.globalAlpha = 1;
  }

  if (actor.member.role === "scout") {
    const blink = Math.sin(time / 90) > 0 ? colors.glow : colors.armorLight;
    px(x - 12, y - 28, 2, 2, blink);
    px(x - 15, y - 30, 2, 1, blink);
  } else if (actor.member.role === "heavy") {
    px(x - 15, y - 20, 4, 12, colors.accent);
    px(x + 13, y - 18, 7, 3, colors.weapon);
    px(x + 18, y - 20, 4, 1, colors.weapon);
  } else if (actor.member.role === "engineer") {
    const spark = Math.sin(time / 110) > 0;
    px(x - 13, y - 15, 5, 7, colors.glow);
    if (spark) {
      px(x + 15, y - 13, 2, 2, colors.white);
      px(x + 18, y - 15, 2, 1, colors.accent);
    }
  } else {
    px(x - 12, y - 25, 3, 6, colors.accent);
  }
}

function drawPixelShadow(x, y, phase) {
  const shrink = phase === "enter" ? 0.85 : phase === "incapacitated" ? 1.25 : 1;
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(Math.round(x - 9 * shrink), Math.round(y + 3), Math.round(20 * shrink), 4);
  ctx.fillRect(Math.round(x - 5 * shrink), Math.round(y + 6), Math.round(10 * shrink), 2);
}

function drawGreedMoneyBag(style, actor, x, y, time) {
  const angle = time / 280 + getStringSeed(actor.member.id) * 0.03;
  const bagX = x + Math.cos(angle) * 18;
  const bagY = y - 24 + Math.sin(angle) * 8;
  ctx.globalAlpha = 0.88;
  px(bagX - 4, bagY - 5, 8, 8, "#8a5a21");
  px(bagX - 3, bagY - 8, 6, 3, "#d5983b");
  px(bagX - 2, bagY - 2, 4, 1, style.css.text);
  px(bagX - 1, bagY - 4, 2, 5, "#ffdf6a");
  ctx.globalAlpha = 0.5;
  drawPixelCircle(x, y - 18, 24, actor.ability.color);
  ctx.globalAlpha = 1;
}

function getSoldierFrames(style, member) {
  const key = `${activeStyle}:${member.gender}:${member.id}:${member.role}`;
  if (soldierFrameCache[key]) return soldierFrameCache[key];

  const colors = getCharacterColors(style, member);
  const frames = [0, 1].map((step) => makeSoldierFrame(colors, step, member));
  soldierFrameCache[key] = frames;
  return frames;
}

function getCharacterColors(style, member) {
  const colors = { ...style.scene.soldier };
  colors.accent = style.scene.accent;
  colors.glow = style.scene.glow;
  colors.white = "#f4f1dd";
  colors.dark = "#0b0d0c";

  if (member.role === "engineer") {
    colors.armorLight = style.scene.accent;
    colors.visor = style.css.accent2;
    colors.armor = style.css.strong;
  } else if (member.role === "scout") {
    colors.armorLight = style.scene.glow;
    colors.armor = style.scene.groundDark;
  } else if (member.role === "heavy") {
    colors.visor = style.scene.accent;
    colors.armor = style.scene.shadow;
    colors.armorLight = style.scene.rock;
  } else {
    colors.accent = style.css.accent;
  }

  return colors;
}

function makeSoldierFrame(colors, step, member) {
  const width = 34;
  const height = 36;
  const imageData = new ImageData(width, height);

  function pixel(x, y, color) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const rgb = color.startsWith("#") ? hexToRgb(color) : parseRgbString(color);
    const offset = (Math.round(y) * width + Math.round(x)) * 4;
    imageData.data[offset] = rgb.r;
    imageData.data[offset + 1] = rgb.g;
    imageData.data[offset + 2] = rgb.b;
    imageData.data[offset + 3] = 255;
  }

  function rect(x, y, w, h, color) {
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) {
        pixel(x + xx, y + yy, color);
      }
    }
  }

  const legA = step === 0 ? 0 : 2;
  const legB = step === 0 ? 2 : 0;

  if (member.role === "heavy") {
    rect(10, 4, 12, 6, colors.armor);
    rect(12, 1, 8, 4, colors.armorLight);
    rect(19, 5, 8, 2, colors.visor);
    rect(7, 10, 18, 14, colors.armor);
    rect(9, 11, 12, 4, colors.armorLight);
    rect(4, 12, 5, 10, colors.armor);
    rect(25, 12, 5, 10, colors.armor);
    rect(9, 24, 5, 7 + legA, colors.boot);
    rect(19, 24, 5, 7 + legB, colors.boot);
    rect(6, 31 + legA, 9, 3, colors.boot);
    rect(19, 31 + legB, 9, 3, colors.boot);
    rect(24, 15, 9, 3, colors.weapon);
    rect(29, 12, 5, 2, colors.weapon);
    rect(27, 18, 5, 5, colors.weapon);
    rect(5, 9, 3, 15, colors.accent);
  } else if (member.role === "scout") {
    rect(12, 5, 8, 4, colors.armor);
    rect(14, 2, 5, 3, colors.armorLight);
    rect(18, 6, 6, 1, colors.visor);
    rect(11, 10, 10, 12, colors.armor);
    rect(13, 11, 6, 3, colors.armorLight);
    rect(8, 12, 3, 7, colors.armor);
    rect(21, 13, 3, 6, colors.armor);
    rect(12, 22, 3, 8 + legA, colors.boot);
    rect(18, 22, 3, 8 + legB, colors.boot);
    rect(9, 30 + legA, 6, 2, colors.boot);
    rect(18, 30 + legB, 6, 2, colors.boot);
    rect(23, 14, 10, 1, colors.weapon);
    rect(26, 11, 2, 2, colors.glow);
    rect(7, 8, 3, 3, colors.glow);
  } else if (member.role === "engineer") {
    rect(11, 5, 9, 5, colors.armor);
    rect(13, 1, 6, 4, colors.accent);
    rect(17, 6, 7, 2, colors.visor);
    rect(10, 10, 11, 13, colors.armor);
    rect(12, 11, 6, 3, colors.armorLight);
    rect(7, 13, 4, 7, colors.armor);
    rect(21, 13, 4, 7, colors.armor);
    rect(10, 23, 4, 7 + legA, colors.boot);
    rect(18, 23, 4, 7 + legB, colors.boot);
    rect(8, 30 + legA, 7, 2, colors.boot);
    rect(18, 30 + legB, 7, 2, colors.boot);
    rect(23, 15, 4, 2, colors.weapon);
    rect(27, 14, 4, 1, colors.weapon);
    rect(25, 17, 3, 7, colors.accent);
    rect(6, 19, 5, 5, colors.glow);
  } else {
    rect(11, 4, 9, 5, colors.armor);
    rect(13, 1, 6, 3, colors.armor);
    rect(17, 5, 7, 2, colors.visor);
    rect(9, 10, 13, 13, colors.armor);
    rect(12, 11, 8, 3, colors.armorLight);
    rect(7, 12, 4, 8, colors.armor);
    rect(21, 13, 4, 7, colors.armor);
    rect(11, 23, 4, 7 + legA, colors.boot);
    rect(18, 23, 4, 7 + legB, colors.boot);
    rect(8, 30 + legA, 7, 2, colors.boot);
    rect(18, 30 + legB, 7, 2, colors.boot);
    rect(23, 15, 6, 2, colors.weapon);
    rect(27, 13, 3, 1, colors.weapon);
    rect(24, 17, 3, 4, colors.weapon);
    rect(8, 8, 3, 3, colors.accent);
  }

  const canvasFrame = document.createElement("canvas");
  canvasFrame.width = width;
  canvasFrame.height = height;
  canvasFrame.getContext("2d").putImageData(imageData, 0, 0);

  return { canvas: canvasFrame, imageData, width, height };
}

function parseRgbString(color) {
  const match = color.match(/\d+/g);
  if (!match) return { r: 255, g: 255, b: 255 };
  return {
    r: Number(match[0]),
    g: Number(match[1]),
    b: Number(match[2]),
  };
}

function punchSoldierPixelsIntoDoor(frame, drawX, drawY, style, dissolve, time) {
  const targetX = style.entrance.x;
  const targetY = style.entrance.y - 8;
  const glow = hexToRgb(style.scene.glow);

  for (let y = 0; y < frame.height; y += 2) {
    for (let x = 0; x < frame.width; x += 2) {
      const sourceOffset = (y * frame.width + x) * 4;
      if (frame.imageData.data[sourceOffset + 3] === 0) continue;
      if (hash2d(x, y, Math.floor(time / 60)) > dissolve) continue;

      const worldX = Math.round(drawX + x + (targetX - (drawX + frame.width / 2)) * dissolve);
      const worldY = Math.round(drawY + y + (targetY - (drawY + frame.height / 2)) * dissolve);
      const alpha = 1 - dissolve * 0.45;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${glow.r} ${glow.g} ${glow.b})`;
      ctx.fillRect(worldX, worldY, 2, 2);
    }
  }

  ctx.globalAlpha = 1;
}

function drawExplosion(style, elapsed, time) {
  if (elapsed < EXPLOSION_START) return;

  const blast = clamp((elapsed - EXPLOSION_START) / 1050, 0, 1);
  const smoke = clamp((elapsed - EXPLOSION_START) / 3600, 0, 1);
  const centerX = style.entrance.x + 26;
  const centerY = style.entrance.y - 34;
  const glow = hexToRgb(style.scene.glow);

  if (blast < 1) {
    ctx.globalAlpha = 0.9 * (1 - blast);
    drawPixelCircle(centerX, centerY, 24 + Math.floor(blast * 50), "#ff6b28");
    ctx.globalAlpha = 0.72 * (1 - blast);
    drawPixelCircle(centerX + 6, centerY - 2, 18 + Math.floor(blast * 40), style.scene.glow);
    ctx.globalAlpha = 0.95 * (1 - blast);
    drawPixelCircle(centerX - 5, centerY + 2, 10 + Math.floor(blast * 18), "#fff6cf");
    ctx.globalAlpha = 1;
  }

  const flame = clamp(1 - (elapsed - EXPLOSION_START) / 4200, 0, 1);
  if (flame > 0) {
    for (let i = 0; i < 9; i += 1) {
      const x = centerX - 34 + i * 8;
      const h = 10 + Math.floor(hash2d(i, Math.floor(time / 120), activeStyle.length) * 18 * flame);
      ctx.globalAlpha = 0.72 * flame;
      px(x, centerY + 20 - h, 5, h, i % 2 === 0 ? "#ff6b28" : "#d62818");
      ctx.globalAlpha = 0.9 * flame;
      px(x + 1, centerY + 22 - h, 3, Math.max(3, Math.floor(h * 0.45)), "#fff6cf");
    }
    ctx.globalAlpha = 1;
  }

  const shardColors = ["#fff6cf", "#ff6b28", "#d62818", style.scene.accent, style.scene.glow, "#2a1b10", "#7f6b43"];
  for (let i = 0; i < 42; i += 1) {
    const angle = hash2d(i, 2, activeStyle.length) * Math.PI * 2;
    const speed = 22 + hash2d(i, 5, activeStyle.length) * 56;
    const distance = speed * Math.min(1.35, (elapsed - EXPLOSION_START) / 950);
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance + blast * blast * 18;
    const size = 1 + Math.floor(hash2d(i, 9, activeStyle.length) * 4);
    const alpha = clamp(1 - (elapsed - EXPLOSION_START) / 2600, 0, 1);

    ctx.globalAlpha = alpha;
    px(x, y, size, size, shardColors[i % shardColors.length]);
  }

  for (let i = 0; i < 18; i += 1) {
    const drift = (elapsed - EXPLOSION_START) / 110;
    const x = centerX - 52 + i * 6 + Math.sin(time / 240 + i) * 4;
    const y = centerY - 8 - smoke * 32 - hash2d(i, 4, activeStyle.length) * 18 + (drift % 5);
    const alpha = 0.48 * clamp(smoke, 0, 1) * clamp(1 - smoke * 0.45, 0, 1);

    ctx.globalAlpha = alpha;
    px(x, y, 10 + (i % 3) * 2, 6 + (i % 2) * 2, "rgb(33 34 31)");
  }

  ctx.globalAlpha = 1;
}

function drawPlantShockwave(style, plant, elapsed, time) {
  if (elapsed < EXPLOSION_START) return;
  const age = elapsed - EXPLOSION_START;
  const blast = plant.blast || { x: plant.x, y: plant.y, radius: DEMO_BLAST.radius };
  const burst = clamp(age / 850, 0, 1);
  const smoke = clamp((age - 450) / 1800, 0, 1);
  const pulse = Math.floor(Math.sin(time / 34) * 2);

  if (burst < 1) {
    ctx.globalAlpha = 0.42 * (1 - burst);
    drawPixelCircle(blast.x, blast.y, 18 + Math.floor(blast.radius * burst), "#ff6b28", "#fff6cf");
    ctx.globalAlpha = 0.24 * (1 - burst);
    drawPixelCircle(blast.x, blast.y, 32 + Math.floor(blast.radius * 1.35 * burst), style.scene.glow);
  }

  for (let i = 0; i < 18; i += 1) {
    const angle = hash2d(i, plant.x, plant.y) * Math.PI * 2;
    const distance = 14 + Math.min(blast.radius * 0.86, age / 10 + hash2d(i, 7, plant.x) * 34);
    const x = blast.x + Math.cos(angle) * distance;
    const y = blast.y + Math.sin(angle) * distance * 0.72;
    const alpha = clamp(0.72 - age / 1700, 0, 0.72);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    px(x, y, 4 + (i % 3), 4 + ((i + 1) % 3), i % 2 === 0 ? "#ff6b28" : "#fff6cf");
  }

  if (smoke > 0) {
    for (let i = 0; i < 24; i += 1) {
      const angle = hash2d(i, 13, plant.y) * Math.PI * 2;
      const distance = 10 + hash2d(i, 17, plant.x) * blast.radius * 0.64 + smoke * 18;
      const x = blast.x + Math.cos(angle) * distance + pulse;
      const y = blast.y + Math.sin(angle) * distance * 0.58 - smoke * 28;
      ctx.globalAlpha = 0.28 * (1 - smoke);
      px(x, y, 6 + (i % 4), 4 + (i % 3), "rgba(42, 38, 25, 0.9)");
    }
  }
  ctx.globalAlpha = 1;
}

function drawVortexTransition(style, loop, time) {
  if (loop.elapsed < DEMO_VORTEX_START) return;
  const progress = clamp((loop.elapsed - DEMO_VORTEX_START) / (REBUILD_END - DEMO_VORTEX_START), 0, 1);
  const centerX = WORLD_CENTER.x;
  const centerY = WORLD_CENTER.y;
  const spin = time / 170;

  ctx.globalAlpha = 0.2 + progress * 0.62;
  px(0, 0, VIEW.width, VIEW.height, "rgba(0, 0, 0, 0.58)");
  ctx.globalAlpha = 1;

  for (let i = 0; i < 84; i += 1) {
    const lane = i % 7;
    const angle = spin + i * 0.42 + progress * 5;
    const radius = (1 - progress) * (230 - lane * 13) + lane * 4;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * 0.62;
    const size = 2 + (i % 4);
    const color = i % 3 === 0 ? style.scene.glow : i % 3 === 1 ? style.scene.accent : style.css.text;
    ctx.globalAlpha = clamp(0.18 + progress * 0.8 - lane * 0.035, 0.08, 0.88);
    px(x, y, size, size, color);
  }

  const core = 10 + Math.floor(progress * 52);
  ctx.globalAlpha = 0.52 + progress * 0.28;
  drawPixelCircle(centerX, centerY, core, style.scene.glow, style.scene.accent);
  ctx.globalAlpha = 1;

  ctx.fillStyle = style.css.text;
  ctx.font = "8px monospace";
  ctx.fillText("NEXT RUN LOADING", centerX - 42, centerY + 4);
}

function drawVignette(style) {
  const colors = style.scene;
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.28)");
  gradient.addColorStop(0.55, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.strokeStyle = colors.accent;
  ctx.globalAlpha = 0.28;
  ctx.strokeRect(2.5, 2.5, VIEW.width - 5, VIEW.height - 5);
  ctx.globalAlpha = 1;
}

function getDemoTransitionStage(elapsed) {
  if (elapsed < EXPLOSION_START) return "repair";
  if (elapsed < REBUILD_START) return "blast";
  if (elapsed < DEMO_VORTEX_START) return "rebuild";
  return "vortex";
}

function getDemoMechanicsSnapshot(totalElapsed, time = totalElapsed) {
  const loop = getDemoLoopState(totalElapsed);
  const room = getDemoRoom(loop, time);
  const players = Object.values(room.players || {});
  const nodes = room.nodes || [];
  const routePlans = squad.map((member, index) => ({
    id: member.id,
    ability: getDemoAbility(member, loop.cycle).id,
    targets: getDemoNodePlan(member, index, loop.cycle)
      .slice(0, 3)
      .map((node) => node.id),
  }));

  return {
    cycle: loop.cycle,
    elapsed: loop.elapsed,
    stage: getDemoTransitionStage(loop.elapsed),
    countdownMs: getDemoCountdownMs(loop),
    nodeTimerDeltaMs: room.nodeTimerDeltaMs,
    repairedNodeCount: room.repairedNodeCount,
    claimedNodeCount: nodes.filter((node) => node.claimedBy).length,
    nodeCount: nodes.length,
    plants: room.plants || [],
    blasts: room.blasts || (room.blast ? [room.blast] : []),
    summary: room.summary || [],
    nodes: nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      value: node.value,
      state: node.state,
      stasisLocked: Boolean(node.stasisLocked),
      claimedBy: node.claimedBy || null,
      bonus: Boolean(node.bonus),
      negative: node.value < 0,
      distanceFromPlant: node.distanceFromPlant ?? distanceToNearestDemoPlant(node, loop.cycle),
      plantHeat: node.plantHeat ?? demoNodeHeat(node, getDemoPlants(loop.cycle)),
      valuePulseCount: node.valuePulseCount || 0,
    })),
    playerCount: players.length,
    players: players.map((player) => ({
      id: player.id,
      ability: player.ability?.id,
      boostActive: Boolean(player.boostActive),
      warpHopActive: Boolean(player.warpHopActive),
      skillCooldown: player.skillCooldown,
      state: player.state,
      roundScore: player.roundScore,
    })),
    frozenCount: players.filter((player) => player.state === PLAYER_STATES.stasis).length,
    skillStats: getDemoSkillStats(loop, Object.values(room.players || {}).map((player) => ({ ability: player.ability }))),
    audioCueCounts: { ...audioState.demoAbilityCueCounts },
    demoOnlyAbilityIds: [...DEMO_ONLY_ABILITY_IDS],
    skillConfig: SKILL_CONFIG,
    playerAbilities: players.map((player) => player.ability?.id).filter(Boolean),
    routePlans,
  };
}

window.__POWER_PLANT_DEMO_DEBUG__ = {
  getSnapshotAt: getDemoMechanicsSnapshot,
  getAudioDebug: () => ({
    enabled: audioState.enabled,
    unlocked: audioState.unlocked,
    contextState: audioState.context?.state || "missing",
    cueCounts: { ...audioState.demoAbilityCueCounts },
  }),
  demoOnlyAbilityIds: [...DEMO_ONLY_ABILITY_IDS],
  timings: {
    nominalLoopDuration: LOOP_DURATION,
    firstLoopDuration: getDemoCycleDuration(0),
    explosionStart: EXPLOSION_START,
    rebuildStart: REBUILD_START,
    vortexStart: DEMO_VORTEX_START,
    rebuildEnd: REBUILD_END,
    postDetonationDuration: REBUILD_END - EXPLOSION_START,
  },
};

function render(now) {
  const style = styles[activeStyle];
  const rawElapsed = gameStarted ? now - startedAt : 0;
  const elapsed = sessionState.room ? rawElapsed : rawElapsed * DEMO_TIME_SCALE;
  const baseLoop = sessionState.room ? getLoopState(elapsed) : getDemoLoopState(elapsed);
  const loop = sessionState.room ? getRoomVisualLoop(baseLoop) : baseLoop;
  const demoRoom = sessionState.room ? null : getDemoRoom(loop, now);
  const plantProgress = clamp(loop.elapsed / 7200, 0, 1);

  if (gameStarted && sessionState.room?.phase !== "end") {
    updateDemoAudio(style, loop, now);
  }

  if (sessionState.room) {
    updateRoomPosition(loop, now);
    pollRoomState(now);
    updateRoomStatus(null, Date.now());
  } else {
    pollRoomList(now);
  }
  setStatus(loop);
  if (sessionState.room?.phase === "end") {
    drawFinalScoreScene(style);
    drawVignette(style);
    requestAnimationFrame(render);
    return;
  }
  drawBackground(style, now);
  const activeRoom = getVisualRoom(demoRoom || sessionState.room);
  const plants = activeRoom?.plants?.length ? activeRoom.plants : [{ id: "plant-1", ...WORLD_CENTER, blast: activeRoom?.blast || DEMO_BLAST }];
  for (const plant of plants) {
    drawPlantAt(style, now, plantProgress, loop, plant, plants.length > 1 ? PLANT_WORLD_SCALE * 0.42 : PLANT_WORLD_SCALE);
    drawPlantShockwave(style, plant, loop.elapsed, now);
    drawCenteredPlant(() => drawExplosion(style, loop.elapsed, now), plant, plants.length > 1 ? PLANT_WORLD_SCALE * 0.42 : PLANT_WORLD_SCALE);
  }
  drawRoomObjectives(style, now, activeRoom);
  drawSkillDebugAreas(style, activeRoom);
  drawBuildingCountdown(style, now, activeRoom);
  drawPlantClaimFeed(style, activeRoom, sessionState.room ? null : loop);
  if (sessionState.room) {
    drawRoomPlayers(style);
    drawClaimTimers(style);
    drawRoomHud(style);
  } else {
    drawSquad(style, loop, now, demoRoom);
    drawClaimTimers(style, demoRoom);
    drawDemoHud(style, demoRoom, loop);
    drawDemoSkillLog(style, demoRoom);
    drawDemoBlastReport(style, demoRoom, loop);
    drawVortexTransition(style, loop, now);
  }
  drawVignette(style);

  requestAnimationFrame(render);
}

startButton.addEventListener("click", startGame);

audioButton.addEventListener("click", () => {
  setAudioEnabled(!audioState.enabled);
});

loginButton.addEventListener("click", () => {
  window.location.href = `/api/auth/github/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
});

logoutButton.addEventListener("click", () => {
  window.location.href = "/api/auth/logout";
});

createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", showActiveRooms);
readyButton.addEventListener("click", toggleReady);
roomReadyButton.addEventListener("click", toggleReady);
endRoomButton.addEventListener("click", endRoomGame);
leaveRoomButton.addEventListener("click", leaveRoom);
copyRoomButton.addEventListener("click", copyRoomLink);
skillConfigToggle?.addEventListener("click", () => {
  showSkillConfig = !showSkillConfig;
  skillConfigToggle.setAttribute("aria-pressed", String(showSkillConfig));
  shell.classList.toggle("show-skill-config", showSkillConfig);
  skillConfigToggle.textContent = showSkillConfig ? "Debug config + ranges: on" : "Debug config + ranges: off";
});
sessionActions.addEventListener("click", (event) => {
  if (event.target.closest("button")) {
    sessionActions.open = false;
  }
});
canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("pointerdown", handleCanvasPointer);
canvas.addEventListener("pointermove", handleCanvasPointer);
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = normalizeRoomId(roomCodeInput.value);
});
roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinRoom();
});

for (const button of styleButtons) {
  button.addEventListener("click", () => {
    setActiveStyle(button.dataset.style);
    themeMenu.open = false;
  });
}

replayButton.addEventListener("click", replayOrVote);

window.addEventListener("keydown", (event) => {
  if (!gameStarted && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    startGame();
    return;
  }

  if (!gameStarted) return;

  if (event.key === "r" || event.key === "R" || event.key === " ") {
    replay();
  }

  if (event.key === "1") setActiveStyle("steampunk");
  if (event.key === "2") setActiveStyle("cyberpunk");
  if (event.key === "3") setActiveStyle("futuristic");
});

setActiveStyle(activeStyle);
updateAudioButton();
updateSessionUi();
updateRoomStatus();
loadSession();
requestAnimationFrame(render);
