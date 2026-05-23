const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
const PLAYER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const SESSION_COOKIE = "ppr_session";
const STATE_COOKIE = "ppr_oauth_state";
const NEXT_COOKIE = "ppr_oauth_next";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const ROUND_COUNTDOWN_MS = 20_000;
const EXPLOSION_DURATION_MS = 2_200;
const NODE_VALUE_MIN = 5;
const NODE_VALUE_MAX = 10;
const NODE_REPAIR_RADIUS = 12;
const BLAST_CENTER = { x: 244, y: 108 };
const BLAST_RADIUS_BASE = 92;
const BLAST_RADIUS_JITTER = 10;
const MAX_PLAYERS = 4;
const START_NODES = [
  { id: "n1", x: 180, y: 120 },
  { id: "n2", x: 245, y: 90 },
  { id: "n3", x: 300, y: 140 },
];

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
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
    };
  }

  async fetch(request) {
    await this.advanceTimedPhase();
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

    const url = new URL(request.url);
    const targetPlayerCount = clampNumber(url.searchParams.get("players"), 1, MAX_PLAYERS);
    if (this.roomState.phase === "lobby" && Object.keys(this.roomState.players).length === 0) {
      this.roomState.targetPlayerCount = targetPlayerCount;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptPlayer(server, player);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  acceptPlayer(socket, player) {
    socket.accept();
    const playerId = player.id;
    this.sessions.set(socket, playerId);
    const existingPlayer = this.roomState.players[playerId];
    const activePlayers = Object.values(this.roomState.players).filter((player) => !player.spectator);
    this.roomState.players[playerId] ||= {
      id: playerId,
      login: player.login,
      avatarUrl: player.avatarUrl,
      joinedAt: Date.now(),
      role: existingPlayer?.role || this.nextRole(),
      x: 42,
      y: 178,
      score: 0,
      ready: false,
      spectator: this.roomState.phase !== "lobby" || activePlayers.length >= this.roomState.targetPlayerCount,
    };

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
      this.sessions.delete(socket);
      const hasOtherSession = Array.from(this.sessions.values()).some((sessionPlayerId) => sessionPlayerId === playerId);
      if (!hasOtherSession) {
        delete this.roomState.players[playerId];
      }
      this.broadcastState("player:left");
    };
    socket.addEventListener("close", leave);
    socket.addEventListener("error", leave);
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
      this.broadcastState("room:state");
      return;
    }

    if (message.type === "move" || message.type === "player:move") {
      if (this.roomState.players[playerId].spectator) return;
      if (this.roomState.phase !== "repair") return;
      await this.updatePlayerPosition(playerId, message);
      this.broadcastState("room:state");
      return;
    }

  }

  async maybeStartRun() {
    const players = Object.values(this.roomState.players).filter((player) => !player.spectator);
    if (this.roomState.phase !== "lobby" || players.length === 0) return;
    if (players.length < this.roomState.targetPlayerCount) return;
    if (!players.every((player) => player.ready)) return;

    this.roomState.cycle += 1;
    this.roomState.startedAt = Date.now();
    this.roomState.nodes = cloneNodes();
    this.roomState.score = 0;
    this.roomState.summary = null;
    this.roomState.blast = makeBlast();
    this.roomState.countdownEndsAt = Date.now() + ROUND_COUNTDOWN_MS;
    for (const player of players) {
      player.score = 0;
      player.caughtInBlast = false;
    }
    await this.setPhase("repair", ROUND_COUNTDOWN_MS);
  }

  async updatePlayerPosition(playerId, message) {
    const player = this.roomState.players[playerId];
    if (!player) return;

    player.x = clampNumber(message.x, 0, 384);
    player.y = clampNumber(message.y, 0, 216);
    await this.captureReachedNodes(playerId, player);
  }

  async captureReachedNodes(playerId, player) {
    if (this.roomState.phase !== "repair") return;

    for (const node of this.roomState.nodes) {
      if (node.repaired) continue;
      if (Math.hypot(player.x - node.x, player.y - node.y) > NODE_REPAIR_RADIUS) continue;

      node.repaired = true;
      node.repairedBy = playerId;
      node.repairedAt = Date.now();
      player.score += node.value;
      this.roomState.score += node.value;
      this.roomState.countdownEndsAt += node.value * 1000;
      await this.state.storage.setAlarm(this.roomState.countdownEndsAt + 50);
    }
  }

  async alarm() {
    await this.advanceTimedPhase(true);
    this.broadcastState("phase:changed");
  }

  async advanceTimedPhase(fromAlarm = false) {
    const phaseStartedAt = this.roomState.phaseStartedAt;
    if (!phaseStartedAt || this.roomState.phase === "lobby") return;

    const elapsed = Date.now() - phaseStartedAt;
    if (this.roomState.phase === "repair" && Date.now() >= this.roomState.countdownEndsAt) {
      this.applyBlast();
      await this.setPhase("explosion", EXPLOSION_DURATION_MS);
    } else if (this.roomState.phase === "explosion" && elapsed >= EXPLOSION_DURATION_MS) {
      this.createSummary();
      await this.setPhase("end");
    } else if (fromAlarm) {
      this.broadcastState("room:state");
    }
  }

  async setPhase(phase, durationMs = null) {
    this.roomState.phase = phase;
    this.roomState.phaseStartedAt = Date.now();
    if (durationMs) {
      await this.state.storage.setAlarm(Date.now() + durationMs + 50);
    }
  }

  applyBlast() {
    const blast = this.roomState.blast || makeBlast();
    for (const player of Object.values(this.roomState.players)) {
      const caught = Math.hypot(player.x - blast.x, player.y - blast.y) <= blast.radius;
      player.caughtInBlast = caught;
      if (caught) {
        player.score = 0;
      }
    }
  }

  createSummary() {
    this.roomState.summary = Object.values(this.roomState.players)
      .filter((player) => !player.spectator)
      .map((player) => ({
        id: player.id,
        score: player.score,
        caughtInBlast: Boolean(player.caughtInBlast),
      }))
      .sort((a, b) => b.score - a.score);
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

function cloneNodes() {
  return START_NODES.map((node, index) => ({
    ...node,
    repaired: false,
    value: NODE_VALUE_MIN + Math.floor(Math.random() * (NODE_VALUE_MAX - NODE_VALUE_MIN + 1)),
    seed: Math.random() + index,
  }));
}

function makeBlast() {
  return {
    x: BLAST_CENTER.x,
    y: BLAST_CENTER.y,
    radius: BLAST_RADIUS_BASE + Math.round((Math.random() * 2 - 1) * BLAST_RADIUS_JITTER),
  };
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
