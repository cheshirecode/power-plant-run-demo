const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
const PLAYER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const SESSION_COOKIE = "ppr_session";
const STATE_COOKIE = "ppr_oauth_state";
const NEXT_COOKIE = "ppr_oauth_next";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const REPAIR_DURATION_MS = 18_000;
const ESCAPE_DURATION_MS = 7_000;
const EXPLOSION_DURATION_MS = 2_200;
const REBUILD_DURATION_MS = 3_800;
const MAX_PLAYERS = 4;
const START_NODES = [
  { id: "n1", x: 180, y: 120, repaired: false },
  { id: "n2", x: 245, y: 90, repaired: false },
  { id: "n3", x: 300, y: 140, repaired: false },
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
      startedAt: null,
      phaseStartedAt: null,
      players: {},
      nodes: cloneNodes(),
      score: 0,
    };
  }

  async fetch(request) {
    await this.advanceTimedPhase();

    if (request.headers.get("Upgrade") !== "websocket") {
      return json({
        ok: true,
        room: this.roomState,
      });
    }

    const url = new URL(request.url);
    const playerId = sanitizePlayerId(url.searchParams.get("player"));
    if (!playerId) {
      return json({ error: "Missing or invalid player id" }, 400);
    }
    if (!this.roomState.players[playerId] && Object.keys(this.roomState.players).length >= MAX_PLAYERS) {
      return json({ error: "Room is full" }, 409);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptPlayer(server, playerId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  acceptPlayer(socket, playerId) {
    socket.accept();
    this.sessions.set(socket, playerId);
    this.roomState.players[playerId] ||= {
      id: playerId,
      joinedAt: Date.now(),
      role: this.nextRole(),
      x: 42,
      y: 178,
      ready: false,
      escaped: false,
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
      delete this.roomState.players[playerId];
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
      this.roomState.players[playerId].ready = Boolean(message.ready);
      await this.maybeStartRun();
      this.broadcastState("room:state");
      return;
    }

    if (message.type === "move" || message.type === "player:move") {
      this.updatePlayerPosition(playerId, message);
      this.broadcastState("room:state");
      return;
    }

    if (message.type === "repair" || message.type === "node:repair") {
      await this.repairNode(playerId, String(message.nodeId || ""));
      this.broadcastState("node:repair");
      return;
    }

    if (message.type === "escape" || message.type === "player:escape") {
      this.roomState.players[playerId].escaped = true;
      if (Object.values(this.roomState.players).every((player) => player.escaped)) {
        await this.setPhase("explosion", EXPLOSION_DURATION_MS);
      }
      this.broadcastState("player:escape");
    }
  }

  async maybeStartRun() {
    const players = Object.values(this.roomState.players);
    if (this.roomState.phase !== "lobby" || players.length === 0) return;
    if (!players.every((player) => player.ready)) return;

    this.roomState.cycle += 1;
    this.roomState.startedAt = Date.now();
    this.roomState.nodes = cloneNodes();
    this.roomState.score = 0;
    for (const player of players) {
      player.escaped = false;
    }
    await this.setPhase("repair", REPAIR_DURATION_MS);
  }

  updatePlayerPosition(playerId, message) {
    const player = this.roomState.players[playerId];
    if (!player) return;

    player.x = clampNumber(message.x, 0, 384);
    player.y = clampNumber(message.y, 0, 216);
  }

  async repairNode(playerId, nodeId) {
    if (this.roomState.phase !== "repair") return;

    const node = this.roomState.nodes.find((item) => item.id === nodeId);
    if (!node || node.repaired) return;

    node.repaired = true;
    node.repairedBy = playerId;
    node.repairedAt = Date.now();
    this.roomState.score += 1;

    if (this.roomState.nodes.every((item) => item.repaired)) {
      await this.setPhase("escape", ESCAPE_DURATION_MS);
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
    if (this.roomState.phase === "repair" && elapsed >= REPAIR_DURATION_MS) {
      await this.setPhase("escape", ESCAPE_DURATION_MS);
    } else if (this.roomState.phase === "escape" && elapsed >= ESCAPE_DURATION_MS) {
      await this.setPhase("explosion", EXPLOSION_DURATION_MS);
    } else if (this.roomState.phase === "explosion" && elapsed >= EXPLOSION_DURATION_MS) {
      await this.setPhase("rebuild", REBUILD_DURATION_MS);
    } else if (this.roomState.phase === "rebuild" && elapsed >= REBUILD_DURATION_MS) {
      this.finishRebuild();
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

  finishRebuild() {
    this.roomState.phase = "lobby";
    this.roomState.phaseStartedAt = null;
    this.roomState.startedAt = null;
    this.roomState.upgradeLevel += this.roomState.score >= 2 ? 1 : 0;
    this.roomState.nodes = cloneNodes();
    this.roomState.score = 0;
    for (const player of Object.values(this.roomState.players)) {
      player.ready = false;
      player.escaped = false;
    }
  }

  nextRole() {
    const roles = ["rifleman", "scout", "heavy", "engineer"];
    const usedRoles = new Set(Object.values(this.roomState.players).map((player) => player.role));
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
  return START_NODES.map((node) => ({ ...node }));
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
      const roomId = crypto.randomUUID().slice(0, 8);
      return json({
        roomId,
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
