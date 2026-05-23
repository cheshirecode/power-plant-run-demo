const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
const PLAYER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const SESSION_COOKIE = "ppr_session";
const STATE_COOKIE = "ppr_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.roomState = {
      phase: "lobby",
      cycle: 0,
      startedAt: null,
      players: {},
    };
  }

  async fetch(request) {
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
    this.roomState.players[playerId] = {
      id: playerId,
      joinedAt: Date.now(),
      ready: false,
    };

    socket.send(
      JSON.stringify({
        type: "welcome",
        playerId,
        state: this.roomState,
      }),
    );
    this.broadcast({ type: "player_joined", playerId, state: this.roomState }, socket);

    socket.addEventListener("message", (event) => {
      this.handleMessage(socket, event.data);
    });

    const leave = () => {
      this.sessions.delete(socket);
      delete this.roomState.players[playerId];
      this.broadcast({ type: "player_left", playerId, state: this.roomState });
    };
    socket.addEventListener("close", leave);
    socket.addEventListener("error", leave);
  }

  handleMessage(socket, rawMessage) {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      socket.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }

    const playerId = this.sessions.get(socket);
    if (!playerId) return;

    if (message.type === "ready") {
      this.roomState.players[playerId].ready = Boolean(message.ready);
      this.maybeStartRun();
      this.broadcast({ type: "state", state: this.roomState });
      return;
    }

    if (message.type === "repair") {
      this.broadcast({
        type: "repair",
        playerId,
        nodeId: String(message.nodeId || ""),
        at: Date.now(),
      });
    }
  }

  maybeStartRun() {
    const players = Object.values(this.roomState.players);
    if (this.roomState.phase !== "lobby" || players.length === 0) return;
    if (!players.every((player) => player.ready)) return;

    this.roomState.phase = "run";
    this.roomState.cycle += 1;
    this.roomState.startedAt = Date.now();
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
  const callbackUrl = new URL(env.GITHUB_OAUTH_CALLBACK_PATH, url.origin);
  const githubUrl = new URL(GITHUB_AUTHORIZE_URL);
  githubUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  githubUrl.searchParams.set("scope", "read:user");
  githubUrl.searchParams.set("state", state);

  return redirect(githubUrl.toString(), {
    "Set-Cookie": buildCookie(STATE_COOKIE, state, {
      maxAge: 600,
      httpOnly: true,
      sameSite: "Lax",
      secure: url.protocol === "https:",
    }),
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

  return redirect("/", {
    "Set-Cookie": [
      buildCookie(SESSION_COOKIE, sessionValue, {
        maxAge: SESSION_MAX_AGE,
        httpOnly: true,
        sameSite: "Lax",
        secure: url.protocol === "https:",
      }),
      expireCookie(STATE_COOKIE, url.protocol === "https:"),
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
