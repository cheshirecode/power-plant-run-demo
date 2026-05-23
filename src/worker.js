const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
const PLAYER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const SESSION_COOKIE = "ppr_session";
const STATE_COOKIE = "ppr_oauth_state";
const NEXT_COOKIE = "ppr_oauth_next";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const ROUND_COUNTDOWN_MS = 10_000;
const EXPLOSION_DURATION_MS = 2_200;
const NODE_VALUE_MIN = 1.5;
const NODE_VALUE_MAX = 6;
const NODE_BONUS_VALUE_MIN = 7;
const NODE_BONUS_VALUE_MAX = 9;
const NODE_BONUS_COUNT_MIN = 3;
const NODE_BONUS_COUNT_MAX = 4;
const NODE_NEGATIVE_CHANCE = 0.32;
const NODE_HOLD_SECONDS_PER_POINT = 1 / 3;
const NODE_REPAIR_RADIUS_MIN = 12;
const NODE_REPAIR_RADIUS_MAX = 18;
const NODE_MIN_DISTANCE = 24;
const NODE_MAX_VALUE_DISTANCE = 40;
const NODE_MIN_VALUE_DISTANCE = 190;
const NODE_VALUE_DECIMALS = 2;
const BLAST_CENTER = { x: 244, y: 108 };
const BLAST_RADIUS_BASE = 92;
const BLAST_RADIUS_JITTER = 10;
const MAX_PLAYERS = 4;
const START_NODES = [
  { id: "n1", x: 48, y: 176 },
  { id: "n2", x: 56, y: 96 },
  { id: "n3", x: 86, y: 42 },
  { id: "n4", x: 100, y: 148 },
  { id: "n5", x: 130, y: 78 },
  { id: "n6", x: 150, y: 184 },
  { id: "n7", x: 160, y: 130 },
  { id: "n8", x: 178, y: 54 },
  { id: "n9", x: 196, y: 118 },
  { id: "n10", x: 218, y: 176 },
  { id: "n11", x: 238, y: 46 },
  { id: "n12", x: 264, y: 92 },
  { id: "n13", x: 286, y: 154 },
  { id: "n14", x: 320, y: 58 },
  { id: "n15", x: 336, y: 120 },
  { id: "n16", x: 342, y: 184 },
];
const PLAYER_SPAWNS = [
  { x: 34, y: 184 },
  { x: 40, y: 36 },
  { x: 82, y: 198 },
  { x: 94, y: 24 },
  { x: 138, y: 204 },
  { x: 22, y: 118 },
  { x: 364, y: 24 },
  { x: 366, y: 198 },
  { x: 304, y: 206 },
  { x: 368, y: 70 },
];

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.loaded = false;
    this.roomState = {
      phase: "lobby",
      cycle: 0,
      upgradeLevel: 0,
      targetPlayerCount: 2,
      startedAt: null,
      phaseStartedAt: null,
      countdownEndsAt: null,
      blast: null,
      summary: null,
      players: {},
      nodes: cloneNodes(),
      score: 0,
      ownerId: null,
      replayVotes: {},
      closed: false,
    };
  }

  async fetch(request) {
    await this.loadRoomState();
    await this.advanceTimedPhase();
    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/(?:api|ws)\/rooms\/([^/]+)$/);
    if (roomMatch && !this.roomState.id) {
      this.roomState.id = roomMatch[1].toLowerCase();
      await this.persistRoomState();
    }
    if (request.headers.get("X-PPR-Room-Status") === "1") {
      return json({ ok: true, room: this.roomSummary() });
    }

    const player = await getAuthenticatedPlayer(request, this.env);
    if (!player) {
      return json({ error: "Sign in required" }, 401);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return json({
        ok: true,
        room: this.roomState,
      });
    }

    const targetPlayerCount = clampNumber(url.searchParams.get("players"), 1, MAX_PLAYERS);
    const spectate = url.searchParams.get("spectate") === "1";
    if (this.roomState.closed) {
      return json({ error: "Room closed" }, 410);
    }
    if (this.roomState.phase === "lobby" && Object.keys(this.roomState.players).length === 0) {
      this.roomState.targetPlayerCount = targetPlayerCount;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    await this.acceptPlayer(server, player, spectate);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async loadRoomState() {
    if (this.loaded) return;
    const stored = await this.state.storage.get("roomState");
    if (stored) {
      this.roomState = {
        ...this.roomState,
        ...stored,
        players: stored.players || {},
        nodes: stored.nodes || cloneNodes(),
      };
    }
    this.loaded = true;
  }

  async persistRoomState() {
    await this.state.storage.put("roomState", this.roomState);
  }

  async acceptPlayer(socket, player, spectate = false) {
    socket.accept();
    const playerId = player.id;
    this.sessions.set(socket, playerId);
    const existingPlayer = this.roomState.players[playerId];
    const activePlayers = Object.values(this.roomState.players).filter((player) => !player.spectator);
    const isSpectator = existingPlayer
      ? existingPlayer.spectator
      : spectate || this.roomState.phase !== "lobby" || activePlayers.length >= this.roomState.targetPlayerCount;
    this.roomState.players[playerId] ||= {
      id: playerId,
      login: player.login,
      avatarUrl: player.avatarUrl,
      joinedAt: Date.now(),
      role: existingPlayer?.role || this.nextRole(),
      x: 42,
      y: 178,
      score: 0,
      roundScore: 0,
      ready: false,
      spectator: isSpectator,
    };
    this.roomState.players[playerId].connected = true;
    delete this.roomState.players[playerId].disconnectedAt;
    if (!this.roomState.ownerId && !this.roomState.players[playerId].spectator) {
      this.roomState.ownerId = playerId;
    }
    await this.persistRoomState();

    socket.send(
      JSON.stringify({
        type: "welcome",
        playerId,
        state: this.roomState,
      }),
    );
    this.broadcastState("player:joined", socket);

    socket.addEventListener("message", (event) => {
      this.handleMessage(socket, event.data).catch(() => {
        socket.send(JSON.stringify({ type: "error", error: "Message handling failed" }));
      });
    });

    const leave = () => {
      this.handleLeave(socket, playerId).catch(() => {});
    };
    socket.addEventListener("close", leave);
    socket.addEventListener("error", leave);
  }

  async handleLeave(socket, playerId) {
    this.sessions.delete(socket);
    const hasOtherSession = Array.from(this.sessions.values()).some((sessionPlayerId) => sessionPlayerId === playerId);
    if (!hasOtherSession) {
      const leavingPlayer = this.roomState.players[playerId];
      if (leavingPlayer && !leavingPlayer.spectator && this.roomState.phase !== "lobby") {
        leavingPlayer.connected = false;
        leavingPlayer.disconnectedAt = Date.now();
        if (this.roomState.ownerId === playerId) {
          this.roomState.ownerId = Object.values(this.roomState.players).find(
            (nextPlayer) => !nextPlayer.spectator && nextPlayer.connected !== false,
          )?.id || null;
        }
      } else {
        delete this.roomState.players[playerId];
        delete this.roomState.replayVotes[playerId];
        if (this.roomState.ownerId === playerId) {
          this.roomState.ownerId = Object.values(this.roomState.players).find((nextPlayer) => !nextPlayer.spectator)?.id || null;
        }
      }
      await this.persistRoomState();
    }
    this.broadcastState("player:left");
  }

  async handleMessage(socket, rawMessage) {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      socket.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }

    const playerId = this.sessions.get(socket);
    if (!playerId) return;
    await this.advanceTimedPhase();

    if (message.type === "ready" || message.type === "player:ready") {
      if (this.roomState.players[playerId].spectator) return;
      if (this.roomState.phase !== "lobby") return;
      this.roomState.players[playerId].ready = Boolean(message.ready);
      await this.maybeStartRun();
      await this.persistRoomState();
      this.broadcastState("room:state");
      return;
    }

    if (message.type === "replay") {
      if (this.roomState.phase !== "end") return;
      const player = this.roomState.players[playerId];
      if (!player || player.spectator) return;
      this.roomState.replayVotes[playerId] = true;
      await this.maybeReplayRun();
      await this.persistRoomState();
      this.broadcastState("room:state");
      return;
    }

    if (message.type === "end-game") {
      if (this.roomState.ownerId !== playerId) return;
      await this.closeRoom();
      return;
    }

    if (message.type === "move" || message.type === "player:move") {
      if (this.roomState.players[playerId].spectator) return;
      if (this.roomState.phase !== "repair") return;
      await this.updatePlayerPosition(playerId, message);
      await this.persistRoomState();
      this.broadcastState("room:state");
      return;
    }

  }

  async maybeStartRun() {
    const players = Object.values(this.roomState.players).filter((player) => !player.spectator);
    if (this.roomState.phase !== "lobby" || players.length === 0) return;
    if (players.length < this.roomState.targetPlayerCount) return;
    if (!players.every((player) => player.ready)) return;
    await this.startRun(true);
  }

  async maybeReplayRun() {
    const players = Object.values(this.roomState.players).filter((player) => !player.spectator && player.connected !== false);
    if (players.length === 0) return;
    if (!players.every((player) => this.roomState.replayVotes[player.id])) return;
    await this.startRun(false);
  }

  async startRun(resetScores) {
    const players = Object.values(this.roomState.players).filter((player) => !player.spectator);
    this.roomState.cycle += 1;
    this.roomState.startedAt = Date.now();
    this.roomState.nodes = cloneNodes();
    this.roomState.score = 0;
    this.roomState.summary = null;
    this.roomState.blast = makeBlast();
    this.roomState.replayVotes = {};
    this.roomState.closed = false;
    this.roomState.countdownEndsAt = Date.now() + ROUND_COUNTDOWN_MS;
    const spawns = safePlayerSpawns(this.roomState.blast, players.length);
    for (const player of players) {
      if (resetScores) {
        player.score = 0;
      }
      const spawn = spawns.shift() || { x: 42, y: 178 };
      player.x = spawn.x;
      player.y = spawn.y;
      player.roundScore = 0;
      player.caughtInBlast = false;
      player.ready = false;
    }
    await this.setPhase("repair", ROUND_COUNTDOWN_MS);
    await this.persistRoomState();
  }

  async updatePlayerPosition(playerId, message) {
    const player = this.roomState.players[playerId];
    if (!player) return;

    player.x = clampNumber(message.x, 0, 384);
    player.y = clampNumber(message.y, 0, 216);
    await this.updateNodeClaims(playerId);
  }

  async updateNodeClaims(playerId = null) {
    if (this.roomState.phase !== "repair") return;

    const now = Date.now();
    for (const node of this.roomState.nodes) {
      if (!node.claimedBy || node.repaired) continue;
      const claimant = this.roomState.players[node.claimedBy];
      if (!claimant || !isInsideNode(claimant, node)) {
        delete node.claimedBy;
        delete node.claimedAt;
        delete node.claimEndsAt;
        continue;
      }
      if (now >= node.claimEndsAt) {
        await this.repairNode(node, claimant);
      }
    }

    if (!playerId) return;
    const player = this.roomState.players[playerId];
    if (!player) return;
    if (this.roomState.nodes.some((node) => node.claimedBy === playerId && !node.repaired)) return;

    const node = this.roomState.nodes
      .filter((candidate) => !candidate.repaired && !candidate.claimedBy && isInsideNode(player, candidate))
      .sort((a, b) => distanceToNode(player, a) - distanceToNode(player, b))[0];
    if (!node) return;

    node.claimedBy = playerId;
    node.claimedAt = now;
    node.claimEndsAt = now + node.holdMs;
    await this.scheduleNextRepairAlarm();
  }

  async repairNode(node, player) {
    node.repaired = true;
    node.repairedBy = player.id;
    node.repairedAt = Date.now();
    delete node.claimedBy;
    delete node.claimedAt;
    delete node.claimEndsAt;
    player.score = roundValue((player.score || 0) + node.value);
    player.roundScore = roundValue((player.roundScore || 0) + node.value);
    this.roomState.score = roundValue(this.roomState.score + node.value);
    this.roomState.countdownEndsAt += Math.round(node.value * 1000);
    if (this.roomState.countdownEndsAt < Date.now()) {
      this.roomState.countdownEndsAt = Date.now();
    }
    await this.scheduleNextRepairAlarm();
    await this.advanceTimedPhase();
    await this.persistRoomState();
  }

  async alarm() {
    await this.advanceTimedPhase(true);
    this.broadcastState("phase:changed");
  }

  async advanceTimedPhase(fromAlarm = false) {
    const phaseStartedAt = this.roomState.phaseStartedAt;
    if (!phaseStartedAt || this.roomState.phase === "lobby") return;

    const elapsed = Date.now() - phaseStartedAt;
    await this.updateNodeClaims();
    if (this.roomState.phase === "repair" && Date.now() >= this.roomState.countdownEndsAt) {
      this.applyBlast();
      await this.setPhase("explosion", EXPLOSION_DURATION_MS);
    } else if (this.roomState.phase === "explosion" && elapsed >= EXPLOSION_DURATION_MS) {
      this.createSummary();
      await this.setPhase("end");
    } else if (fromAlarm) {
      if (this.roomState.phase === "repair") {
        await this.scheduleNextRepairAlarm();
      }
      this.broadcastState("room:state");
    }
  }

  async setPhase(phase, durationMs = null) {
    this.roomState.phase = phase;
    this.roomState.phaseStartedAt = Date.now();
    await this.persistRoomState();
    if (durationMs) {
      await this.state.storage.setAlarm(Date.now() + durationMs + 50);
    }
  }

  async scheduleNextRepairAlarm() {
    if (this.roomState.phase !== "repair") return;
    const claimEndsAt = this.roomState.nodes
      .filter((node) => node.claimedBy && !node.repaired)
      .map((node) => node.claimEndsAt)
      .filter(Boolean);
    await this.state.storage.setAlarm(Math.min(this.roomState.countdownEndsAt, ...claimEndsAt) + 50);
  }

  applyBlast() {
    const blast = this.roomState.blast || makeBlast();
    for (const player of Object.values(this.roomState.players)) {
      const caught = Math.hypot(player.x - blast.x, player.y - blast.y) <= blast.radius;
      player.caughtInBlast = caught;
      if (caught) {
        player.score = 0;
        player.roundScore = 0;
      }
    }
  }

  createSummary() {
    this.roomState.summary = Object.values(this.roomState.players)
      .filter((player) => !player.spectator)
      .map((player) => ({
        id: player.id,
        score: roundValue(player.score),
        roundScore: roundValue(player.roundScore || 0),
        caughtInBlast: Boolean(player.caughtInBlast),
      }))
      .sort((a, b) => b.score - a.score);
  }

  async closeRoom() {
    this.roomState.closed = true;
    this.roomState.phase = "closed";
    this.roomState.replayVotes = {};
    await this.persistRoomState();
    this.broadcast({ type: "room:closed", state: this.roomState });
  }

  roomSummary() {
    const players = Object.values(this.roomState.players);
    const activePlayers = players.filter((player) => !player.spectator);
    const spectatorPlayers = players.filter((player) => player.spectator);
    return {
      id: this.roomState.id,
      phase: this.roomState.phase,
      targetPlayerCount: this.roomState.targetPlayerCount,
      activeCount: activePlayers.length,
      spectatorCount: spectatorPlayers.length,
      activePlayerIds: activePlayers.map((player) => player.id),
      spectatorPlayerIds: spectatorPlayers.map((player) => player.id),
      openSlots: Math.max(0, this.roomState.targetPlayerCount - activePlayers.length),
      ownerId: this.roomState.ownerId,
      closed: Boolean(this.roomState.closed),
      cycle: this.roomState.cycle,
    };
  }

  nextRole() {
    const roles = ["rifleman", "scout", "heavy", "engineer"];
    const usedRoles = new Set(Object.values(this.roomState.players).filter((player) => !player.spectator).map((player) => player.role));
    return roles.find((role) => !usedRoles.has(role)) || roles[0];
  }

  broadcastState(type, exceptSocket = null) {
    this.broadcast({ type, state: this.roomState }, exceptSocket);
  }

  broadcast(message, exceptSocket = null) {
    const payload = JSON.stringify(message);
    for (const socket of this.sessions.keys()) {
      if (socket !== exceptSocket) {
        socket.send(payload);
      }
    }
  }
}

export class RoomDirectory {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const roomIds = new Set((await this.state.storage.get("roomIds")) || []);

    if (request.method === "GET") {
      return json({ roomIds: [...roomIds] });
    }

    const roomId = url.searchParams.get("roomId");
    if (!roomId || !ROOM_ID_PATTERN.test(roomId)) {
      return json({ error: "Invalid room id" }, 400);
    }

    if (request.method === "POST") {
      roomIds.add(roomId);
      await this.state.storage.put("roomIds", [...roomIds]);
      return json({ ok: true });
    }

    if (request.method === "DELETE") {
      roomIds.delete(roomId);
      await this.state.storage.put("roomIds", [...roomIds]);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  }
}

function cloneNodes() {
  assertNodeSpacing(START_NODES);
  const bonusNodeIds = chooseBonusNodeIds();
  return START_NODES.map((node, index) => {
    const bonus = bonusNodeIds.has(node.id);
    const value = nodeValue(node, bonus);
    return {
      ...node,
      repaired: false,
      bonus,
      negative: value < 0,
      value,
      radius: nodeRadius(value, bonus),
      holdMs: nodeHoldMs(value),
      seed: Math.random() + index,
    };
  });
}

function chooseBonusNodeIds() {
  const count = NODE_BONUS_COUNT_MIN + Math.floor(Math.random() * (NODE_BONUS_COUNT_MAX - NODE_BONUS_COUNT_MIN + 1));
  const shuffled = shuffle(START_NODES);
  return new Set(shuffled.slice(0, count).map((node) => node.id));
}

function assertNodeSpacing(nodes) {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < NODE_MIN_DISTANCE) {
        throw new Error(`Repair nodes ${nodes[i].id} and ${nodes[j].id} are too close`);
      }
    }
  }
}

function nodeValue(node, bonus = false) {
  const sign = Math.random() < NODE_NEGATIVE_CHANCE ? -1 : 1;
  const magnitude = bonus
    ? NODE_BONUS_VALUE_MIN + Math.random() * (NODE_BONUS_VALUE_MAX - NODE_BONUS_VALUE_MIN)
    : regularNodeValue(node);
  return roundValue(magnitude * sign);
}

function regularNodeValue(node) {
  const distance = Math.hypot(node.x - BLAST_CENTER.x, node.y - BLAST_CENTER.y);
  const falloff = (distance - NODE_MAX_VALUE_DISTANCE) / (NODE_MIN_VALUE_DISTANCE - NODE_MAX_VALUE_DISTANCE);
  const closeness = 1 - clampNumber(falloff, 0, 1);
  return clampNumber(NODE_VALUE_MIN + closeness * (NODE_VALUE_MAX - NODE_VALUE_MIN), NODE_VALUE_MIN, NODE_VALUE_MAX);
}

function nodeRadius(value, bonus = false) {
  if (bonus) return NODE_REPAIR_RADIUS_MAX;
  const magnitude = Math.abs(value);
  const scale = (magnitude - NODE_VALUE_MIN) / (NODE_VALUE_MAX - NODE_VALUE_MIN);
  return Math.round(NODE_REPAIR_RADIUS_MIN + scale * (NODE_REPAIR_RADIUS_MAX - NODE_REPAIR_RADIUS_MIN));
}

function nodeHoldMs(value) {
  return Math.round(Math.abs(value) * NODE_HOLD_SECONDS_PER_POINT * 1000);
}

function isInsideNode(player, node) {
  return distanceToNode(player, node) <= node.radius;
}

function distanceToNode(player, node) {
  return Math.hypot(player.x - node.x, player.y - node.y);
}

function roundValue(value) {
  return Number(value.toFixed(NODE_VALUE_DECIMALS));
}

function makeBlast() {
  return {
    x: BLAST_CENTER.x,
    y: BLAST_CENTER.y,
    radius: BLAST_RADIUS_BASE + Math.round((Math.random() * 2 - 1) * BLAST_RADIUS_JITTER),
  };
}

function safePlayerSpawns(blast, count) {
  const safeDistance = blast.radius + 12;
  const safe = shuffle(PLAYER_SPAWNS).filter((spawn) => Math.hypot(spawn.x - blast.x, spawn.y - blast.y) > safeDistance);
  if (safe.length >= count) return safe;
  return [...safe, ...shuffle(PLAYER_SPAWNS).filter((spawn) => !safe.includes(spawn))];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getDirectory(env) {
  return env.DIRECTORY.get(env.DIRECTORY.idFromName("global"));
}

async function registerRoom(env, roomId) {
  try {
    await getDirectory(env).fetch(`https://internal/directory?roomId=${roomId}`, { method: "POST" });
  } catch {
    // Direct room links still work if the directory is temporarily unavailable.
  }
}

async function forgetRoom(env, roomId) {
  try {
    await getDirectory(env).fetch(`https://internal/directory?roomId=${roomId}`, { method: "DELETE" });
  } catch {
    // Stale rooms are harmless; the next listing pass can try again.
  }
}

async function listRoomIds(env) {
  try {
    const response = await getDirectory(env).fetch("https://internal/directory");
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload.roomIds) ? payload.roomIds : [];
  } catch {
    return [];
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "power-plant-run-demo",
      });
    }

    if (url.pathname === "/api/auth/config") {
      return json({
        githubClientConfigured: Boolean(env.GITHUB_CLIENT_ID),
        callbackPath: env.GITHUB_OAUTH_CALLBACK_PATH,
      });
    }

    if (url.pathname === "/api/auth/github/login") {
      return startGithubLogin(request, env);
    }

    if (url.pathname === env.GITHUB_OAUTH_CALLBACK_PATH) {
      return finishGithubLogin(request, env);
    }

    if (url.pathname === "/api/auth/me") {
      const session = await readSession(request, env);
      return json({
        authenticated: Boolean(session),
        user: session?.user || null,
      });
    }

    if (url.pathname === "/api/auth/logout") {
      return redirect("/", {
        "Set-Cookie": expireCookie(SESSION_COOKIE),
      });
    }

    if (url.pathname === "/api/rooms" && request.method === "GET") {
      const session = await readSession(request, env);
      if (!session) {
        return json({ error: "Sign in required" }, 401);
      }

      const rooms = [];
      for (const roomId of await listRoomIds(env)) {
        try {
          const objectId = env.ROOMS.idFromName(roomId);
          const room = env.ROOMS.get(objectId);
          const statusResponse = await room.fetch(
            new Request(`https://internal/api/rooms/${roomId}`, {
              headers: { "X-PPR-Room-Status": "1" },
            }),
          );
          if (!statusResponse.ok) continue;
          const status = await statusResponse.json();
          if (status.room?.closed) {
            await forgetRoom(env, roomId);
          } else if (status.room?.activeCount > 0 || status.room?.phase !== "lobby") {
            const viewerId = sanitizePlayerId(session.user.login);
            rooms.push({
              ...status.room,
              viewerRole: status.room.activePlayerIds?.includes(viewerId)
                ? "active"
                : status.room.spectatorPlayerIds?.includes(viewerId)
                  ? "spectator"
                  : "none",
            });
          }
        } catch {
          // One bad room must not take down the whole directory.
        }
      }

      rooms.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return json({ rooms });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const session = await readSession(request, env);
      if (!session) {
        return json({ error: "Sign in required" }, 401);
      }

      let targetPlayerCount = 2;
      try {
        const payload = await request.json();
        targetPlayerCount = clampNumber(payload.playerCount, 1, MAX_PLAYERS);
      } catch {
        targetPlayerCount = 2;
      }
      const roomId = crypto.randomUUID().slice(0, 8);
      await registerRoom(env, roomId);
      return json({
        roomId,
        targetPlayerCount,
        websocketPath: `/ws/rooms/${roomId}`,
      });
    }

    const roomMatch = url.pathname.match(/^\/(?:api|ws)\/rooms\/([^/]+)$/);
    if (roomMatch) {
      const roomId = roomMatch[1].toLowerCase();
      if (!ROOM_ID_PATTERN.test(roomId)) {
        return json({ error: "Invalid room id" }, 400);
      }

      await registerRoom(env, roomId);
      const objectId = env.ROOMS.idFromName(roomId);
      const room = env.ROOMS.get(objectId);
      return room.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

function sanitizePlayerId(value) {
  if (!value || !PLAYER_ID_PATTERN.test(value)) return null;
  return value;
}

function startGithubLogin(request, env) {
  if (!env.GITHUB_CLIENT_ID) {
    return json({ error: "GitHub OAuth is not configured" }, 503);
  }

  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));
  const callbackUrl = new URL(env.GITHUB_OAUTH_CALLBACK_PATH, url.origin);
  const githubUrl = new URL(GITHUB_AUTHORIZE_URL);
  githubUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  githubUrl.searchParams.set("scope", "read:user");
  githubUrl.searchParams.set("state", state);

  return redirect(githubUrl.toString(), {
    "Set-Cookie": [
      buildCookie(STATE_COOKIE, state, {
        maxAge: 600,
        httpOnly: true,
        sameSite: "Lax",
        secure: url.protocol === "https:",
      }),
      buildCookie(NEXT_COOKIE, nextPath, {
        maxAge: 600,
        httpOnly: true,
        sameSite: "Lax",
        secure: url.protocol === "https:",
      }),
    ],
  });
}

async function finishGithubLogin(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json({ error: "GitHub OAuth is not configured" }, 503);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = getCookie(request, STATE_COOKIE);
  const nextPath = sanitizeNextPath(getCookie(request, NEXT_COOKIE));

  if (!code || !state || state !== expectedState) {
    return json({ error: "Invalid OAuth callback" }, 400);
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "power-plant-run-demo",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: new URL(env.GITHUB_OAUTH_CALLBACK_PATH, url.origin).toString(),
    }),
  });
  const tokenPayload = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return json({ error: "GitHub token exchange failed" }, 502);
  }

  const userResponse = await fetch(GITHUB_USER_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenPayload.access_token}`,
      "User-Agent": "power-plant-run-demo",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const githubUser = await userResponse.json();

  if (!userResponse.ok) {
    return json({ error: "GitHub profile lookup failed" }, 502);
  }

  const sessionValue = await signSession(
    {
      user: {
        id: githubUser.id,
        login: githubUser.login,
        avatarUrl: githubUser.avatar_url,
      },
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    },
    env,
  );

  return redirect(nextPath, {
    "Set-Cookie": [
      buildCookie(SESSION_COOKIE, sessionValue, {
        maxAge: SESSION_MAX_AGE,
        httpOnly: true,
        sameSite: "Lax",
        secure: url.protocol === "https:",
      }),
      expireCookie(STATE_COOKIE, url.protocol === "https:"),
      expireCookie(NEXT_COOKIE, url.protocol === "https:"),
    ],
  });
}

async function readSession(request, env) {
  if (!env.GITHUB_CLIENT_SECRET) return null;

  const rawSession = getCookie(request, SESSION_COOKIE);
  if (!rawSession) return null;

  const [payload, signature] = rawSession.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = await signValue(payload, env.GITHUB_CLIENT_SECRET);
  if (signature !== expectedSignature) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload));
    if (!session.exp || session.exp < Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}

async function getAuthenticatedPlayer(request, env) {
  const session = await readSession(request, env);
  const login = session?.user?.login;
  const id = sanitizePlayerId(login);
  if (!id) return null;

  return {
    id,
    login,
    avatarUrl: session.user.avatarUrl || "",
  };
}

async function signSession(session, env) {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = await signValue(payload, env.GITHUB_CLIENT_SECRET);
  return `${payload}.${signature}`;
}

async function signValue(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function sanitizeNextPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value.slice(0, 160);
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/"];
  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function expireCookie(name, secure = true) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax`;
}

function redirect(location, headers = {}) {
  const responseHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) responseHeaders.append(name, item);
    } else {
      responseHeaders.set(name, value);
    }
  }
  responseHeaders.set("Location", location);

  return new Response(null, {
    status: 302,
    headers: responseHeaders,
  });
}

function base64UrlEncode(value) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
