import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import WebSocket from "ws";

const baseUrl = new URL(process.env.POWER_PLANT_RUN_SMOKE_URL || "http://127.0.0.1:8787");
const devSecret = readDevSecret();
const isLocalSmoke = ["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname);
const secret =
  (isLocalSmoke ? devSecret : "") || process.env.POWER_PLANT_RUN_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || devSecret;
const cases = [2, 3, 4];

if (!secret) {
  throw new Error("POWER_PLANT_RUN_GITHUB_CLIENT_SECRET or GITHUB_CLIENT_SECRET is required");
}

const createdRooms = [];

try {
  for (const playerCount of cases) {
    await smokeBotRoom(playerCount);
  }
  console.log(`bot smoke passed for ${cases.join(", ")} player rooms`);
} finally {
  await Promise.allSettled(createdRooms.map((room) => deleteRoom(room)));
}

async function smokeBotRoom(playerCount) {
  const roomId = `smoke-${playerCount}-${randomUUID().slice(0, 8)}`;
  const owner = makePlayer(`smoke${playerCount}a`);
  const players = Array.from({ length: playerCount }, (_, index) => makePlayer(`smoke${playerCount}${String.fromCharCode(97 + index)}`));

  createdRooms.push({ id: roomId, cookie: owner.cookie });

  const sockets = [];
  try {
    for (let index = 0; index < players.length; index += 1) {
      const socket = await connectRoom(roomId, players[index].cookie, {
        playerCount,
        bot: index === 0,
      });
      sockets.push(socket);
    }

    const started = waitForState(sockets[0], (state) => state.phase === "repair", 4_000);
    for (const socket of sockets) {
      socket.send(JSON.stringify({ type: "ready", ready: true }));
    }
    const repairState = await started;
    for (const player of Object.values(repairState.players || {})) {
      if (!player.spectator) {
        assert(player.ability?.id === "magnet", `player ${player.id} missing default magnet skill in ${roomId}`);
      }
    }

    const bot = repairState.players?.["bot-1"];
    assert(bot, `bot missing in ${roomId}`);
    assert(bot.bot === true, `bot flag missing in ${roomId}`);
    assert(bot.spectator === false, `bot is spectating in ${roomId}`);
    assert(repairState.targetPlayerCount === playerCount, `target count mismatch in ${roomId}`);

    const botMoves = await collectBotMoves(sockets[0], 4, 5_000);
    assert(botMoves.some((move) => move.distance > 0), `bot did not move in ${roomId}`);
    assert(botMoves.every((move) => move.distance <= 12), `bot jumped too far in ${roomId}: ${botMoves.map((move) => move.distance).join(",")}`);
    assert(botMoves.at(-1).bot.botTargetNodeId, `bot target missing in ${roomId}`);
  } finally {
    await deleteRoom({ id: roomId, cookie: owner.cookie });
    for (const socket of sockets) {
      socket.close();
    }
  }
}

async function collectBotMoves(socket, count, timeoutMs) {
  return new Promise((resolve, reject) => {
    const moves = [];
    let previousBot = null;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for bot moves"));
    }, timeoutMs);

    const onMessage = (data) => {
      const state = JSON.parse(String(data)).state;
      const bot = state?.players?.["bot-1"];
      if (!bot || state.phase !== "repair") return;
      if (previousBot) {
        const distance = Math.hypot(bot.x - previousBot.x, bot.y - previousBot.y);
        if (distance > 0) {
          moves.push({ bot, distance });
        }
      }
      previousBot = { x: bot.x, y: bot.y };
      if (moves.length >= count) {
        cleanup();
        resolve(moves);
      }
    };

    const onClose = () => {
      cleanup();
      reject(new Error("websocket closed while waiting for bot moves"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("close", onClose);
    };

    socket.on("message", onMessage);
    socket.on("close", onClose);
  });
}

async function connectRoom(roomId, cookie, options) {
  const wsUrl = new URL(`/ws/rooms/${roomId}`, baseUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.searchParams.set("players", String(options.playerCount));
  if (options.bot) wsUrl.searchParams.set("bot", "1");

  const socket = new WebSocket(wsUrl, {
    headers: {
      Cookie: `ppr_session=${cookie}`,
    },
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`websocket open timed out for ${roomId}`)), 4_000);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("error", () => {
      clearTimeout(timer);
      reject(new Error(`websocket error for ${roomId}`));
    });
  });

  return socket;
}

async function waitForState(socket, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for matching room state"));
    }, timeoutMs);

    const onMessage = (data) => {
      const message = JSON.parse(String(data));
      const state = message.state;
      if (state && predicate(state)) {
        cleanup();
        resolve(state);
      }
    };

    const onClose = () => {
      cleanup();
      reject(new Error("websocket closed while waiting for state"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("close", onClose);
    };

    socket.on("message", onMessage);
    socket.on("close", onClose);
  });
}

async function deleteRoom(room) {
  const response = await fetch(new URL(`/api/rooms/${room.id}`, baseUrl), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Cookie: `ppr_session=${room.cookie}`,
    },
  });
  if (!response.ok && response.status !== 403 && response.status !== 410) {
    throw new Error(`failed to delete ${room.id}: ${response.status}`);
  }
}

function makePlayer(login) {
  return {
    login,
    cookie: signSession({
      user: {
        id: login,
        login,
        avatarUrl: "",
      },
      exp: Math.floor(Date.now() / 1000) + 60 * 10,
    }),
  };
}

function signSession(session) {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function readDevSecret() {
  try {
    const vars = readFileSync(".dev.vars", "utf8");
    const match = vars.match(/^GITHUB_CLIENT_SECRET=(.*)$/m);
    return match?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}
