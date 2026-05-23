import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const baseUrl = new URL(process.env.POWER_PLANT_RUN_SMOKE_URL || "http://127.0.0.1:8787");
const devSecret = readDevSecret();
const isLocalSmoke = ["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname);
const secret =
  (isLocalSmoke ? devSecret : "") || process.env.POWER_PLANT_RUN_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || devSecret;

if (!secret) {
  throw new Error("POWER_PLANT_RUN_GITHUB_CLIENT_SECRET or GITHUB_CLIENT_SECRET is required");
}

const admin = makePlayer("cheshirecode");
const outsider = makePlayer(`admin-outsider-${randomUUID().slice(0, 6)}`);
const delegated = makePlayer(`admin-delegated-${randomUUID().slice(0, 6)}`);
const roomId = `admin-${randomUUID().slice(0, 8)}`;
let originalWhitelist = [];
let whitelistLoaded = false;

try {
  await expectStatus("/api/admin/me", {}, 401);
  await expectStatus("/api/admin/me", { cookie: outsider.cookie }, 403);

  const me = await api("/api/admin/me", { cookie: admin.cookie });
  assert(me.admin === true, "bootstrap admin was not accepted");

  const whitelist = await api("/api/admin/whitelist", { cookie: admin.cookie });
  originalWhitelist = Array.isArray(whitelist.logins) ? whitelist.logins : [];
  whitelistLoaded = true;

  await api("/api/admin/whitelist", {
    method: "PUT",
    cookie: admin.cookie,
    body: { logins: [...new Set([...originalWhitelist, delegated.login])] },
  });
  await api("/api/admin/me", { cookie: delegated.cookie });

  const created = await api("/api/admin/rooms", {
    method: "POST",
    cookie: admin.cookie,
    body: { roomId, playerCount: 3, botEnabled: true },
  });
  assert(created.roomId === roomId, "admin-created room id mismatch");

  const rooms = await api("/api/admin/rooms", { cookie: admin.cookie });
  const listedRoom = rooms.rooms.find((room) => room.id === roomId);
  assert(listedRoom, "admin-created room missing from admin list");
  assert(listedRoom.targetPlayerCount === 3, "admin-created room target count was not persisted");
  assert(listedRoom.botEnabled === true, "admin-created room bot flag was not persisted");

  const inspected = await api(`/api/admin/rooms/${roomId}`, { cookie: admin.cookie });
  assert(inspected.room?.id === roomId, "admin room inspect did not return full room state");

  await api(`/api/admin/rooms/${roomId}`, { method: "DELETE", cookie: delegated.cookie });
  const afterDelete = await api("/api/admin/rooms", { cookie: admin.cookie });
  assert(!afterDelete.rooms.some((room) => room.id === roomId), "deleted room remained in admin list");

  const publicRooms = await api("/api/rooms", { cookie: admin.cookie });
  assert(!publicRooms.rooms.some((room) => room.id === roomId), "deleted room remained in public list");

  console.log("admin smoke passed");
} finally {
  await api(`/api/admin/rooms/${roomId}`, { method: "DELETE", cookie: admin.cookie }).catch(() => {});
  if (whitelistLoaded) {
    await api("/api/admin/whitelist", {
      method: "PUT",
      cookie: admin.cookie,
      body: { logins: originalWhitelist },
    }).catch(() => {});
  }
}

async function expectStatus(path, options, status) {
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method || "GET",
    headers: headers(options),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status !== status) {
    throw new Error(`${path} expected ${status}, got ${response.status}`);
  }
}

async function api(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method || "GET",
    headers: headers(options),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${payload.error || ""}`.trim());
  }
  return payload;
}

function headers(options) {
  const values = {
    Accept: "application/json",
  };
  if (options.body) {
    values["Content-Type"] = "application/json";
  }
  if (options.cookie) {
    values.Cookie = `ppr_session=${options.cookie}`;
  }
  return values;
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
