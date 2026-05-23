import { countdownLabel, countdownMs, countdownSeconds, formatHoldLabel, formatNodeValue, formatScore } from "./client/formatters.js";
import { buildRoomUrl, clearRoomUrl, getRoomIdFromUrl, normalizeRoomId, updateRoomUrl } from "./client/room-url.js";

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

const LOOP_DURATION = 16600;
const EXPLOSION_START = 7200;
const ESCAPE_START = 8350;
const REBUILD_START = 12850;
const REBUILD_END = 15800;

const squad = [
  {
    id: "lead",
    gender: "male",
    role: "rifleman",
    enterStart: 0,
    enterEnd: 5600,
    exitEnd: 11600,
    enterPath: [
      { x: 42, y: 178 },
      { x: 83, y: 165 },
      { x: 126, y: 148 },
      { x: 164, y: 135 },
      { x: 190, y: 128 },
      { x: 206, y: 139 },
    ],
    exitPath: [
      { x: 206, y: 139 },
      { x: 178, y: 147 },
      { x: 130, y: 158 },
      { x: 72, y: 181 },
      { x: 28, y: 202 },
    ],
  },
  {
    id: "north",
    gender: "male",
    role: "scout",
    enterStart: 650,
    enterEnd: 6150,
    exitEnd: 11950,
    enterPath: [
      { x: 82, y: 30 },
      { x: 112, y: 55 },
      { x: 145, y: 84 },
      { x: 178, y: 113 },
      { x: 202, y: 137 },
    ],
    exitPath: [
      { x: 202, y: 137 },
      { x: 174, y: 107 },
      { x: 136, y: 76 },
      { x: 94, y: 46 },
      { x: 54, y: 22 },
    ],
  },
  {
    id: "east",
    gender: "male",
    role: "heavy",
    enterStart: 1050,
    enterEnd: 6500,
    exitEnd: 12350,
    enterPath: [
      { x: 360, y: 152 },
      { x: 322, y: 148 },
      { x: 282, y: 143 },
      { x: 238, y: 138 },
      { x: 204, y: 139 },
    ],
    exitPath: [
      { x: 204, y: 139 },
      { x: 244, y: 146 },
      { x: 290, y: 154 },
      { x: 334, y: 170 },
      { x: 374, y: 190 },
    ],
  },
  {
    id: "south",
    gender: "female",
    role: "engineer",
    enterStart: 1450,
    enterEnd: 6900,
    exitEnd: 12650,
    enterPath: [
      { x: 222, y: 206 },
      { x: 218, y: 184 },
      { x: 214, y: 164 },
      { x: 208, y: 148 },
      { x: 202, y: 139 },
    ],
    exitPath: [
      { x: 202, y: 139 },
      { x: 218, y: 158 },
      { x: 234, y: 178 },
      { x: 252, y: 199 },
      { x: 268, y: 214 },
    ],
  },
];

let activeStyle = "steampunk";
let startedAt = performance.now();
let lastStatus = "";
let gameStarted = false;
const soldierFrameCache = {};
const audioState = {
  context: null,
  master: null,
  noiseBuffer: null,
  enabled: false,
  unlocked: false,
  nextStepAt: 0,
  nextHazardAt: 0,
  explosionCycle: -1,
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
    audioState.master.gain.value = 0.32;
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

  const actors = squad.map((member, index) => getSquadMemberState(member, index, loop.elapsed, time)).filter(Boolean);
  const movingActors = actors.filter((actor) => (actor.phase === "enter" && actor.fade > 0.16) || actor.phase === "escape");

  if (movingActors.length > 0 && time >= audioState.nextStepAt) {
    const escaping = movingActors.some((actor) => actor.phase === "escape");
    playFootstepSound(movingActors.length, escaping ? "escape" : "enter");
    audioState.nextStepAt = time + (escaping ? 108 : 145) - Math.min(32, movingActors.length * 6);
  }

  if (audioState.explosionCycle !== loop.cycle && loop.elapsed >= EXPLOSION_START && loop.elapsed < EXPLOSION_START + 1350) {
    playExplosionSound(style);
    audioState.explosionCycle = loop.cycle;
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
  let next = cycle > 0 ? "Squad returning" : "Squad approaching";
  if (elapsed > 5100) next = "Entering the plant";
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

function updateRoomStatus(nextStatus = null) {
  if (nextStatus) {
    roomStatus.textContent = nextStatus;
    return;
  }

  if (!sessionState.roomId) {
    roomStatus.textContent = "Solo";
    return;
  }

  const players = Object.values(sessionState.room?.players || {});
  const activeCount = players.filter((player) => !player.spectator && !player.bot).length;
  const botCount = players.filter((player) => !player.spectator && player.bot).length;
  const spectatorCount = players.filter((player) => player.spectator).length;
  const targetCount = sessionState.room?.targetPlayerCount || getSelectedRoomSize();
  const phase = sessionState.room?.phase || "room";
  const suffix = phase === "repair" ? ` · ${getCountdownLabel()}s` : "";
  const bots = botCount > 0 ? ` + ${botCount} bot` : "";
  const spectators = spectatorCount > 0 ? ` · ${spectatorCount} watching` : "";
  roomStatus.textContent = `${sessionState.roomId} · ${activeCount}/${targetCount}${bots}${spectators} · ${phase}${suffix}`;
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
  ctx.fillStyle = colors.pathDark;
  ctx.beginPath();
  ctx.moveTo(0, 193);
  ctx.lineTo(55, 170);
  ctx.lineTo(112, 148);
  ctx.lineTo(169, 127);
  ctx.lineTo(205, 118);
  ctx.lineTo(218, 137);
  ctx.lineTo(169, 154);
  ctx.lineTo(104, 174);
  ctx.lineTo(40, 198);
  ctx.lineTo(0, 209);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.path;
  ctx.beginPath();
  ctx.moveTo(0, 197);
  ctx.lineTo(57, 174);
  ctx.lineTo(116, 153);
  ctx.lineTo(174, 133);
  ctx.lineTo(202, 126);
  ctx.lineTo(211, 137);
  ctx.lineTo(162, 151);
  ctx.lineTo(103, 170);
  ctx.lineTo(38, 193);
  ctx.lineTo(0, 204);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#fff8c9";
  for (let i = 0; i < 28; i += 1) {
    const p = getPointOnPath(squad[0].enterPath, i / 28);
    const jitter = hash2d(i, i + 3) * 10 - 5;
    ctx.fillRect(Math.round(p.x + jitter), Math.round(p.y + 4), 5, 2);
  }
  ctx.globalAlpha = 1;
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

function drawPlant(style, time, progress, loop) {
  drawCenteredPlant(() => drawNativePlant(style, time, progress, loop));
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

function drawCenteredPlant(drawCallback) {
  ctx.save();
  ctx.translate(WORLD_CENTER.x, WORLD_CENTER.y);
  ctx.scale(PLANT_WORLD_SCALE, PLANT_WORLD_SCALE);
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

function drawSquad(style, elapsed, time) {
  const actors = squad
    .map((member, index) => getSquadMemberState(member, index, elapsed, time))
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);

  for (const actor of actors) {
    drawPixelSoldierSprite(style, actor, time);
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
    px(x - 7, y - 18, Math.min(34, label.length * 4 + 4), 5, "rgba(0, 0, 0, 0.62)");
    ctx.fillStyle = style.css.text;
    ctx.font = "5px monospace";
    ctx.fillText(label, x - 6, y - 14);

    if (isLocal && !player.spectator) {
      drawPlayerArrow(style, x, y, player.ready);
    }
  }
}

function drawPlayerArrow(style, x, y, ready) {
  const bob = Math.floor(Math.sin(performance.now() / 140) * 2);
  const arrowY = y - 24 + bob;
  const color = ready ? style.scene.glow : style.scene.accent;
  px(x - 1, arrowY, 2, 5, color);
  px(x - 3, arrowY + 4, 6, 2, color);
  px(x - 2, arrowY + 6, 4, 2, color);
  px(x, arrowY + 8, 1, 2, color);
}

function drawRoomObjectives(style, time) {
  const room = sessionState.room;
  if (!room) return;

  if ((room.phase === "repair" || room.phase === "explosion") && room.blast) {
    ctx.globalAlpha = room.phase === "explosion" ? 0.24 : 0.12;
    drawPixelCircle(room.blast.x, room.blast.y, room.blast.radius, style.scene.accent, style.scene.glow);
    ctx.globalAlpha = 1;
  }

  if (room.phase === "repair") {
    for (const node of room.nodes || []) {
      const isNegative = node.value < 0;
      const magnitude = Math.abs(node.value);
      const isRich = magnitude >= 7 || node.bonus;
      const isClaimed = Boolean(node.claimedBy);
      const pulse = Math.floor(Math.sin(time / (isRich ? 96 : 130) + node.x) * 1);
      const color = node.repaired ? style.scene.groundLight : isNegative ? "#ff4f36" : "#57d56c";
      const edge = node.repaired ? style.scene.groundDark : isClaimed ? style.css.text : isNegative ? "#5b1711" : "#153119";
      ctx.globalAlpha = node.repaired ? 0.55 : 0.92;
      drawPixelCircle(node.x, node.y, node.repaired ? 3 : node.radius || (isRich ? 4 : 3) + pulse, color, edge);
      drawPixelCircle(node.x, node.y, node.repaired ? 3 : (isRich ? 4 : 3) + pulse, color, edge);
      px(node.x - 3, node.y - 3, 6, 6, node.repaired ? style.scene.groundDark : isNegative ? "#3a1512" : "#153119");
      px(node.x - 1, node.y - 1, 2, 2, node.repaired ? style.scene.groundLight : style.css.text);
      if (node.bonus && !node.repaired) {
        px(node.x - 1, node.y - 7, 2, 2, style.css.text);
        px(node.x - 1, node.y + 5, 2, 2, style.css.text);
        px(node.x - 7, node.y - 1, 2, 2, style.css.text);
        px(node.x + 5, node.y - 1, 2, 2, style.css.text);
      }
      ctx.fillStyle = style.css.text;
      ctx.font = "6px monospace";
      const label = `${node.value > 0 ? "+" : ""}${formatNodeValue(node.value)}`;
      px(node.x - 13, node.y - 18, 26, 8, "rgba(0, 0, 0, 0.62)");
      ctx.fillText(label, node.x - 12, node.y - 12);
      ctx.globalAlpha = 1;
    }
  }

}

function drawClaimTimers(style) {
  const room = sessionState.room;
  if (!room || room.phase !== "repair") return;

  for (const node of room.nodes || []) {
    if (!node.claimedBy || node.repaired || !node.claimEndsAt) continue;
    const player = room.players?.[node.claimedBy];
    if (!player) continue;
    const remainingMs = node.claimEndsAt - Date.now();
    const x = Math.round(player.x || node.x);
    const y = Math.round(player.y || node.y) - 20;
    const label = formatHoldLabel(remainingMs);
    px(x - 10, y - 7, 20, 9, "rgba(0, 0, 0, 0.72)");
    px(x - 10, y - 7, Math.round(20 * Math.max(0, remainingMs / node.holdMs)), 2, style.scene.accent);
    ctx.fillStyle = style.css.text;
    ctx.font = "6px monospace";
    ctx.fillText(label, x - 8, y);
  }
}

function drawBuildingCountdown(style, time) {
  const room = sessionState.room;
  if (!room || room.phase !== "repair") return;

  const seconds = getCountdownMs() / 1000;
  const blink = seconds <= 7.5 ? Math.sin(time / 90) > -0.25 : Math.sin(time / 280) > -0.7;

  const label = getCountdownLabel().padStart(5, "0");
  const x = 365;
  const y = 192;
  ctx.globalAlpha = blink ? 1 : 0.46;
  px(x - 18, y - 21, 86, 31, "rgba(0, 0, 0, 0.68)");
  px(x - 18, y - 21, 86, 3, style.scene.accent);
  ctx.fillStyle = seconds <= 7.5 ? "#ff6b28" : style.css.text;
  ctx.font = "24px monospace";
  ctx.fillText(label, x, y);
  ctx.globalAlpha = 1;
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

function drawRoundSummary(style, summary, options = {}) {
  const panelX = options.x ?? 118;
  const panelY = options.y ?? 54;
  const panelWidth = options.width ?? 150;
  const title = options.title ?? "ROUND SUMMARY";
  const visibleRows = summary.slice(0, 8);
  const panelHeight = Math.max(62, 34 + visibleRows.length * 12);
  px(panelX, panelY, panelWidth, panelHeight, "rgba(0, 0, 0, 0.72)");
  px(panelX, panelY, panelWidth, 3, style.scene.accent);
  ctx.fillStyle = style.css.text;
  ctx.font = "8px monospace";
  ctx.fillText(title, panelX + 18, panelY + 18);
  ctx.font = "7px monospace";
  for (let i = 0; i < visibleRows.length; i += 1) {
    const row = visibleRows[i];
    const state = row.state === "incapacitated" ? "DOWN" : "OK";
    const roundPrefix = row.roundScore > 0 ? "+" : "";
    ctx.fillText(
      `${row.id.slice(0, 8)} ${roundPrefix}${formatScore(row.roundScore)} / ${formatScore(row.score)} ${state}`,
      panelX + 12,
      panelY + 34 + i * 12,
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

  if (room.phase === "explosion") {
    return {
      ...fallbackLoop,
      elapsed: EXPLOSION_START + Math.max(0, Date.now() - room.phaseStartedAt),
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

function getSquadMemberState(member, index, elapsed, time) {
  const escapeStart = ESCAPE_START + index * 140;

  if (elapsed < member.enterStart) return null;

  if (elapsed <= member.enterEnd) {
    const progress = easeInOut(clamp((elapsed - member.enterStart) / (member.enterEnd - member.enterStart), 0, 1));
    const position = getPointOnPath(member.enterPath, progress);
    return {
      ...position,
      member,
      phase: "enter",
      progress,
      step: Math.floor((time + index * 55) / 120) % 2,
      fade: progress > 0.82 ? 1 - clamp((progress - 0.82) / 0.18, 0, 1) * 0.9 : 1,
      dissolve: clamp((progress - 0.78) / 0.2, 0, 1),
    };
  }

  if (elapsed < escapeStart) return null;

  if (elapsed <= member.exitEnd) {
    const progress = easeInOut(clamp((elapsed - escapeStart) / (member.exitEnd - escapeStart), 0, 1));
    const position = getPointOnPath(member.exitPath, progress);
    return {
      ...position,
      member,
      phase: "escape",
      progress,
      step: Math.floor((time + index * 80) / 95) % 2,
      fade: 1,
      dissolve: 0,
    };
  }

  return null;
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
  const shrink = phase === "enter" ? 0.85 : 1;
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(Math.round(x - 9 * shrink), Math.round(y + 3), Math.round(20 * shrink), 4);
  ctx.fillRect(Math.round(x - 5 * shrink), Math.round(y + 6), Math.round(10 * shrink), 2);
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

function render(now) {
  const style = styles[activeStyle];
  const elapsed = gameStarted ? now - startedAt : 0;
  const loop = getRoomVisualLoop(getLoopState(elapsed));
  const plantProgress = clamp(loop.elapsed / 7200, 0, 1);

  if (gameStarted && sessionState.room?.phase !== "end") {
    updateDemoAudio(style, loop, now);
  }

  if (sessionState.room) {
    updateRoomPosition(loop, now);
    pollRoomState(now);
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
  drawPlant(style, now, plantProgress, loop);
  drawCenteredPlant(() => drawExplosion(style, loop.elapsed, now));
  drawRoomObjectives(style, now);
  drawBuildingCountdown(style, now);
  if (sessionState.room) {
    drawRoomPlayers(style);
    drawClaimTimers(style);
    drawRoomHud(style);
  } else {
    drawCenteredPlant(() => drawSquad(style, loop.elapsed, now));
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
