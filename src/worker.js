const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
const PLAYER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const SESSION_COOKIE = "ppr_session";
const STATE_COOKIE = "ppr_oauth_state";
const NEXT_COOKIE = "ppr_oauth_next";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const BOOTSTRAP_ADMIN_LOGINS = ["cheshirecode"];
const ROUND_COUNTDOWN_MS = 15_000;
const EXPLOSION_DURATION_MS = 3_300;
const NODE_VALUE_MIN = 1.5;
const NODE_VALUE_MAX = 6;
const NODE_BONUS_VALUE_MIN = 7;
const NODE_BONUS_VALUE_MAX = 9;
const NODE_BONUS_COUNT_MIN = 3;
const NODE_BONUS_COUNT_MAX = 4;
const NODE_NEGATIVE_CHANCE = 0.32;
const NODE_INITIAL_COUNT = 20;
const NODE_RESPAWN_MS = 3_000;
const NODE_HOLD_SECONDS_PER_POINT = 0.5;
const NODE_SIZE_MIN = 7;
const NODE_SIZE_MAX = 10;
const NODE_MIN_DISTANCE = 36;
const NODE_MAX_VALUE_DISTANCE = 60;
const NODE_MIN_VALUE_DISTANCE = 360;
const NODE_VALUE_DECIMALS = 2;
const WORLD_WIDTH = 768;
const WORLD_HEIGHT = 432;
const BLAST_CENTER = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
const BLAST_RADIUS_BASE = 115;
const BLAST_RADIUS_JITTER = 13;
const NODE_RED_EXCLUSION_RADIUS = BLAST_RADIUS_BASE + BLAST_RADIUS_JITTER;
const MAX_PLAYERS = 4;
const BOT_ID = "bot-1";
const BOT_TICK_MS = 90;
const BOT_STEP = 5.2;
const BOT_ESCAPE_THRESHOLD_MS = 3_750;
const BOT_POSITIVE_THRESHOLD_MS = 7_500;
const PLAYER_CLAIM_HALF_WIDTH = 4;
const PLAYER_CLAIM_HEIGHT = 11;
const PLAYER_STATE_ALIVE = "alive";
const PLAYER_STATE_INCAPACITATED = "incapacitated";
const START_NODES = [
  { id: "n1", x: 70, y: 348 },
  { id: "n2", x: 96, y: 172 },
  { id: "n3", x: 132, y: 74 },
  { id: "n4", x: 164, y: 286 },
  { id: "n5", x: 214, y: 130 },
  { id: "n6", x: 236, y: 382 },
  { id: "n7", x: 284, y: 252 },
  { id: "n8", x: 292, y: 64 },
  { id: "n9", x: 342, y: 180 },
  { id: "n10", x: 344, y: 330 },
  { id: "n11", x: 384, y: 112 },
  { id: "n12", x: 428, y: 174 },
  { id: "n13", x: 430, y: 306 },
  { id: "n14", x: 488, y: 72 },
  { id: "n15", x: 508, y: 244 },
  { id: "n16", x: 534, y: 370 },
  { id: "n17", x: 592, y: 130 },
  { id: "n18", x: 610, y: 292 },
  { id: "n19", x: 676, y: 80 },
  { id: "n20", x: 704, y: 214 },
  { id: "n21", x: 704, y: 360 },
  { id: "n22", x: 360, y: 252 },
  { id: "n23", x: 468, y: 216 },
  { id: "n24", x: 304, y: 214 },
];
const PLAYER_SPAWNS = [
  { x: 44, y: 372 },
  { x: 56, y: 58 },
  { x: 126, y: 402 },
  { x: 148, y: 42 },
  { x: 256, y: 408 },
  { x: 36, y: 232 },
  { x: 728, y: 48 },
  { x: 728, y: 390 },
  { x: 620, y: 410 },
  { x: 728, y: 144 },
  { x: 604, y: 36 },
  { x: 390, y: 402 },
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
      botEnabled: false,
      roundBanked: false,
    };
  }

  async fetch(request) {
    await this.loadRoomState();
    await this.advanceTimedPhase();
    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/(?:api|ws)\/rooms\/([^/]+)$/);
    const adminRoomMatch = url.pathname.match(/^\/internal\/admin\/rooms\/([^/]+)$/);
    if (adminRoomMatch && !this.roomState.id) {
      this.roomState.id = adminRoomMatch[1].toLowerCase();
      await this.persistRoomState();
    }
    if (roomMatch && !this.roomState.id) {
      this.roomState.id = roomMatch[1].toLowerCase();
      await this.persistRoomState();
    }
    if (adminRoomMatch && request.headers.get("X-PPR-Internal-Admin") === "1") {
      if (request.method === "GET") {
        return json({ ok: true, room: this.roomState, summary: this.roomSummary() });
      }
      if (request.method === "POST") {
        let payload = {};
        try {
          payload = await request.json();
        } catch {
          payload = {};
        }
        if (this.roomState.phase !== "lobby" || Object.keys(this.roomState.players).length > 0) {
          return json({ error: "Only empty lobby rooms can be configured" }, 409);
        }
        this.roomState.targetPlayerCount = clampNumber(payload.playerCount, 1, MAX_PLAYERS);
        this.roomState.botEnabled = Boolean(payload.botEnabled);
        await this.persistRoomState();
        return json({ ok: true, room: this.roomState, summary: this.roomSummary() });
      }
      if (request.method === "DELETE") {
        await this.closeRoom();
        return json({ ok: true, room: this.roomSummary() });
      }
      return json({ error: "Method not allowed" }, 405);
    }
    if (request.headers.get("X-PPR-Room-Status") === "1") {
      return json({ ok: true, room: this.roomSummary() });
    }

    const player = await getAuthenticatedPlayer(request, this.env);
    if (!player) {
      return json({ error: "Sign in required" }, 401);
    }

    if (request.method === "DELETE") {
      if (this.roomState.closed) {
        return json({ ok: true, room: this.roomSummary() });
      }
      if (this.roomState.phase === "end") {
        await this.closeRoom();
        return json({ ok: true, room: this.roomSummary() });
      }
      if (this.roomState.ownerId && this.roomState.ownerId !== player.id) {
        return json({ error: "Only the session owner can end this room" }, 403);
      }
      await this.closeRoom();
      return json({ ok: true, room: this.roomSummary() });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return json({
        ok: true,
        room: this.roomState,
      });
    }

    const targetPlayerCount = clampNumber(url.searchParams.get("players"), 1, MAX_PLAYERS);
    const spectate = url.searchParams.get("spectate") === "1";
    const botEnabled = url.searchParams.get("bot") === "1";
    if (this.roomState.closed) {
      return json({ error: "Room closed" }, 410);
    }
    if (this.roomState.phase === "lobby" && Object.keys(this.roomState.players).length === 0) {
      this.roomState.targetPlayerCount = targetPlayerCount;
      this.roomState.botEnabled = botEnabled;
      if (botEnabled) {
        this.ensureBotPlayer();
      }
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
    const activePlayers = Object.values(this.roomState.players).filter((player) => !player.spectator && !player.bot);
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
      state: PLAYER_STATE_ALIVE,
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

    if (message.type === "end-game" || message.type === "end-session") {
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
    const players = this.activeHumanPlayers();
    if (this.roomState.phase !== "lobby" || players.length === 0) return;
    if (players.length < this.roomState.targetPlayerCount) return;
    if (!players.every((player) => player.ready)) return;
    await this.startRun(true);
  }

  async maybeReplayRun() {
    const players = this.activeHumanPlayers().filter((player) => player.connected !== false);
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
    this.roomState.roundBanked = false;
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
      player.state = PLAYER_STATE_ALIVE;
      player.ready = Boolean(player.bot);
      delete player.botTargetNodeId;
    }
    await this.setPhase("repair", ROUND_COUNTDOWN_MS);
    await this.scheduleNextRepairAlarm();
    await this.persistRoomState();
  }

  async updatePlayerPosition(playerId, message) {
    const player = this.roomState.players[playerId];
    if (!player) return;

    player.x = clampNumber(message.x, 0, WORLD_WIDTH);
    player.y = clampNumber(message.y, 0, WORLD_HEIGHT);
    await this.updateNodeClaims(playerId);
  }

  async updateNodeClaims(playerId = null) {
    if (this.roomState.phase !== "repair") return;

    const now = Date.now();
    const activeNodes = this.activeNodes();
    for (const node of activeNodes) {
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
    if (activeNodes.some((node) => node.claimedBy === playerId && !node.repaired)) return;

    const node = activeNodes
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
    const scoreValue = Math.abs(node.value);
    player.roundScore = roundValue((player.roundScore || 0) + scoreValue);
    this.roomState.score = roundValue(this.roomState.score + scoreValue);
    this.roomState.countdownEndsAt += Math.round(node.value * 1500);
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
    await this.updateBotPlayer();
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
    const bot = this.roomState.players[BOT_ID];
    const botTick = bot && !bot.spectator ? Date.now() + BOT_TICK_MS : null;
    const nextSpawn = this.nextNodeSpawnAt();
    const nextTimes = [this.roomState.countdownEndsAt, ...claimEndsAt, botTick, nextSpawn].filter(Boolean);
    await this.state.storage.setAlarm(Math.min(...nextTimes) + 50);
  }

  activeNodes(now = Date.now()) {
    return this.roomState.nodes.filter((node) => isNodeSpawned(node, this.roomState.phaseStartedAt, now));
  }

  nextNodeSpawnAt(now = Date.now()) {
    if (this.roomState.phase !== "repair" || !this.roomState.phaseStartedAt) return null;
    const nextNode = this.roomState.nodes
      .filter((node) => !isNodeSpawned(node, this.roomState.phaseStartedAt, now))
      .sort((a, b) => (a.spawnedAt || 0) - (b.spawnedAt || 0))[0];
    return nextNode ? this.roomState.phaseStartedAt + (nextNode.spawnedAt || 0) : null;
  }

  async updateBotPlayer() {
    if (this.roomState.phase !== "repair") return;
    if (Date.now() >= this.roomState.countdownEndsAt) return;
    const bot = this.roomState.players[BOT_ID];
    if (!bot || bot.spectator) return;

    const target = this.getBotTarget(bot);
    if (!target) return;

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.5) {
      const step = Math.min(distance, BOT_STEP);
      bot.x = Math.round(bot.x + (dx / distance) * step);
      bot.y = Math.round(bot.y + (dy / distance) * step);
    }

    await this.updateNodeClaims(BOT_ID);
    await this.persistRoomState();
  }

  getBotTarget(bot) {
    const now = Date.now();
    const remainingMs = Math.max(0, (this.roomState.countdownEndsAt || now) - now);
    const activeNodes = this.activeNodes(now);
    const activeClaim = activeNodes.find((node) => node.claimedBy === bot.id && !node.repaired);
    if (activeClaim && remainingMs > BOT_ESCAPE_THRESHOLD_MS) {
      bot.botTargetNodeId = activeClaim.id;
      return activeClaim;
    }

    if (remainingMs <= BOT_ESCAPE_THRESHOLD_MS) {
      delete bot.botTargetNodeId;
      return safePlayerSpawns(this.roomState.blast || makeBlast(), 1)[0] || { x: 34, y: 184 };
    }

    const candidates = activeNodes.filter((node) => !node.repaired && !node.claimedBy);
    if (candidates.length === 0) return safePlayerSpawns(this.roomState.blast || makeBlast(), 1)[0] || null;

    const wantsSafety = remainingMs <= BOT_POSITIVE_THRESHOLD_MS;
    const target = candidates
      .map((node) => {
        const distance = distanceToNode(bot, node);
        const magnitude = Math.abs(node.value);
        const signBias = wantsSafety ? (node.value > 0 ? 42 : -58) : node.value < 0 ? 10 : 0;
        const valueScore = wantsSafety ? Math.max(0, node.value) * 18 : magnitude * 12;
        return { node, score: valueScore + signBias - distance / 4 };
      })
      .sort((a, b) => b.score - a.score)[0]?.node;

    if (target) {
      bot.botTargetNodeId = target.id;
    }
    return target || null;
  }

  applyBlast() {
    const blast = this.roomState.blast || makeBlast();
    for (const player of Object.values(this.roomState.players)) {
      const caught = Math.hypot(player.x - blast.x, player.y - blast.y) <= blast.radius;
      player.caughtInBlast = caught;
      if (caught) {
        player.roundScore = 0;
        player.state = PLAYER_STATE_INCAPACITATED;
      } else if (!player.spectator) {
        player.state = PLAYER_STATE_ALIVE;
      }
    }
  }

  createSummary() {
    if (!this.roomState.roundBanked) {
      for (const player of Object.values(this.roomState.players)) {
        if (player.spectator) continue;
        player.score = roundValue((player.score || 0) + (player.roundScore || 0));
      }
      this.roomState.roundBanked = true;
    }

    this.roomState.summary = Object.values(this.roomState.players)
      .filter((player) => !player.spectator)
      .map((player) => ({
        id: player.id,
        ability: player.ability || null,
        score: roundValue(player.score),
        previousScore: roundValue((player.score || 0) - (player.roundScore || 0)),
        roundScore: roundValue(player.roundScore || 0),
        caughtInBlast: Boolean(player.caughtInBlast),
        state: player.state || PLAYER_STATE_ALIVE,
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
    const activePlayers = players.filter((player) => !player.spectator && !player.bot);
    const botPlayers = players.filter((player) => !player.spectator && player.bot);
    const spectatorPlayers = players.filter((player) => player.spectator);
    return {
      id: this.roomState.id,
      phase: this.roomState.phase,
      targetPlayerCount: this.roomState.targetPlayerCount,
      activeCount: activePlayers.length,
      botCount: botPlayers.length,
      spectatorCount: spectatorPlayers.length,
      activePlayerIds: activePlayers.map((player) => player.id),
      spectatorPlayerIds: spectatorPlayers.map((player) => player.id),
      openSlots: Math.max(0, this.roomState.targetPlayerCount - activePlayers.length),
      ownerId: this.roomState.ownerId,
      closed: Boolean(this.roomState.closed),
      cycle: this.roomState.cycle,
      botEnabled: Boolean(this.roomState.botEnabled),
    };
  }

  activeHumanPlayers() {
    return Object.values(this.roomState.players).filter((player) => !player.spectator && !player.bot);
  }

  ensureBotPlayer() {
    this.roomState.botEnabled = true;
    this.roomState.players[BOT_ID] ||= {
      id: BOT_ID,
      login: "BOT",
      avatarUrl: "",
      joinedAt: Date.now(),
      role: "engineer",
      gender: "male",
      x: 34,
      y: 184,
      score: 0,
      roundScore: 0,
      state: PLAYER_STATE_ALIVE,
      ready: true,
      spectator: false,
      bot: true,
      connected: true,
    };
    this.roomState.players[BOT_ID].ready = true;
    this.roomState.players[BOT_ID].connected = true;
  }

  nextRole() {
    const roles = ["rifleman", "scout", "heavy", "engineer"];
    const usedRoles = new Set(Object.values(this.roomState.players).filter((player) => !player.spectator && !player.bot).map((player) => player.role));
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

export class AdminConfig {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== "/internal/admin/config") {
      return json({ error: "Not found" }, 404);
    }

    if (request.method === "GET") {
      return json({ logins: await this.readLogins() });
    }

    if (request.method === "PUT") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }

      const logins = normalizeAdminLogins(payload.logins);
      await this.state.storage.put("adminLogins", logins);
      return json({ ok: true, logins });
    }

    return json({ error: "Method not allowed" }, 405);
  }

  async readLogins() {
    return normalizeAdminLogins((await this.state.storage.get("adminLogins")) || []);
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
      spawnedAt: nodeSpawnedAt(index),
      bonus,
      negative: value < 0,
      value,
      size: nodeSize(value, bonus),
      holdMs: nodeHoldMs(value),
      seed: Math.random() + index,
    };
  });
}

function nodeSpawnedAt(index) {
  if (index < NODE_INITIAL_COUNT) return 0;
  return (index - NODE_INITIAL_COUNT + 1) * NODE_RESPAWN_MS;
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
  const sign = canNodeBeNegative(node) && Math.random() < NODE_NEGATIVE_CHANCE ? -1 : 1;
  const magnitude = bonus
    ? NODE_BONUS_VALUE_MIN + Math.random() * (NODE_BONUS_VALUE_MAX - NODE_BONUS_VALUE_MIN)
    : regularNodeValue(node);
  return roundValue(magnitude * sign);
}

function canNodeBeNegative(node) {
  return Math.hypot(node.x - BLAST_CENTER.x, node.y - BLAST_CENTER.y) > NODE_RED_EXCLUSION_RADIUS;
}

function regularNodeValue(node) {
  const distance = Math.hypot(node.x - BLAST_CENTER.x, node.y - BLAST_CENTER.y);
  const falloff = (distance - NODE_MAX_VALUE_DISTANCE) / (NODE_MIN_VALUE_DISTANCE - NODE_MAX_VALUE_DISTANCE);
  const closeness = 1 - clampNumber(falloff, 0, 1);
  return clampNumber(NODE_VALUE_MIN + closeness * (NODE_VALUE_MAX - NODE_VALUE_MIN), NODE_VALUE_MIN, NODE_VALUE_MAX);
}

function nodeSize(value, bonus = false) {
  if (bonus) return NODE_SIZE_MAX;
  const magnitude = Math.abs(value);
  const scale = (magnitude - NODE_VALUE_MIN) / (NODE_VALUE_MAX - NODE_VALUE_MIN);
  return Math.round(NODE_SIZE_MIN + scale * (NODE_SIZE_MAX - NODE_SIZE_MIN));
}

function nodeHoldMs(value) {
  return Math.round(Math.abs(value) * NODE_HOLD_SECONDS_PER_POINT * 1000);
}

function isNodeSpawned(node, phaseStartedAt, now = Date.now()) {
  if (!phaseStartedAt) return true;
  return now >= phaseStartedAt + (node.spawnedAt || 0);
}

function isInsideNode(player, node) {
  const nodeHalf = Math.ceil((node.size || NODE_SIZE_MIN) / 2);
  const playerLeft = player.x - PLAYER_CLAIM_HALF_WIDTH;
  const playerRight = player.x + PLAYER_CLAIM_HALF_WIDTH;
  const playerTop = player.y - PLAYER_CLAIM_HEIGHT;
  const playerBottom = player.y;
  const nodeLeft = node.x - nodeHalf;
  const nodeRight = node.x + nodeHalf;
  const nodeTop = node.y - nodeHalf;
  const nodeBottom = node.y + nodeHalf;
  return playerRight >= nodeLeft && playerLeft <= nodeRight && playerBottom >= nodeTop && playerTop <= nodeBottom;
}

function distanceToNode(player, node) {
  return Math.hypot(player.x - node.x, player.y - node.y);
}

function roundValue(value) {
  return Number(value.toFixed(NODE_VALUE_DECIMALS));
}

export const __ROOM_MECHANICS_DEBUG__ = {
  cloneNodes,
  center: BLAST_CENTER,
  redExclusionRadius: NODE_RED_EXCLUSION_RADIUS,
  initialNodeCount: NODE_INITIAL_COUNT,
  nodeRespawnMs: NODE_RESPAWN_MS,
  isNodeSpawned,
  regularNodeValue,
};

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

function getAdminConfig(env) {
  return env.ADMIN_CONFIG.get(env.ADMIN_CONFIG.idFromName("global"));
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

async function readAdminWhitelist(env) {
  try {
    const response = await getAdminConfig(env).fetch("https://internal/internal/admin/config");
    if (!response.ok) return [];
    const payload = await response.json();
    return normalizeAdminLogins(payload.logins);
  } catch {
    return [];
  }
}

async function writeAdminWhitelist(env, logins) {
  const response = await getAdminConfig(env).fetch("https://internal/internal/admin/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logins }),
  });
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload.error || "Admin whitelist update failed");
  }
  const payload = await response.json();
  return normalizeAdminLogins(payload.logins);
}

function normalizeAdminLogins(logins) {
  if (!Array.isArray(logins)) return [];
  return [
    ...new Set(
      logins
        .map((login) => String(login || "").trim().toLowerCase())
        .filter((login) => PLAYER_ID_PATTERN.test(login)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

async function requireAdmin(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    return { response: json({ error: "Sign in required" }, 401) };
  }

  const login = String(session.user?.login || "").toLowerCase();
  const whitelist = await readAdminWhitelist(env);
  const bootstrapLogins = normalizeAdminLogins(BOOTSTRAP_ADMIN_LOGINS);
  const isAdmin = bootstrapLogins.includes(login) || whitelist.includes(login);
  if (!isAdmin) {
    return { response: json({ error: "Admin access required" }, 403), session, whitelist };
  }

  return { session, login, whitelist, bootstrapLogins };
}

async function adminRoomState(env, roomId) {
  const room = env.ROOMS.get(env.ROOMS.idFromName(roomId));
  const response = await room.fetch(
    new Request(`https://internal/internal/admin/rooms/${roomId}`, {
      headers: { "X-PPR-Internal-Admin": "1" },
    }),
  );
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload.error || `Room ${roomId} unavailable`);
  }
  return response.json();
}

async function adminConfigureRoom(env, roomId, options) {
  const room = env.ROOMS.get(env.ROOMS.idFromName(roomId));
  const response = await room.fetch(
    new Request(`https://internal/internal/admin/rooms/${roomId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PPR-Internal-Admin": "1",
      },
      body: JSON.stringify(options),
    }),
  );
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload.error || `Room ${roomId} configure failed`);
  }
  return response.json();
}

async function adminDeleteRoom(env, roomId) {
  const room = env.ROOMS.get(env.ROOMS.idFromName(roomId));
  const response = await room.fetch(
    new Request(`https://internal/internal/admin/rooms/${roomId}`, {
      method: "DELETE",
      headers: { "X-PPR-Internal-Admin": "1" },
    }),
  );
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload.error || `Room ${roomId} delete failed`);
  }
  await forgetRoom(env, roomId);
  return response.json();
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
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

    if (url.pathname === "/admin" || url.pathname === "/admin.html") {
      return html(adminPage());
    }

    if (url.pathname === "/api/admin/me") {
      const admin = await requireAdmin(request, env);
      if (admin.response) return admin.response;
      return json({
        authenticated: true,
        admin: true,
        user: admin.session.user,
        bootstrapLogins: admin.bootstrapLogins,
      });
    }

    if (url.pathname === "/api/admin/whitelist") {
      const admin = await requireAdmin(request, env);
      if (admin.response) return admin.response;

      if (request.method === "GET") {
        return json({
          logins: admin.whitelist,
          bootstrapLogins: admin.bootstrapLogins,
        });
      }

      if (request.method === "PUT") {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const logins = normalizeAdminLogins(payload.logins);
        const savedLogins = await writeAdminWhitelist(env, logins);
        return json({
          ok: true,
          logins: savedLogins,
          bootstrapLogins: admin.bootstrapLogins,
        });
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/rooms" && request.method === "GET") {
      const admin = await requireAdmin(request, env);
      if (admin.response) return admin.response;

      const rooms = [];
      for (const roomId of await listRoomIds(env)) {
        try {
          const state = await adminRoomState(env, roomId);
          rooms.push({
            ...state.summary,
            closed: Boolean(state.summary?.closed),
          });
        } catch (error) {
          rooms.push({
            id: roomId,
            phase: "unavailable",
            error: error.message,
            closed: false,
          });
        }
      }
      rooms.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return json({ rooms });
    }

    if (url.pathname === "/api/admin/rooms" && request.method === "POST") {
      const admin = await requireAdmin(request, env);
      if (admin.response) return admin.response;

      let payload = {};
      try {
        payload = await request.json();
      } catch {
        payload = {};
      }
      const requestedRoomId = String(payload.roomId || "").trim().toLowerCase();
      const roomId = requestedRoomId || crypto.randomUUID().slice(0, 8);
      if (!ROOM_ID_PATTERN.test(roomId)) {
        return json({ error: "Invalid room id" }, 400);
      }

      await registerRoom(env, roomId);
      await adminConfigureRoom(env, roomId, {
        playerCount: payload.playerCount,
        botEnabled: payload.botEnabled,
      });
      return json({
        ok: true,
        roomId,
        targetPlayerCount: clampNumber(payload.playerCount, 1, MAX_PLAYERS),
        botEnabled: Boolean(payload.botEnabled),
      });
    }

    const adminRoomMatch = url.pathname.match(/^\/api\/admin\/rooms\/([^/]+)$/);
    if (adminRoomMatch) {
      const admin = await requireAdmin(request, env);
      if (admin.response) return admin.response;

      const roomId = adminRoomMatch[1].toLowerCase();
      if (!ROOM_ID_PATTERN.test(roomId)) {
        return json({ error: "Invalid room id" }, 400);
      }

      if (request.method === "GET") {
        return json(await adminRoomState(env, roomId));
      }

      if (request.method === "DELETE") {
        return json(await adminDeleteRoom(env, roomId));
      }

      return json({ error: "Method not allowed" }, 405);
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

      if (request.method !== "DELETE") {
        await registerRoom(env, roomId);
      }
      const objectId = env.ROOMS.idFromName(roomId);
      const room = env.ROOMS.get(objectId);
      const response = await room.fetch(request);
      if (request.method === "DELETE" && response.ok) {
        await forgetRoom(env, roomId);
      }
      return response;
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

function adminPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Power Plant Run Admin</title>
    <link rel="icon" href="./icons/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="./styles.css" />
    <style>
      .admin-shell{width:min(1480px,100%);margin:0 auto;padding:22px}.admin-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.admin-home{color:var(--muted);font-size:.74rem;text-decoration:none;text-transform:uppercase}.admin-auth{display:flex;align-items:center;justify-content:flex-end;gap:8px}.admin-auth span{max-width:220px;overflow:hidden;color:var(--muted);font-size:.78rem;text-overflow:ellipsis;white-space:nowrap}.admin-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:16px;align-items:start}.admin-panel{border:1px solid var(--border);background:color-mix(in srgb,var(--panel-bg) 90%,#000);box-shadow:0 16px 36px var(--shadow);padding:16px}.admin-state-panel{grid-column:1/-1}.admin-panel-header{display:flex;align-items:start;justify-content:space-between;gap:12px}.admin-panel h2{margin:0;font-size:1rem;line-height:1.1}.admin-panel p{margin:7px 0 0;color:var(--muted);font-size:.68rem;line-height:1.35}.admin-form{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:14px 0}.admin-form label{display:grid;gap:4px}.admin-form label span{color:var(--muted);font-size:.56rem;line-height:1;text-transform:uppercase}.admin-form input,.admin-form select{min-height:34px;border:1px solid color-mix(in srgb,var(--border) 78%,#000);background:color-mix(in srgb,var(--panel-strong) 78%,#000);color:var(--text);font:inherit;font-size:.74rem;padding:0 8px}.admin-form-wide{flex:1 1 180px}.admin-form-wide input{width:100%}.admin-check{display:inline-flex!important;grid-template-columns:auto auto;gap:7px!important;min-height:34px;align-items:center;padding:0 9px;border:1px solid color-mix(in srgb,var(--border) 78%,#000);background:color-mix(in srgb,var(--panel-strong) 62%,#000)}.admin-check input{min-height:0;accent-color:var(--accent)}.admin-table-wrap{overflow:auto}.admin-table{width:100%;min-width:760px;border-collapse:collapse}.admin-table th,.admin-table td{padding:8px;border-bottom:1px solid color-mix(in srgb,var(--border) 62%,#000);font-size:.62rem;line-height:1.25;text-align:left;vertical-align:middle}.admin-table th{color:var(--muted);font-size:.54rem;text-transform:uppercase}.admin-actions{display:flex;flex-wrap:wrap;gap:6px}.whitelist-list{display:grid;gap:6px}.whitelist-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid color-mix(in srgb,var(--border) 62%,#000);background:rgba(0,0,0,.25)}.whitelist-row span{min-width:0;overflow:hidden;font-size:.7rem;text-overflow:ellipsis;white-space:nowrap}#room-state-view{max-height:360px;overflow:auto;margin:14px 0 0;padding:12px;border:1px solid color-mix(in srgb,var(--border) 72%,#000);background:rgba(0,0,0,.36);color:var(--text);font-size:.62rem;line-height:1.45;white-space:pre-wrap}@media (max-width:980px){.admin-grid,.admin-state-panel{display:grid;grid-template-columns:1fr}.admin-state-panel{grid-column:auto}}@media (max-width:680px){.admin-shell{padding:14px}.admin-header{align-items:stretch;flex-direction:column}.admin-auth{justify-content:flex-start}}
    </style>
  </head>
  <body>
    <main class="admin-shell">
      <header class="admin-header">
        <div><a href="/" class="admin-home">Power Plant Run</a><h1>Room Admin</h1></div>
        <div class="admin-auth"><span id="admin-status">Checking access...</span><button class="control-button" type="button" id="admin-login-button"><span class="button-icon icon-github" aria-hidden="true"></span><span class="button-label">GitHub</span></button><button class="control-button is-hidden" type="button" id="admin-logout-button"><span class="button-icon icon-logout" aria-hidden="true"></span><span class="button-label">Logout</span></button></div>
      </header>
      <section class="admin-panel" id="admin-denied" hidden><h2>Admin access required</h2><p>Sign in with an authorized GitHub account to manage rooms.</p></section>
      <section class="admin-grid" id="admin-app" hidden>
        <section class="admin-panel">
          <div class="admin-panel-header"><div><h2>Rooms</h2><p id="rooms-note">Known room directory entries, including closed or stale sessions.</p></div><button class="control-button" type="button" id="refresh-rooms-button"><span class="button-icon icon-replay" aria-hidden="true"></span><span class="button-label">Refresh</span></button></div>
          <form class="admin-form" id="create-room-form"><label><span>Room code</span><input id="admin-room-id" type="text" maxlength="40" placeholder="auto" autocomplete="off" /></label><label><span>Players</span><select id="admin-player-count"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option></select></label><label class="admin-check"><input id="admin-bot-enabled" type="checkbox" /><span>Bot</span></label><button class="control-button" type="submit"><span class="button-icon icon-plus" aria-hidden="true"></span><span class="button-label">Create</span></button></form>
          <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Room</th><th>Phase</th><th>Players</th><th>Owner</th><th>Cycle</th><th>Flags</th><th>Actions</th></tr></thead><tbody id="rooms-table-body"></tbody></table></div>
        </section>
        <section class="admin-panel">
          <h2>Whitelist</h2><p id="whitelist-note">Bootstrap admin remains cheshirecode. Add GitHub logins here for DB-driven admin access.</p>
          <form class="admin-form" id="whitelist-form"><label class="admin-form-wide"><span>GitHub login</span><input id="whitelist-login" type="text" maxlength="40" autocomplete="off" placeholder="octocat" /></label><button class="control-button" type="submit"><span class="button-icon icon-plus" aria-hidden="true"></span><span class="button-label">Add</span></button></form>
          <div class="whitelist-list" id="whitelist-list"></div>
        </section>
        <section class="admin-panel admin-state-panel">
          <div class="admin-panel-header"><div><h2>Room State</h2><p>Inspect-only JSON for the selected room.</p></div><button class="control-button" type="button" id="clear-state-button"><span class="button-icon icon-end" aria-hidden="true"></span><span class="button-label">Clear</span></button></div>
          <pre id="room-state-view">Select a room to inspect.</pre>
        </section>
      </section>
    </main>
    <script type="module">
      const statusText=document.querySelector("#admin-status"),loginButton=document.querySelector("#admin-login-button"),logoutButton=document.querySelector("#admin-logout-button"),deniedPanel=document.querySelector("#admin-denied"),appPanel=document.querySelector("#admin-app"),roomsBody=document.querySelector("#rooms-table-body"),roomsNote=document.querySelector("#rooms-note"),refreshRoomsButton=document.querySelector("#refresh-rooms-button"),createRoomForm=document.querySelector("#create-room-form"),roomIdInput=document.querySelector("#admin-room-id"),playerCountInput=document.querySelector("#admin-player-count"),botEnabledInput=document.querySelector("#admin-bot-enabled"),whitelistForm=document.querySelector("#whitelist-form"),whitelistInput=document.querySelector("#whitelist-login"),whitelistList=document.querySelector("#whitelist-list"),whitelistNote=document.querySelector("#whitelist-note"),roomStateView=document.querySelector("#room-state-view"),clearStateButton=document.querySelector("#clear-state-button");let whitelist=[],bootstrapLogins=[];loginButton.addEventListener("click",()=>{window.location.href="/api/auth/github/login?next="+encodeURIComponent("/admin")});logoutButton.addEventListener("click",()=>{window.location.href="/api/auth/logout"});refreshRoomsButton.addEventListener("click",()=>loadRooms());clearStateButton.addEventListener("click",()=>{roomStateView.textContent="Select a room to inspect."});createRoomForm.addEventListener("submit",async e=>{e.preventDefault();try{const r=await fetch("/api/admin/rooms",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({roomId:roomIdInput.value.trim().toLowerCase(),playerCount:playerCountInput.value,botEnabled:botEnabledInput.checked})}),p=await r.json();if(!r.ok)throw new Error(p.error||"Room create failed");roomIdInput.value="";roomsNote.textContent="Created "+p.roomId+".";await loadRooms()}catch(r){roomsNote.textContent=r.message}});whitelistForm.addEventListener("submit",async e=>{e.preventDefault();const login=String(whitelistInput.value||"").trim().toLowerCase();if(!login)return;await saveWhitelist([...new Set([...whitelist,login])]);whitelistInput.value=""});init();async function init(){try{const r=await fetch("/api/admin/me",{headers:{Accept:"application/json"}}),p=await r.json();if(r.status===401){showDenied("Signed out");return}if(!r.ok){showDenied(p.error||"Admin access required");return}statusText.textContent="@"+p.user.login;loginButton.classList.add("is-hidden");logoutButton.classList.remove("is-hidden");deniedPanel.hidden=true;appPanel.hidden=false;await Promise.all([loadWhitelist(),loadRooms()])}catch{showDenied("Admin API unavailable")}}function showDenied(message){statusText.textContent=message;loginButton.classList.remove("is-hidden");logoutButton.classList.add("is-hidden");deniedPanel.hidden=false;appPanel.hidden=true}async function loadRooms(){roomsBody.replaceChildren(rowMessage("Loading rooms..."));try{const r=await fetch("/api/admin/rooms",{headers:{Accept:"application/json"}}),p=await r.json();if(!r.ok)throw new Error(p.error||"Rooms unavailable");const rooms=Array.isArray(p.rooms)?p.rooms:[];roomsNote.textContent=rooms.length+" room"+(rooms.length===1?"":"s")+" in the directory.";renderRooms(rooms)}catch(r){roomsBody.replaceChildren(rowMessage(r.message))}}function renderRooms(rooms){roomsBody.replaceChildren();if(rooms.length===0){roomsBody.append(rowMessage("No rooms in the directory."));return}for(const room of rooms){const row=document.createElement("tr");row.append(cell(room.id||"unknown"),cell(room.phase||"unknown"),cell(playerLabel(room)),cell(room.ownerId||"-"),cell(String(room.cycle??"-")),cell(flagsLabel(room)),actionsCell(room));roomsBody.append(row)}}function actionsCell(room){const item=document.createElement("td"),actions=document.createElement("div");actions.className="admin-actions";const inspect=button("Inspect","icon-session");inspect.addEventListener("click",()=>inspectRoom(room.id));const del=button("Delete","icon-end");del.addEventListener("click",()=>deleteRoom(room.id));actions.append(inspect,del);item.append(actions);return item}async function inspectRoom(roomId){roomStateView.textContent="Loading...";try{const r=await fetch("/api/admin/rooms/"+encodeURIComponent(roomId),{headers:{Accept:"application/json"}}),p=await r.json();if(!r.ok)throw new Error(p.error||"Room unavailable");roomStateView.textContent=JSON.stringify(p.room||p,null,2)}catch(r){roomStateView.textContent=r.message}}async function deleteRoom(roomId){try{const r=await fetch("/api/admin/rooms/"+encodeURIComponent(roomId),{method:"DELETE",headers:{Accept:"application/json"}}),p=await r.json();if(!r.ok)throw new Error(p.error||"Delete failed");roomsNote.textContent="Deleted "+roomId+".";await loadRooms()}catch(r){roomsNote.textContent=r.message}}async function loadWhitelist(){try{const r=await fetch("/api/admin/whitelist",{headers:{Accept:"application/json"}}),p=await r.json();if(!r.ok)throw new Error(p.error||"Whitelist unavailable");whitelist=Array.isArray(p.logins)?p.logins:[];bootstrapLogins=Array.isArray(p.bootstrapLogins)?p.bootstrapLogins:[];renderWhitelist()}catch(r){whitelistNote.textContent=r.message}}async function saveWhitelist(next){try{const r=await fetch("/api/admin/whitelist",{method:"PUT",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({logins:next})}),p=await r.json();if(!r.ok)throw new Error(p.error||"Whitelist update failed");whitelist=Array.isArray(p.logins)?p.logins:[];bootstrapLogins=Array.isArray(p.bootstrapLogins)?p.bootstrapLogins:[];whitelistNote.textContent="Whitelist saved.";renderWhitelist()}catch(r){whitelistNote.textContent=r.message}}function renderWhitelist(){whitelistList.replaceChildren();whitelistNote.textContent="Bootstrap: "+(bootstrapLogins.map(l=>"@"+l).join(", ")||"none")+".";const rows=[...bootstrapLogins.map(login=>({login,bootstrap:true})),...whitelist.map(login=>({login,bootstrap:false}))];if(rows.length===0){whitelistList.textContent="No admin logins configured.";return}for(const row of rows){const item=document.createElement("div");item.className="whitelist-row";const label=document.createElement("span");label.textContent="@"+row.login+(row.bootstrap?" · bootstrap":"");item.append(label);if(!row.bootstrap){const remove=button("Remove","icon-end");remove.addEventListener("click",()=>saveWhitelist(whitelist.filter(login=>login!==row.login)));item.append(remove)}whitelistList.append(item)}}function flagsLabel(room){const flags=[];if(room.closed)flags.push("closed");if(room.botEnabled||room.botCount)flags.push("bot");if(room.error)flags.push("error");if(room.spectatorCount)flags.push(room.spectatorCount+" watching");return flags.length?flags.join(" · "):"-"}function playerLabel(room){return (room.activeCount??0)+"/"+(room.targetPlayerCount??0)+(room.botCount?" + "+room.botCount+" bot":"")}function rowMessage(message){const row=document.createElement("tr"),item=document.createElement("td");item.colSpan=7;item.textContent=message;row.append(item);return row}function cell(value){const item=document.createElement("td");item.textContent=value;return item}function button(label,iconClass){const item=document.createElement("button");item.type="button";item.className="control-button";const icon=document.createElement("span");icon.className="button-icon "+iconClass;icon.setAttribute("aria-hidden","true");const text=document.createElement("span");text.className="button-label";text.textContent=label;item.append(icon,text);return item}
    </script>
  </body>
</html>`;
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

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
