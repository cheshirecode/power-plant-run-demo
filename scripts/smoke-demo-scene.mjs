import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { NODE_STATES, PLAYER_STATES, SKILL_CONFIG, SKILL_IDS } from "../client/skill-mechanics.js";

installBrowserStubs();

await import(`${pathToFileURL(`${process.cwd()}/main.js`).href}?smoke=${Date.now()}`);
const { __ROOM_MECHANICS_DEBUG__: roomMechanics } = await import(`../src/worker.js?smoke=${Date.now()}`);

const debug = globalThis.window.__POWER_PLANT_DEMO_DEBUG__;
assert(debug, "demo debug API was not registered");
assert(!roomMechanics.canPlayerClaimNode({ state: roomMechanics.states.player.stasis }), "stasis room player could claim a node");
const claimResetNode = { claimedBy: "p1", claimedAt: 10, claimEndsAt: 20, repaired: false, state: roomMechanics.states.node.claimed };
roomMechanics.clearNodeClaim(claimResetNode);
assert(!claimResetNode.claimedBy && !claimResetNode.claimEndsAt && claimResetNode.state === roomMechanics.states.node.unclaimed, "room node claim reset did not clear state");

const timings = debug.timings;
assert(timings.vortexStart - timings.rebuildStart >= 4_000, "rebuild window is too short to see");
assert(timings.rebuildEnd - timings.vortexStart <= 1_500, "vortex transition is too long");

const demoOnlyIds = new Set(debug.demoOnlyAbilityIds);
for (const id of ["boost", "magnet", "stasis", "warp", "greed"]) {
  assert(demoOnlyIds.has(id), `${id} was not marked demo-only`);
}
assert(!demoOnlyIds.has("blink"), "old blink ability is still registered");

const workerSource = readFileSync("src/worker.js", "utf8");
for (const id of demoOnlyIds) {
  if (id === SKILL_IDS.stasis) continue;
  assert(!workerSource.includes(`"${id}"`) && !workerSource.includes(`'${id}'`), `${id} leaked into server gameplay`);
}

const opening = debug.getSnapshotAt(0, 0);
assert(opening.nodeCount === 40, `expected 40 initial demo nodes, got ${opening.nodeCount}`);
assert(opening.playerCount === 8, `expected 8 demo players, got ${opening.playerCount}`);
assert(opening.playerAbilities.every((id) => demoOnlyIds.has(id)), "demo player had a non-demo ability");

const firstTargets = opening.routePlans.map((plan) => plan.targets[0]).filter(Boolean);
assert(new Set(firstTargets).size >= Math.min(6, firstTargets.length), "route planner bunched too many first targets");
assertNodeValueRules(opening.nodes, 128, "demo opening");

const firstSpawnWave = debug.getSnapshotAt(3_000, 3_000);
assert(firstSpawnWave.nodeCount === 52, `expected 12 nodes to spawn at first demo wave, got ${firstSpawnWave.nodeCount - opening.nodeCount}`);
assert(opening.plants.length === 2, `expected 2 synced demo plants, got ${opening.plants.length}`);
assert(opening.blasts.every((blast) => blast.x - blast.radius >= 0 && blast.x + blast.radius <= 768 && blast.y - blast.radius >= 0 && blast.y + blast.radius <= 432), "demo blast radius exceeded map bounds");

const detonationElapsed = (() => {
  for (let elapsed = 0; elapsed < timings.explosionStart; elapsed += 100) {
    if (debug.getSnapshotAt(elapsed, elapsed).countdownMs <= 0) return elapsed;
  }
  return timings.explosionStart;
})();
assert(debug.getSnapshotAt(Math.max(0, detonationElapsed - 100), Math.max(0, detonationElapsed - 100)).stage === "repair", "demo detonated before countdown reached zero");
assert(debug.getSnapshotAt(detonationElapsed, detonationElapsed).stage !== "repair", "demo stayed in repair after countdown reached zero");

const repairSamples = [];
for (let elapsed = 1_000; elapsed < detonationElapsed; elapsed += 500) {
  repairSamples.push(debug.getSnapshotAt(elapsed, elapsed));
}
assert(repairSamples.some((sample) => sample.claimedNodeCount > 0), "no node was claimed during demo repair");
assert(repairSamples.some((sample) => sample.repairedNodeCount > 0), "no node was repaired during demo repair");
assert(repairSamples.some((sample) => Math.abs(sample.nodeTimerDeltaMs) > 0), "demo node repairs never affected the plant timer");
assert(
  repairSamples.some((sample, index) => index > 0 && sample.nodeTimerDeltaMs < repairSamples[index - 1].nodeTimerDeltaMs),
  "negative nodes never pressured the plant timer",
);
assert(repairSamples.every((sample) => sample.players.every((player) => player.roundScore >= 0)), "negative nodes reduced a demo player score");
assert(repairSamples.some((sample) => sample.frozenCount > 0), "stasis never froze a demo player");
assert(
  repairSamples.some((sample) => sample.nodes.some((node) => node.state === NODE_STATES.stasis && node.stasisLocked && !node.claimedBy)),
  "stasis never locked an unclaimed node",
);
assert(
  repairSamples.every((sample) =>
    sample.nodes.every((node) => {
      if (!node.stasisLocked || !node.claimedBy) return true;
      const claimant = sample.players.find((player) => player.id === node.claimedBy);
      return claimant?.ability === SKILL_IDS.stasis && claimant.state !== PLAYER_STATES.stasis;
    }),
  ),
  "stasis allowed a non-stasis player to keep claiming a locked node",
);
const boostBurst = debug.getSnapshotAt(500, 500).players.filter((player) => player.ability === "boost");
const boostCooldown = debug.getSnapshotAt(1_500, 1_500).players.filter((player) => player.ability === "boost");
assert(boostBurst.some((player) => player.boostActive), "boost was not active during its 1s burst");
assert(boostCooldown.every((player) => !player.boostActive), "boost stayed active during cooldown");
assert(boostCooldown.some((player) => player.skillCooldown > 0 && player.skillCooldown < 1), "boost cooldown bar did not drain");
assertCooldownTiming(debug, "boost", {
  activeElapsed: 500,
  coolingElapsed: 1_500,
  cooldownElapsed: 3_900,
  nextActiveElapsed: 4_000,
  nextCoolingElapsed: null,
  activePredicate: (player) => player.boostActive,
});
assertCooldownTiming(debug, "stasis", {
  activeElapsed: 0,
  coolingElapsed: 1_500,
  cooldownElapsed: SKILL_CONFIG.stasis.cooldownMs - 100,
  nextActiveElapsed: SKILL_CONFIG.stasis.cooldownMs,
  nextCoolingElapsed: SKILL_CONFIG.stasis.cooldownMs + 300,
  activePredicate: (_, sample) => sample.frozenCount > 0,
});
assertCooldownTiming(debug, "warp", {
  activeElapsed: 100,
  coolingElapsed: Math.floor(SKILL_CONFIG.warp.activeMs + 250),
  cooldownElapsed: SKILL_CONFIG.warp.cooldownMs - 40,
  nextActiveElapsed: SKILL_CONFIG.warp.cooldownMs,
  nextCoolingElapsed: SKILL_CONFIG.warp.cooldownMs + SKILL_CONFIG.warp.activeMs + 250,
  activePredicate: (player) => player.skillCooldown === 1,
});
const skillStats = repairSamples.at(-1).skillStats;
assert(repairSamples.some((sample) => sample.players.some((player) => player.ability === "warp" && player.warpHopActive)), "warp never activated during repair");
assert(skillStats?.stasis?.count > 0, "stasis skill log never recorded frozen players");
assert(skillStats?.warp?.count > 0, "warp skill log never recorded portal hops");
assert(skillStats?.greed?.count > 0, "greed skill log never recorded rich snaps");

const fullDemoNodeSet = debug.getSnapshotAt(10_000, 10_000).nodes;
assertNodeValueRules(fullDemoNodeSet, 128, "demo full");

for (let i = 0; i < 20; i += 1) {
  const gameplayNodes = roomMechanics.cloneNodes();
  assertNodeValueRules(gameplayNodes, roomMechanics.redExclusionRadius, `gameplay room ${i + 1}`);
  assert(
    gameplayNodes.filter((node) => node.spawnedAt === 0).length === roomMechanics.initialNodeCount,
    `gameplay room ${i + 1}: initial spawned node count drifted`,
  );
  const futureNodes = gameplayNodes.filter((node) => node.spawnedAt > 0);
  assert(futureNodes.length > 0, `gameplay room ${i + 1}: no timed respawn nodes`);
  for (const [index, node] of futureNodes.entries()) {
    assert(node.spawnedAt === (index + 1) * roomMechanics.nodeRespawnMs, `gameplay room ${i + 1}: node ${node.id} has bad spawn timing`);
    assert(!roomMechanics.isNodeSpawned(node, 1000, 1000 + node.spawnedAt - 1), `gameplay room ${i + 1}: node ${node.id} spawned early`);
    assert(roomMechanics.isNodeSpawned(node, 1000, 1000 + node.spawnedAt), `gameplay room ${i + 1}: node ${node.id} did not spawn on time`);
  }
}

const stages = new Set();
for (let elapsed = 0; elapsed < timings.firstLoopDuration; elapsed += 250) {
  stages.add(debug.getSnapshotAt(elapsed, elapsed).stage);
}
assert(stages.has("blast"), "blast stage missing after detonation");
assert(stages.has("rebuild"), "rebuild stage missing after blast");
assert(stages.has("vortex"), "vortex stage missing near loop boundary");

const nextLoop = debug.getSnapshotAt(timings.firstLoopDuration + 500);
assert(nextLoop.cycle === 1, "demo did not advance to next loop");
assert(nextLoop.stage === "repair", "next demo loop did not restart in repair stage");

console.log("demo scene smoke passed");

function installBrowserStubs() {
  const elements = new Map();
  const canvas = makeCanvas();
  const styleButtons = ["steampunk", "cyberpunk", "futuristic"].map((style) => makeElement({ dataset: { style } }));

  globalThis.window = {
    location: { href: "http://127.0.0.1:8799/", pathname: "/", search: "", protocol: "http:", host: "127.0.0.1:8799" },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    AudioContext: null,
    webkitAudioContext: null,
    prompt() {},
  };
  globalThis.document = {
    documentElement: makeElement(),
    querySelector(selector) {
      if (selector === "#game-canvas") return canvas;
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === ".style-button") return styleButtons;
      return [];
    },
    createElement(tagName) {
      if (tagName === "canvas") return makeCanvas();
      return makeElement();
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async () => {} } },
  });
  globalThis.WebSocket = class WebSocketStub {
    static OPEN = 1;
  };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
}

function makeElement(overrides = {}) {
  const classes = new Set();
  return {
    dataset: {},
    style: { setProperty() {} },
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
      toggle(value, force) {
        if (force === true) classes.add(value);
        else if (force === false) classes.delete(value);
        else if (classes.has(value)) classes.delete(value);
        else classes.add(value);
      },
      contains: (value) => classes.has(value),
    },
    addEventListener() {},
    setAttribute() {},
    append() {},
    replaceChildren() {},
    querySelector() {
      return makeElement();
    },
    textContent: "",
    className: "",
    value: "",
    checked: false,
    disabled: false,
    open: false,
    ...overrides,
  };
}

function makeCanvas() {
  return {
    ...makeElement(),
    width: 768,
    height: 432,
    getContext: () => makeContext(),
  };
}

function makeContext() {
  return {
    imageSmoothingEnabled: false,
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    font: "",
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillRect() {},
    strokeRect() {},
    drawImage() {},
    fillText() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(768 * 432 * 4) }),
  };
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertNodeValueRules(nodes, redExclusionRadius, label) {
  const positives = nodes.filter((node) => node.value > 0 && !node.bonus);
  for (const node of nodes) {
    const distance = node.distanceFromPlant ?? Math.hypot(node.x - roomMechanics.center.x, node.y - roomMechanics.center.y);
    assert(!(node.value < 0 && distance <= redExclusionRadius), `${label}: red node ${node.id} spawned in plant grid`);
  }

  for (const hotter of positives) {
    const hotterHeat = hotter.plantHeat ?? 0;
    for (const cooler of positives) {
      const coolerHeat = cooler.plantHeat ?? 0;
      if (hotterHeat > coolerHeat + 0.12) {
        const hotterBaseValue = Math.abs(hotter.value) - (hotter.valuePulseCount || 0);
        const coolerBaseValue = Math.abs(cooler.value) - (cooler.valuePulseCount || 0);
        assert(hotterBaseValue >= coolerBaseValue, `${label}: green node ${hotter.id} has more plant heat but lower base value than ${cooler.id}`);
      }
    }
  }
}

function assertCooldownTiming(debug, ability, timings) {
  const activePlayers = debug.getSnapshotAt(timings.activeElapsed, timings.activeElapsed).players.filter((player) => player.ability === ability);
  const coolingPlayers = debug.getSnapshotAt(timings.coolingElapsed, timings.coolingElapsed).players.filter((player) => player.ability === ability);
  const cooldownPlayers = debug.getSnapshotAt(timings.cooldownElapsed, timings.cooldownElapsed).players.filter((player) => player.ability === ability);
  const nextActiveSample = debug.getSnapshotAt(timings.nextActiveElapsed, timings.nextActiveElapsed);
  const nextActivePlayers = nextActiveSample.players.filter((player) => player.ability === ability);
  const nextCoolingPlayers = Number.isFinite(timings.nextCoolingElapsed)
    ? debug.getSnapshotAt(timings.nextCoolingElapsed, timings.nextCoolingElapsed).players.filter((player) => player.ability === ability)
    : [];
  assert(activePlayers.length > 0, `${ability} player missing`);
  assert(activePlayers.every((player) => player.skillCooldown === 1), `${ability} cooldown was not full at activation`);
  assert(coolingPlayers.some((player) => player.skillCooldown > 0 && player.skillCooldown < 1), `${ability} cooldown did not drain after activation`);
  assert(cooldownPlayers.some((player) => player.skillCooldown > 0 && player.skillCooldown < 0.08), `${ability} cooldown did not approach empty before reactivation`);
  assert(nextActivePlayers.some((player) => player.skillCooldown === 1), `${ability} cooldown did not refill at next activation`);
  if (Number.isFinite(timings.nextCoolingElapsed)) {
    assert(nextCoolingPlayers.some((player) => player.skillCooldown > 0 && player.skillCooldown < 1), `${ability} cooldown did not drain after reactivation`);
  }
  assert(nextActivePlayers.some((player) => timings.activePredicate(player, nextActiveSample)), `${ability} did not trigger at its next activation timing`);
}
